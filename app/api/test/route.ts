import { NextResponse } from 'next/server'
import sqlite3 from 'sqlite3'
import { promisify } from 'util'
import path from 'path'

export async function GET() {
  try {
    const dbPath = path.join(process.cwd(), 'prisma', 'buysmarter.db')
    
    const db = new sqlite3.Database(dbPath)
    const run = promisify(db.run.bind(db))
    const get = promisify(db.get.bind(db))
    const all = promisify(db.all.bind(db))

    // Test connection
    const count = await get('SELECT COUNT(*) as count FROM master_products')
    
    // Get a sample product
    const sampleProduct = await get(`
      SELECT productId, standardName, brand, category, currentCheapestPrice 
      FROM master_products 
      LIMIT 1
    `)

    db.close()

    return NextResponse.json({
      success: true,
      message: 'Database connection successful',
      totalProducts: count.count,
      sampleProduct
    })

  } catch (error) {
    console.error('Database test error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Database connection failed'
      },
      { status: 500 }
    )
  }
}
