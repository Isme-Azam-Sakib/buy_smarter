import { NextResponse } from 'next/server'
import sqlite3 from 'sqlite3'
import { promisify } from 'util'
import path from 'path'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const productId = parseInt(params.id)
    
    if (isNaN(productId)) {
      return NextResponse.json(
        { error: 'Invalid product ID' },
        { status: 400 }
      )
    }

    const dbPath = path.join(process.cwd(), 'backend', 'buysmarter.db')
    const db = new sqlite3.Database(dbPath)
    const all = promisify(db.all.bind(db)) as (sql: string, params?: any[]) => Promise<any[]>
    const get = promisify(db.get.bind(db)) as (sql: string, params?: any[]) => Promise<any>

    // Get product details
    const product = await get(`
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
      WHERE productId = ?
    `, [productId]) as any

    if (!product) {
      db.close()
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      )
    }

    // Get all price entries for this product
    const priceEntries = await all(`
      SELECT 
        pe.id,
        pe.scrapedPrice,
        pe.availabilityStatus,
        pe.productUrl,
        pe.scrapedTimestamp,
        v.name as vendorName,
        v.website as vendorWebsite,
        v.logoUrl as vendorLogoUrl
      FROM price_entries pe
      JOIN vendors v ON pe.vendorId = v.vendorId
      WHERE pe.masterProductId = ?
      ORDER BY pe.scrapedPrice ASC
    `, [productId]) as any[]

    // Get related products (same category, different products)
    const relatedProducts = await all(`
      SELECT 
        productId,
        standardName,
        brand,
        currentCheapestPrice,
        imageUrls
      FROM master_products 
      WHERE category = ? AND productId != ?
      ORDER BY currentCheapestPrice ASC
      LIMIT 6
    `, [product.category, productId]) as any[]

    db.close()

    // Parse JSON fields
    const productWithDetails = {
      ...product,
      keySpecsJson: product.keySpecsJson ? JSON.parse(product.keySpecsJson) : {},
      imageUrls: product.imageUrls ? JSON.parse(product.imageUrls) : [],
      priceEntries: priceEntries.map((entry: any) => ({
        id: entry.id,
        scrapedPrice: entry.scrapedPrice,
        availabilityStatus: entry.availabilityStatus,
        productUrl: entry.productUrl,
        scrapedTimestamp: entry.scrapedTimestamp,
        vendor: {
          name: entry.vendorName,
          website: entry.vendorWebsite,
          logoUrl: entry.vendorLogoUrl
        }
      })),
      relatedProducts: relatedProducts.map((rel: any) => ({
        ...rel,
        imageUrls: rel.imageUrls ? JSON.parse(rel.imageUrls) : []
      }))
    }

    return NextResponse.json(productWithDetails)

  } catch (error) {
    console.error('Error fetching product details:', error)
    return NextResponse.json(
      { error: 'Failed to fetch product details' },
      { status: 500 }
    )
  }
}
