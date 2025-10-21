import { NextResponse } from 'next/server'
import sqlite3 from 'sqlite3'
import { promisify } from 'util'
import path from 'path'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const brand = searchParams.get('brand')
    const limit = parseInt(searchParams.get('limit') || '50')
    const page = parseInt(searchParams.get('page') || '1')
    const skip = (page - 1) * limit

    const dbPath = path.join(process.cwd(), 'cpu_products.db')
    const db = new sqlite3.Database(dbPath)
    const all = promisify(db.all.bind(db))

    // Build WHERE clause
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

    // Get total count
    const countQuery = `SELECT COUNT(DISTINCT standard_name) as count FROM cpu_products ${whereClause}`
    const countResult = await new Promise((resolve, reject) => {
      db.all(countQuery, params, (err: any, rows: any) => {
        if (err) reject(err)
        else resolve(rows)
      })
    })
    const totalCount = (countResult as any[])[0].count

    // Get unique CPU products with their best prices
    const productsQuery = `
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
      ${whereClause}
      AND price_bdt IS NOT NULL 
      AND price_bdt > 0
      GROUP BY standard_name, brand
      ORDER BY vendor_count DESC, min_price ASC
      LIMIT ? OFFSET ?
    `
    const products = await new Promise((resolve, reject) => {
      db.all(productsQuery, [...params, limit, skip], (err: any, rows: any) => {
        if (err) reject(err)
        else resolve(rows)
      })
    }) as any[]

    // Get detailed price entries for each product
    const productsWithPrices = await Promise.all(products.map(async (product) => {
      const priceEntriesQuery = `
        SELECT 
          id,
          vendor_name,
          raw_name,
          price_bdt,
          availability_status,
          product_url,
          image_url,
          scraped_at
        FROM cpu_products 
        WHERE standard_name = ? AND price_bdt IS NOT NULL AND price_bdt > 0
        ORDER BY price_bdt ASC
      `
      const priceEntries = await new Promise((resolve, reject) => {
        db.all(priceEntriesQuery, [product.standard_name], (err: any, rows: any) => {
          if (err) reject(err)
          else resolve(rows)
        })
      }) as any[]

      return {
        id: product.standard_name, // Use standard_name as unique ID
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
          scraped_at: entry.scraped_at
        }))
      }
    }))

    // Get brand statistics
    const brandStatsQuery = `
      SELECT brand, COUNT(DISTINCT standard_name) as count 
      FROM cpu_products 
      WHERE price_bdt IS NOT NULL AND price_bdt > 0
      GROUP BY brand 
      ORDER BY count DESC
    `
    const brandStats = await new Promise((resolve, reject) => {
      db.all(brandStatsQuery, [], (err: any, rows: any) => {
        if (err) reject(err)
        else resolve(rows)
      })
    }) as any[]

    db.close()

    return NextResponse.json({
      products: productsWithPrices,
      pagination: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit)
      },
      stats: {
        brands: brandStats.map(stat => ({
          brand: stat.brand,
          count: stat.count
        }))
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
