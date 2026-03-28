import { NextResponse } from 'next/server'
import { getDatabase } from '@/lib/database'

export async function GET(
  request: Request,
  { params }: { params: { category: string; id: string } }
) {
  try {
    const category = decodeURIComponent(params.category)
    const productId = decodeURIComponent(params.id)
    
    // Check if refresh is requested
    const url = new URL(request.url)
    const shouldRefresh = url.searchParams.get('refresh') === 'true'
    
    if (shouldRefresh) {
      // Trigger refresh and WAIT for it to complete
      try {
        const refreshResponse = await fetch(
          `${url.origin}/api/products/${encodeURIComponent(category)}/${encodeURIComponent(productId)}/refresh`,
          { method: 'POST' }
        )
        const refreshData = await refreshResponse.json()
        
        if (!refreshResponse.ok) {
          console.error('Refresh failed, continuing with cached data', refreshData)
        } else {
          // Wait a moment for database to commit the changes
          await new Promise(resolve => setTimeout(resolve, 500))
        }
      } catch (error) {
        console.error('Error triggering refresh:', error)
        // Continue with cached data even if refresh fails
      }
    }
    
    const db = await getDatabase()

    // Use all_products table from final_products.db
    const tableName = 'all_products'

    // Get the specific product with all its price entries
    // Note: We calculate min/max/avg from in-stock items only (in_stock or limited availability)
    // This ensures prices reflect actual available products, not misleading out-of-stock prices
    const productQuery = `
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
      WHERE standard_name = $1 
        AND category = $2
      GROUP BY standard_name, brand
    `
    
    const product = await db.get(productQuery, [productId, category])

    if (!product) {
      await db.close()
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      )
    }

    // Get detailed price entries for this product
    // Include all entries, even those with NULL prices (upcoming/out of stock)
    const priceEntriesQuery = `
      SELECT 
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
      WHERE standard_name = $1 
        AND category = $2
      ORDER BY 
        CASE WHEN price_bdt IS NOT NULL AND price_bdt > 0 THEN 0 ELSE 1 END,
        CASE WHEN price_bdt IS NULL THEN 1 ELSE 0 END,
        price_bdt ASC
    `
    
    const priceEntries = await db.query(priceEntriesQuery, [productId, category])

    await db.close()

    const vendors = new Set<string>()
    const images = new Set<string>()
    priceEntries.forEach((entry: any) => {
      if (entry.vendor_name) vendors.add(entry.vendor_name)
      if (entry.image_url) images.add(entry.image_url)
    })

    const productData = {
      id: product.standard_name,
      standard_name: product.standard_name,
      brand: product.brand,
      min_price: parseFloat(product.min_price),
      max_price: parseFloat(product.max_price),
      avg_price: parseFloat(product.avg_price),
      vendor_count: parseInt(product.vendor_count),
      total_listings: parseInt(product.total_listings),
      vendors: Array.from(vendors),
      images: Array.from(images),
      price_entries: priceEntries.map((entry: any) => ({
        id: entry.id,
        vendor_name: entry.vendor_name,
        raw_name: entry.raw_name,
        price_bdt: entry.price_bdt,
        availability_status: entry.availability_status,
        product_url: entry.product_url,
        image_url: entry.image_url,
        scraped_at: entry.scraped_at,
        description: entry.description
      })),
      category: category
    }

    return NextResponse.json(productData)
  } catch (error) {
    console.error('Error fetching product:', error)
    return NextResponse.json(
      { error: 'Failed to fetch product' },
      { status: 500 }
    )
  }
}

