import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getDatabase } from '@/lib/database'

export async function GET() {
  try {
    await requireAdmin()
    const db = await getDatabase()

    // Total products
    const totalProducts = await db.get(
      'SELECT COUNT(*) as count FROM all_products'
    ) as { count: number } | undefined

    // Products by vendor
    const byVendor = await db.all(
      `SELECT vendor_name, COUNT(*) as count 
       FROM all_products 
       GROUP BY vendor_name 
       ORDER BY count DESC`
    ) as { vendor_name: string; count: number }[]

    // Products by category
    const byCategory = await db.all(
      `SELECT category, COUNT(*) as count 
       FROM all_products 
       GROUP BY category 
       ORDER BY count DESC`
    ) as { category: string; count: number }[]

    // Products by brand
    const byBrand = await db.all(
      `SELECT brand, COUNT(*) as count 
       FROM all_products 
       WHERE brand IS NOT NULL AND brand != ''
       GROUP BY brand 
       ORDER BY count DESC 
       LIMIT 20`
    ) as { brand: string; count: number }[]

    // Price statistics
    const priceStats = await db.get(
      `SELECT 
        MIN(price_bdt) as min_price,
        MAX(price_bdt) as max_price,
        AVG(price_bdt) as avg_price,
        SUM(price_bdt) as total_value
       FROM all_products 
       WHERE price_bdt IS NOT NULL AND price_bdt > 0`
    ) as {
      min_price: number
      max_price: number
      avg_price: number
      total_value: number
    } | undefined

    // Availability statistics
    const availabilityStats = await db.all(
      `SELECT availability_status, COUNT(*) as count 
       FROM all_products 
       GROUP BY availability_status 
       ORDER BY count DESC`
    ) as { availability_status: string; count: number }[]

    // Recently updated products
    const recentlyUpdated = await db.all(
      `SELECT id, raw_name, vendor_name, price_bdt, updated_at 
       FROM all_products 
       WHERE updated_at IS NOT NULL 
       ORDER BY updated_at DESC 
       LIMIT 10`
    ) as {
      id: number
      raw_name: string
      vendor_name: string
      price_bdt: number
      updated_at: string
    }[]

    // Products with images
    const withImages = await db.get(
      `SELECT COUNT(*) as count 
       FROM all_products 
       WHERE image_url IS NOT NULL AND image_url != ''`
    ) as { count: number } | undefined

    // Products without images
    const withoutImages = await db.get(
      `SELECT COUNT(*) as count 
       FROM all_products 
       WHERE image_url IS NULL OR image_url = ''`
    ) as { count: number } | undefined

    return NextResponse.json({
      totalProducts: totalProducts?.count || 0,
      byVendor,
      byCategory,
      byBrand,
      priceStats: priceStats || {
        min_price: 0,
        max_price: 0,
        avg_price: 0,
        total_value: 0,
      },
      availabilityStats,
      recentlyUpdated,
      imageStats: {
        withImages: withImages?.count || 0,
        withoutImages: withoutImages?.count || 0,
      },
    })
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Stats error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

