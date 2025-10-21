import { NextResponse } from 'next/server'
import { getDatabase } from '@/lib/database'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const brand = searchParams.get('brand')
    const limit = parseInt(searchParams.get('limit') || '50')
    const page = parseInt(searchParams.get('page') || '1')
    const skip = (page - 1) * limit

    const db = await getDatabase()

    // Build WHERE clause (works for both SQLite and PostgreSQL)
    let whereClause = 'WHERE 1=1'
    const params: any[] = []

    if (search) {
      whereClause += ' AND (standard_name LIKE ? OR raw_name LIKE ? OR brand LIKE ?)'
      const searchTerm = `%${search}%`
      params.push(searchTerm, searchTerm, searchTerm)
    }
    
    if (brand) {
      whereClause += ' AND brand = ?'
      params.push(brand)
    }

    // Get products with pagination
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
      ${whereClause}
      GROUP BY standard_name, brand
      ORDER BY vendor_count DESC, min_price ASC
      LIMIT ? OFFSET ?
    `

    const products = await db.query(productsQuery, [...params, limit, skip])

    // Get total count
    const countQuery = `
      SELECT COUNT(DISTINCT standard_name) as total
      FROM cpu_products 
      ${whereClause}
    `
    const countResult = await db.get(countQuery, params)
    const total = countResult.total

    // Get brands
    const brandsQuery = `
      SELECT brand, COUNT(DISTINCT standard_name) as count
      FROM cpu_products 
      WHERE price_bdt IS NOT NULL AND price_bdt > 0
      GROUP BY brand
    `
    const brands = await db.query(brandsQuery)

    await db.close()

    // Format products
    const formattedProducts = products.map((product: any) => ({
      id: product.id,
      standard_name: product.standard_name,
      brand: product.brand,
      min_price: product.min_price,
      max_price: product.max_price,
      avg_price: Math.round(product.avg_price * 100) / 100,
      vendor_count: product.vendor_count,
      total_listings: product.total_listings,
      vendors: product.vendors ? product.vendors.split(',') : [],
      images: product.images ? product.images.split(',').filter((img: string) => img) : [],
      price_entries: [] // Will be populated when needed
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
        brands: brands.map((b: any) => ({ brand: b.brand, count: b.count }))
      }
    })

  } catch (error) {
    console.error('Error fetching CPU products:', error)
    return NextResponse.json(
      { error: 'Failed to fetch CPU products' },
      { status: 500 }
    )
  }
}
