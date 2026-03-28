import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getDatabase } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    const session = await requireAdmin()
    
    // Only vendors can access this endpoint
    if (session.role !== 'vendor') {
      return NextResponse.json(
        { error: 'Unauthorized - Vendor access only' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const vendorName = searchParams.get('vendorName')

    if (!vendorName) {
      return NextResponse.json(
        { error: 'Vendor name is required' },
        { status: 400 }
      )
    }

    const db = await getDatabase()

    // Get total products for this vendor
    const totalProducts = await db.get(
      'SELECT COUNT(*) as count FROM all_products WHERE vendor_name = ?',
      [vendorName]
    ) as { count: number } | undefined

    return NextResponse.json({
      totalProducts: totalProducts?.count || 0,
      vendorName,
    })
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Vendor stats error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

