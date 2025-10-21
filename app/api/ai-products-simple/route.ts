import { NextResponse } from 'next/server'
import sqlite3 from 'sqlite3'
import { open } from 'sqlite'
import path from 'path'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '12')
    const search = searchParams.get('search') || ''
    const brand = searchParams.get('brand') || ''

    const dbPath = path.join(process.cwd(), 'cpu_products.db')
    const db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })

    // Get products grouped by standard_name (simple grouping)
    const productsQuery = `
      SELECT 
        standard_name as id,
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
      WHERE price_bdt IS NOT NULL AND price_bdt > 0
      GROUP BY standard_name, brand
      ORDER BY vendor_count DESC, min_price ASC
      LIMIT ? OFFSET ?
    `

    const offset = (page - 1) * limit
    const products = await db.all(productsQuery, [limit, offset])

    // Get total count
    const countQuery = `
      SELECT COUNT(DISTINCT standard_name) as total
      FROM cpu_products 
      WHERE price_bdt IS NOT NULL AND price_bdt > 0
    `
    const countResult = await db.get(countQuery)
    const total = countResult.total

    // Get brands
    const brandsQuery = `
      SELECT brand, COUNT(DISTINCT standard_name) as count
      FROM cpu_products 
      WHERE price_bdt IS NOT NULL AND price_bdt > 0
      GROUP BY brand
    `
    const brands = await db.all(brandsQuery)

    await db.close()

    // Format products
    const formattedProducts = products.map(product => ({
      id: product.id,
      standard_name: product.standard_name,
      brand: product.brand,
      min_price: product.min_price,
      max_price: product.max_price,
      avg_price: Math.round(product.avg_price * 100) / 100,
      vendor_count: product.vendor_count,
      total_listings: product.total_listings,
      vendors: product.vendors.split(','),
      images: product.images ? product.images.split(',').filter((img: string) => img) : [],
      price_entries: [], // Will be populated when needed
      ai_confidence: 0.8 // Mock confidence for simple grouping
    }))

    return NextResponse.json({
      products: formattedProducts,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      },
      stats: {
        brands: brands.map(b => ({ brand: b.brand, count: b.count }))
      }
    })

  } catch (error) {
    console.error('Error in simple AI products API:', error)
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    )
  }
}
