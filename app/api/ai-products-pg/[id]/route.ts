import { NextResponse } from 'next/server'
import { getDatabase } from '@/lib/database'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const productId = decodeURIComponent(params.id)

    const db = await getDatabase()

    // First try to find by standard_name
    let productQuery = `
      SELECT 
        standard_name,
        brand,
        MIN(price_bdt) as min_price,
        MAX(price_bdt) as max_price,
        AVG(price_bdt) as avg_price,
        COUNT(DISTINCT vendor_name) as vendor_count,
        COUNT(*) as total_listings,
        STRING_AGG(DISTINCT vendor_name, ',') as vendors,
        STRING_AGG(DISTINCT image_url, ',') as images
      FROM cpu_products 
      WHERE standard_name = $1 
        AND price_bdt IS NOT NULL 
        AND price_bdt > 0
      GROUP BY standard_name, brand
    `
    let product = await db.get(productQuery, [productId])

    // If not found by standard_name, try to find by raw_name (for AI-grouped products)
    if (!product) {
      productQuery = `
        SELECT 
          standard_name,
          brand,
          MIN(price_bdt) as min_price,
          MAX(price_bdt) as max_price,
          AVG(price_bdt) as avg_price,
          COUNT(DISTINCT vendor_name) as vendor_count,
          COUNT(*) as total_listings,
          STRING_AGG(DISTINCT vendor_name, ',') as vendors,
          STRING_AGG(DISTINCT image_url, ',') as images
        FROM cpu_products 
        WHERE raw_name = $1 
          AND price_bdt IS NOT NULL 
          AND price_bdt > 0
        GROUP BY standard_name, brand
      `
      product = await db.get(productQuery, [productId])
    }

    if (!product) {
      await db.close()
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      )
    }

    // Get detailed price entries for this product
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
      FROM cpu_products 
      WHERE (standard_name = $1 OR raw_name = $2)
        AND price_bdt IS NOT NULL 
        AND price_bdt > 0
      ORDER BY price_bdt ASC
    `
    
    const priceEntries = await db.query(priceEntriesQuery, [product.standard_name, productId])

    await db.close()

    const productData = {
      id: product.standard_name,
      standard_name: product.standard_name,
      brand: product.brand,
      min_price: product.min_price,
      max_price: product.max_price,
      avg_price: Math.round(product.avg_price * 100) / 100,
      vendor_count: product.vendor_count,
      total_listings: product.total_listings,
      vendors: product.vendors ? product.vendors.split(',') : [],
      images: product.images ? product.images.split(',').filter((img: string) => img) : [],
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
      }))
    }

    return NextResponse.json(productData)

  } catch (error) {
    console.error('Error fetching AI CPU product details:', error)
    return NextResponse.json(
      { error: 'Failed to fetch AI CPU product details' },
      { status: 500 }
    )
  }
}
