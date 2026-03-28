import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getVendorByAdminUserId } from '@/lib/vendor-db'
import { getDatabase } from '@/lib/database'
import { hasPermission } from '@/lib/admin-permissions'

const DEFAULT_LIMIT = 25
const MAX_LIMIT = 100

export async function GET(request: NextRequest) {
  const session = await requireAdmin()
  const url = new URL(request.url)
  const page = Math.max(Number(url.searchParams.get('page') || '1'), 1)
  const requestedLimit = Number(url.searchParams.get('limit') || DEFAULT_LIMIT)
  const limit = Math.min(Math.max(requestedLimit, 1), MAX_LIMIT)
  const offset = (page - 1) * limit
  const search = (url.searchParams.get('search') || '').trim()
  const vendorFilter = (url.searchParams.get('vendor') || '').trim()
  const categoryFilter = (url.searchParams.get('category') || '').trim()
  const brandFilter = (url.searchParams.get('brand') || '').trim()
  const availability = (url.searchParams.get('availability') || '').trim()
  const productFilter = (url.searchParams.get('productFilter') || '').trim()
  const vendorColumnFilter = (url.searchParams.get('vendorColumnFilter') || '').trim()
  const categoryColumnFilter = (url.searchParams.get('categoryColumnFilter') || '').trim()
  const priceColumnFilter = (url.searchParams.get('priceColumnFilter') || '').trim()
  const statusColumnFilter = (url.searchParams.get('statusColumnFilter') || '').trim()
  const updatedColumnFilter = (url.searchParams.get('updatedColumnFilter') || '').trim()
  const sortBy = url.searchParams.get('sortBy') || 'updated_at'
  const sortOrder = (url.searchParams.get('sortOrder') || 'desc').toUpperCase() === 'ASC' ? 'ASC' : 'DESC'
  const minPrice = Number(url.searchParams.get('minPrice') || '0')
  const maxPriceParam = url.searchParams.get('maxPrice')
  const maxPrice = maxPriceParam ? Number(maxPriceParam) : null

  const db = await getDatabase()
  try {
    const filters: string[] = []
    const params: any[] = []

    // General search (searches in standard_name, raw_name, brand)
    if (search) {
      filters.push('(standard_name LIKE ? OR raw_name LIKE ? OR brand LIKE ?)')
      const term = `%${search}%`
      params.push(term, term, term)
    }

    // Product column filter (searches in standard_name, raw_name, brand)
    if (productFilter) {
      filters.push('(standard_name LIKE ? OR raw_name LIKE ? OR brand LIKE ?)')
      const term = `%${productFilter}%`
      params.push(term, term, term)
    }

    // Vendor column filter (LIKE search for partial matching)
    if (vendorColumnFilter) {
      filters.push('vendor_name LIKE ?')
      params.push(`%${vendorColumnFilter}%`)
    }

    // Category column filter (LIKE search for partial matching)
    if (categoryColumnFilter) {
      filters.push('category LIKE ?')
      params.push(`%${categoryColumnFilter}%`)
    }

    // Price column filter (numeric comparison)
    if (priceColumnFilter) {
      const priceValue = Number(priceColumnFilter)
      if (!Number.isNaN(priceValue) && priceValue > 0) {
        filters.push('price_bdt = ?')
        params.push(priceValue)
      }
    }

    // Status column filter (LIKE search for partial matching)
    if (statusColumnFilter) {
      filters.push('availability_status LIKE ?')
      params.push(`%${statusColumnFilter}%`)
    }

    // Updated column filter (searches in updated_at as string)
    if (updatedColumnFilter) {
      filters.push('updated_at LIKE ?')
      params.push(`%${updatedColumnFilter}%`)
    }

    // Legacy filters (exact matches from dropdowns)
    if (categoryFilter) {
      filters.push('category = ?')
      params.push(categoryFilter)
    }

    if (brandFilter) {
      filters.push('brand = ?')
      params.push(brandFilter)
    }

    if (availability) {
      filters.push('availability_status = ?')
      params.push(availability)
    }

    if (!Number.isNaN(minPrice) && minPrice > 0) {
      filters.push('price_bdt >= ?')
      params.push(minPrice)
    }

    if (maxPrice !== null && !Number.isNaN(maxPrice) && maxPrice > 0) {
      filters.push('price_bdt <= ?')
      params.push(maxPrice)
    }

    let vendorNameFromSession: string | null = null
    if (session.role === 'vendor') {
      // Check if vendor has managed_vendor_name assigned
      // If yes, they can only see products from that vendor store
      // If no, they see products from their own vendor_name
      if (session.managedVendorName) {
        vendorNameFromSession = session.managedVendorName
      } else {
        const vendorRecord = await getVendorByAdminUserId(session.userId)
        vendorNameFromSession = vendorRecord?.vendor_name || null
      }
      if (vendorNameFromSession) {
        filters.push('vendor_name = ?')
        params.push(vendorNameFromSession)
      }
    } else if (vendorFilter) {
      filters.push('vendor_name = ?')
      params.push(vendorFilter)
    }

    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : ''

    const [countResult] = await db.query(
      `SELECT COUNT(*) as count FROM all_products ${whereClause}`,
      params
    )

    const orderableColumns = new Set([
      'price_bdt',
      'updated_at',
      'vendor_name',
      'brand',
    ])
    const orderColumn = orderableColumns.has(sortBy) ? sortBy : 'updated_at'

    const data = await db.query(
      `
        SELECT 
          id, 
          standard_name, 
          brand, 
          vendor_name, 
          price_bdt, 
          availability_status, 
          category, 
          updated_at,
          image_url
        FROM all_products
        ${whereClause ? whereClause + ' AND id IS NOT NULL' : 'WHERE id IS NOT NULL'}
        ORDER BY ${orderColumn} ${sortOrder}
        LIMIT ? OFFSET ?
      `,
      [...params, limit, offset]
    )

    const total = Number(countResult?.count || 0)
    const vendorOptions = await db.query(
      `SELECT DISTINCT vendor_name FROM all_products ORDER BY vendor_name LIMIT 200`
    )
    const categoryOptions = await db.query(
      `SELECT DISTINCT category FROM all_products ORDER BY category LIMIT 200`
    )
    const brandOptions = await db.query(
      `SELECT DISTINCT brand FROM all_products ORDER BY brand LIMIT 200`
    )
    const availabilityOptions = await db.query(
      `SELECT DISTINCT availability_status FROM all_products ORDER BY availability_status`
    )

    return NextResponse.json({
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      filterOptions: {
        vendors: (vendorOptions || []).map((row: any) => row.vendor_name).filter(Boolean),
        categories: (categoryOptions || []).map((row: any) => row.category).filter(Boolean),
        brands: (brandOptions || []).map((row: any) => row.brand).filter(Boolean),
        availability: (availabilityOptions || [])
          .map((row: any) => row.availability_status)
          .filter(Boolean),
      },
      filters: {
        search,
        vendor: vendorFilter,
        category: categoryFilter,
        brand: brandFilter,
        availability,
        minPrice,
        maxPrice,
        sortBy: orderColumn,
        sortOrder,
      },
    })
  } catch (error) {
    console.error('Admin products list error', error)
    return NextResponse.json({ error: 'Unable to fetch products' }, { status: 500 })
  } finally {
    await db.close()
  }
}

