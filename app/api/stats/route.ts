import { NextResponse } from 'next/server'
import sqlite3 from 'sqlite3'
import { promisify } from 'util'
import path from 'path'

export async function GET() {
  try {
    const dbPath = path.join(process.cwd(), 'backend', 'buysmarter.db')
    const db = new sqlite3.Database(dbPath)
    const all = promisify(db.all.bind(db))
    const get = promisify(db.get.bind(db))

    // Get total counts
    const totalProducts = await get('SELECT COUNT(*) as count FROM master_products')
    const totalVendors = await get('SELECT COUNT(*) as count FROM vendors')
    const totalPriceEntries = await get('SELECT COUNT(*) as count FROM price_entries')

    // Get category stats
    const categoryStats = await all(`
      SELECT category, COUNT(*) as count 
      FROM master_products 
      GROUP BY category 
      ORDER BY count DESC
    `)

    // Get brand stats
    const brandStats = await all(`
      SELECT brand, COUNT(*) as count 
      FROM master_products 
      GROUP BY brand 
      ORDER BY count DESC 
      LIMIT 5
    `)

    db.close()

    return NextResponse.json({
      totalProducts: totalProducts.count,
      totalVendors: totalVendors.count,
      totalPriceEntries: totalPriceEntries.count,
      topCategories: categoryStats.map(stat => ({
        category: stat.category,
        count: stat.count
      })),
      topBrands: brandStats.map(stat => ({
        brand: stat.brand,
        count: stat.count
      }))
    })

  } catch (error) {
    console.error('Error fetching stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch statistics' },
      { status: 500 }
    )
  }
}
