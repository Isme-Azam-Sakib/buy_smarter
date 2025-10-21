import { NextResponse } from 'next/server'
import sqlite3 from 'sqlite3'
import { promisify } from 'util'
import path from 'path'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const productId = decodeURIComponent(params.id)
    
    const dbPath = path.join(process.cwd(), 'cpu_products.db')
    const db = new sqlite3.Database(dbPath)

    // Get the specific product with all its price entries
    const productQuery = `
      SELECT 
        standard_name,
        brand,
        MIN(price_bdt) as min_price,
        MAX(price_bdt) as max_price,
        AVG(price_bdt) as avg_price,
        COUNT(DISTINCT vendor_name) as vendor_count,
        COUNT(*) as total_listings,
        GROUP_CONCAT(DISTINCT vendor_name) as vendors,
        GROUP_CONCAT(DISTINCT image_url) as images
      FROM cpu_products 
      WHERE standard_name = ? 
        AND price_bdt IS NOT NULL 
        AND price_bdt > 0
      GROUP BY standard_name, brand
    `
    
    const product = await new Promise((resolve, reject) => {
      db.get(productQuery, [productId], (err, row) => {
        if (err) reject(err)
        else resolve(row)
      })
    }) as any

    if (!product) {
      db.close()
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
      WHERE standard_name = ? AND price_bdt IS NOT NULL AND price_bdt > 0
      ORDER BY price_bdt ASC
    `
    
    const priceEntries = await new Promise((resolve, reject) => {
      db.all(priceEntriesQuery, [productId], (err: any, rows: any) => {
        if (err) reject(err)
        else resolve(rows)
      })
    }) as any[]

    db.close()

    const productData = {
      id: product.standard_name,
      standard_name: product.standard_name,
      brand: product.brand,
      min_price: product.min_price,
      max_price: product.max_price,
      avg_price: Math.round(product.avg_price * 100) / 100,
      vendor_count: product.vendor_count,
      total_listings: product.total_listings,
      vendors: product.vendors.split(','),
      images: product.images ? product.images.split(',').filter((img: string) => img) : [],
      price_entries: priceEntries.map(entry => ({
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
    console.error('Error fetching CPU product:', error)
    return NextResponse.json(
      { error: 'Failed to fetch CPU product' },
      { status: 500 }
    )
  }
}
