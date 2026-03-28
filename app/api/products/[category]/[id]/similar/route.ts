import { NextResponse } from 'next/server'
import { getDatabase } from '@/lib/database'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(
  request: Request,
  { params }: { params: { category: string; id: string } }
) {
  try {
    const category = decodeURIComponent(params.category)
    const productId = decodeURIComponent(params.id)
    
    const db = await getDatabase()
    const tableName = 'all_products'
    
    // Get current product's tokenized_name
    const currentProductQuery = `
      SELECT tokenized_name, standard_name
      FROM ${tableName}
      WHERE standard_name = $1 
        AND category = $2
      LIMIT 1
    `
    
    const currentProduct = await db.get(currentProductQuery, [productId, category])
    
    if (!currentProduct || !currentProduct.tokenized_name) {
      await db.close()
      return NextResponse.json({ products: [] })
    }
    
    // Split tokenized_name into keywords (usually space-separated)
    const tokenizedName = currentProduct.tokenized_name.toLowerCase()
    const keywords = tokenizedName.split(/\s+/).filter((word: string) => word.length > 2) // Filter out very short words
    
    if (keywords.length === 0) {
      await db.close()
      return NextResponse.json({ products: [] })
    }
    
    // Build query to find similar products based on tokenized_name keywords
    // Products must:
    // 1. Be in the same category
    // 2. Have tokenized_name containing at least one of the keywords
    // 3. NOT be the current product (different standard_name)
    // 4. Have valid prices (in-stock items)
    // 5. Be unique by standard_name
    
    const keywordParams = keywords.map((keyword: string) => `%${keyword}%`)
    const keywordConditions = keywords.map((_: string, idx: number) => {
      return `tokenized_name LIKE $${idx + 3}`
    }).join(' OR ')
    
    const limit = 4 // Limit to 4 similar products
    const similarProductsQuery = `
      SELECT 
        standard_name,
        brand,
        MIN(CASE 
          WHEN price_bdt IS NOT NULL 
            AND price_bdt > 0 
            AND availability_status IN ('in_stock', 'limited')
          THEN price_bdt 
          ELSE NULL 
        END) as min_price,
        MAX(CASE 
          WHEN price_bdt IS NOT NULL 
            AND price_bdt > 0 
            AND availability_status IN ('in_stock', 'limited')
          THEN price_bdt 
          ELSE NULL 
        END) as max_price,
        AVG(CASE 
          WHEN price_bdt IS NOT NULL 
            AND price_bdt > 0 
            AND availability_status IN ('in_stock', 'limited')
          THEN price_bdt 
          ELSE NULL 
        END) as avg_price,
        COUNT(DISTINCT vendor_name) as vendor_count,
        COUNT(*) as total_listings
      FROM ${tableName}
      WHERE category = $1
        AND standard_name != $2
        AND (${keywordConditions})
        AND price_bdt IS NOT NULL
        AND price_bdt > 0
        AND availability_status IN ('in_stock', 'limited')
      GROUP BY standard_name, brand
      ORDER BY vendor_count DESC, min_price ASC
      LIMIT $${keywordParams.length + 3}
    `
    
    const similarProducts = await db.query(
      similarProductsQuery,
      [category, productId, ...keywordParams, limit]
    )
    
    if (similarProducts.length === 0) {
      await db.close()
      return NextResponse.json({ products: [] })
    }
    
    // Get price entries for similar products
    const standardNames = similarProducts.map((p: any) => p.standard_name)
    
    if (standardNames.length === 0) {
      await db.close()
      return NextResponse.json({ products: [] })
    }
    
    // Build IN clause with proper parameter placeholders
    const namePlaceholders = standardNames.map((_: any, idx: number) => `$${idx + 2}`).join(', ')
    
    const priceEntriesQuery = `
      SELECT
        standard_name,
        id,
        vendor_name,
        raw_name,
        price_bdt,
        availability_status,
        product_url,
        image_url,
        scraped_at,
        description
      FROM ${tableName}
      WHERE category = $1
        AND standard_name IN (${namePlaceholders})
        AND price_bdt IS NOT NULL
        AND price_bdt > 0
        AND availability_status IN ('in_stock', 'limited')
      ORDER BY price_bdt ASC
    `
    
    const priceEntries = await db.query(priceEntriesQuery, [category, ...standardNames])
    
    // Group price entries by standard_name
    const priceEntriesMap = new Map<string, any[]>()
    priceEntries.forEach((entry: any) => {
      const name = entry.standard_name
      if (!priceEntriesMap.has(name)) {
        priceEntriesMap.set(name, [])
      }
      priceEntriesMap.get(name)!.push({
        id: entry.id,
        vendor_name: entry.vendor_name,
        raw_name: entry.raw_name,
        price_bdt: Number(entry.price_bdt),
        availability_status: entry.availability_status,
        product_url: entry.product_url,
        image_url: entry.image_url,
        scraped_at: entry.scraped_at,
        description: entry.description,
      })
    })
    
    // Build products with price entries
    const products = similarProducts.map((product: any) => {
      const entries = priceEntriesMap.get(product.standard_name) || []
      const vendors = new Set<string>()
      const images = new Set<string>()
      
      entries.forEach((entry: any) => {
        if (entry.vendor_name) vendors.add(entry.vendor_name)
        if (entry.image_url) images.add(entry.image_url)
      })
      
      return {
        id: product.standard_name,
        standard_name: product.standard_name,
        brand: product.brand,
        min_price: product.min_price ? parseFloat(product.min_price) : 0,
        max_price: product.max_price ? parseFloat(product.max_price) : 0,
        avg_price: product.avg_price ? parseFloat(product.avg_price) : 0,
        vendor_count: parseInt(product.vendor_count),
        total_listings: parseInt(product.total_listings),
        vendors: Array.from(vendors),
        images: Array.from(images),
        price_entries: entries,
        category: category
      }
    })
    
    await db.close()
    
    return NextResponse.json({ products })
  } catch (error) {
    console.error('Error fetching similar products:', error)
    return NextResponse.json(
      { error: 'Failed to fetch similar products', products: [] },
      { status: 500 }
    )
  }
}

