import { NextResponse } from 'next/server'
import sqlite3 from 'sqlite3'
import { promisify } from 'util'
import path from 'path'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const category = searchParams.get('category')
    const brand = searchParams.get('brand')
    const limit = parseInt(searchParams.get('limit') || '50')
    const page = parseInt(searchParams.get('page') || '1')
    const skip = (page - 1) * limit

    const dbPath = path.join(process.cwd(), 'backend', 'buysmarter.db')
    const db = new sqlite3.Database(dbPath)
    const all = promisify(db.all.bind(db))
    const get = promisify(db.get.bind(db))

    // Build WHERE clause
    let whereClause = 'WHERE 1=1'
    const params: any[] = []

    if (search) {
      whereClause += ' AND (standardName LIKE ? OR brand LIKE ? OR category LIKE ?)'
      const searchTerm = `%${search}%`
      params.push(searchTerm, searchTerm, searchTerm)
    }
    
    if (category) {
      whereClause += ' AND category = ?'
      params.push(category)
    }
    
    if (brand) {
      whereClause += ' AND brand = ?'
      params.push(brand)
    }

    // Get total count
    const countQuery = `SELECT COUNT(*) as count FROM master_products ${whereClause}`
    const countResult = await new Promise((resolve, reject) => {
      db.all(countQuery, params, (err, rows) => {
        if (err) reject(err)
        else resolve(rows)
      })
    })
    const totalCount = (countResult as any[])[0].count

    // Get products with pagination
    const productsQuery = `
      SELECT 
        productId,
        standardName,
        category,
        brand,
        currentCheapestPrice,
        keySpecsJson,
        imageUrls,
        createdAt,
        updatedAt
      FROM master_products 
      ${whereClause}
      ORDER BY standardName ASC
      LIMIT ? OFFSET ?
    `
    const products = await new Promise((resolve, reject) => {
      db.all(productsQuery, [...params, limit, skip], (err, rows) => {
        if (err) reject(err)
        else resolve(rows)
      })
    }) as any[]

    // Get price entries for each product
    const productsWithPrices = await Promise.all(products.map(async (product) => {
      const priceEntriesQuery = `
        SELECT 
          pe.id,
          pe.scrapedPrice,
          pe.availabilityStatus,
          pe.productUrl,
          pe.scrapedTimestamp,
          v.name as vendorName,
          v.website as vendorWebsite
        FROM price_entries pe
        JOIN vendors v ON pe.vendorId = v.vendorId
        WHERE pe.masterProductId = ?
        ORDER BY pe.scrapedPrice ASC
      `
      const priceEntries = await new Promise((resolve, reject) => {
        db.all(priceEntriesQuery, [product.productId], (err, rows) => {
          if (err) reject(err)
          else resolve(rows)
        })
      }) as any[]

      return {
        ...product,
        keySpecsJson: product.keySpecsJson ? JSON.parse(product.keySpecsJson) : null,
        imageUrls: product.imageUrls ? JSON.parse(product.imageUrls) : [],
        priceEntries: priceEntries.map(entry => ({
          id: entry.id,
          scrapedPrice: entry.scrapedPrice,
          availabilityStatus: entry.availabilityStatus,
          productUrl: entry.productUrl,
          scrapedTimestamp: entry.scrapedTimestamp,
          vendor: {
            name: entry.vendorName,
            website: entry.vendorWebsite
          }
        }))
      }
    }))

    // Get category and brand statistics
    const categoryStatsQuery = `
      SELECT category, COUNT(*) as count 
      FROM master_products 
      GROUP BY category 
      ORDER BY count DESC
    `
    const categoryStats = await new Promise((resolve, reject) => {
      db.all(categoryStatsQuery, [], (err, rows) => {
        if (err) reject(err)
        else resolve(rows)
      })
    }) as any[]

    const brandStatsQuery = `
      SELECT brand, COUNT(*) as count 
      FROM master_products 
      GROUP BY brand 
      ORDER BY count DESC
    `
    const brandStats = await new Promise((resolve, reject) => {
      db.all(brandStatsQuery, [], (err, rows) => {
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
        categories: categoryStats.map(stat => ({
          category: stat.category,
          count: stat.count
        })),
        brands: brandStats.map(stat => ({
          brand: stat.brand,
          count: stat.count
        }))
      }
    })

  } catch (error) {
    console.error('Error fetching products:', error)
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    )
  }
}