export async function POST(request: NextRequest) {
  const session = await requireAdmin()
  if (!hasPermission(session, 'products.manual') && !hasPermission(session, 'products')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const body = await request.json()
  
  if (session.role === 'vendor') {
    // If vendor has managed_vendor_name, use that; otherwise use their own vendor_name
    if (session.managedVendorName) {
      body.vendor_name = session.managedVendorName
    } else {
      const vendorRecord = await getVendorByAdminUserId(session.userId)
      if (!vendorRecord) {
        return NextResponse.json({ error: 'Vendor record missing' }, { status: 400 })
      }
      body.vendor_name = vendorRecord.vendor_name
    }
  }
  const requiredFields = ['vendor_name', 'category', 'standard_name', 'brand', 'price_bdt', 'availability_status']
  for (const field of requiredFields) {
    if (!body[field]) {
      return NextResponse.json({ error: `${field} is required` }, { status: 400 })
    }
  }

  const db = await getDatabase()
  try {
    const now = new Date().toISOString()
    // Tokenized name is the same as standard_name, just split into words
    const { extractTokenizedName } = await import('@/lib/tokenize-name')
    const tokenized_name = body.standard_name 
      ? extractTokenizedName(body.standard_name, body.category || 'processor')
      : ''
    const result = await db.run(`
      INSERT INTO all_products (
        vendor_name, category, raw_name, price_bdt, availability_status,
        product_url, image_url, currency, description, scraped_at,
        created_at, updated_at, standard_name, brand, tokenized_name,
        scrape_source, standard_name_source
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
    `, [
      body.vendor_name,
      body.category,
      body.raw_name || body.standard_name,
      body.price_bdt,
      body.availability_status,
      body.product_url || null,
      body.image_url || null,
      body.currency || 'BDT',
      body.description || null,
      now,
      now,
      now,
      body.standard_name,
      body.brand,
      tokenized_name,
      'manual',
      'manual',
    ])
    
    console.log('Insert result:', result)
    
    // Verify the product was created with a valid ID
    const newId = result?.lastID
    if (!newId) {
      console.error('Product was inserted but no ID was returned')
      // Try to fetch the last inserted ID
      const lastRow = await db.get('SELECT last_insert_rowid() as id')
      const fallbackId = lastRow?.id
      console.log('Fallback lastID from last_insert_rowid():', fallbackId)
      return NextResponse.json({ success: true, id: fallbackId || null }, { status: 201 })
    }
    
    return NextResponse.json({ success: true, id: newId }, { status: 201 })
  } catch (error) {
    console.error('Admin product create error', error)
    return NextResponse.json({ error: 'Failed to save product' }, { status: 500 })
  } finally {
    await db.close()
  }
}

