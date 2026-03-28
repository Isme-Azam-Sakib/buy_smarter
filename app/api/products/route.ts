import { NextResponse } from 'next/server'
import { getDatabase } from '@/lib/database'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Table name can be overridden via environment variable
// Default: 'all_products' for both SQLite (local) and PostgreSQL (production)
// Note: cpu_products was a demo table and should not be used
const getDefaultTableName = () => {
  // Always use 'all_products' as default, regardless of database type
  return 'all_products'
}

const PRODUCTS_TABLE = process.env.PRODUCTS_TABLE_NAME || getDefaultTableName()
const MAX_LIMIT = 24
const DEFAULT_LIMIT = 12

interface TableInfo {
  tableName: string
  hasCategoryColumn: boolean
}

interface PriceEntry {
  id: number | string
  vendor_name: string
  raw_name: string
  price_bdt: number
  availability_status: string
  product_url: string
  image_url: string | null
  scraped_at: string
  description: string | null
}

let cachedTableInfo: TableInfo | null = null

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const category = (searchParams.get('category') || 'processor').toLowerCase()
  const brand = searchParams.get('brand')
  const search = searchParams.get('search')
  const limit = sanitizeLimit(searchParams.get('limit'))
  const page = Math.max(parseInt(searchParams.get('page') || '1', 10) || 1, 1)
  const offsetStart = (page - 1) * limit + 1
  const offsetEnd = offsetStart + limit - 1

  console.log('[Products API] Request params:', { category, brand, search, limit, page })
  
  let db
  let tableInfo
  try {
    db = await getDatabase()
    console.log('[Products API] Database connected successfully')
    
    // Resolve table info and check if category column exists
    tableInfo = resolveTableInfo()
    console.log('[Products API] Using table name:', tableInfo.tableName)
    
    // First, check if the table exists, and if not, try to find the right one
    let tableExists = false
    let actualTableName = tableInfo.tableName
    
    try {
      // Check if it's PostgreSQL
      const dbUrl = process.env.DATABASE_URL || ''
      const isPostgres = false // SQLite only
      
      if (isPostgres) {
        const tableCheckQuery = `
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = $1
          ) as exists
        `
        const tableCheck = await db.query(tableCheckQuery, [tableInfo.tableName])
        tableExists = tableCheck[0]?.exists || false
        
        if (!tableExists) {
          // Try common table names (prioritize all_products, fallback to cpu_products if needed)
          const commonTables = ['all_products', 'products', 'cpu_products']
          for (const tableName of commonTables) {
            const check = await db.query(tableCheckQuery, [tableName])
            if (check[0]?.exists) {
              actualTableName = tableName
              tableExists = true
              console.log(`[Products API] Found table: ${tableName}`)
              break
            }
          }
          
          if (!tableExists) {
            // List all available tables
            const listTablesQuery = `
              SELECT table_name 
              FROM information_schema.tables 
              WHERE table_schema = 'public' 
              AND table_type = 'BASE TABLE'
              ORDER BY table_name
            `
            const availableTables = await db.query(listTablesQuery, [])
            console.log('[Products API] Available tables:', availableTables.map((t: any) => t.table_name))
          }
        }
      } else {
        // SQLite
        const sqliteCheck = await db.query(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`, [tableInfo.tableName])
        tableExists = sqliteCheck.length > 0
        
        if (!tableExists) {
          // Try common table names for SQLite (cpu_products was a demo, use all_products)
          const commonTables = ['all_products', 'products']
          for (const tableName of commonTables) {
            const check = await db.query(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`, [tableName])
            if (check.length > 0) {
              actualTableName = tableName
              tableExists = true
              console.log(`[Products API] Found table: ${tableName}`)
              break
            }
          }
          
          if (!tableExists) {
            const allTables = await db.query(`SELECT name FROM sqlite_master WHERE type='table'`)
            console.log('[Products API] Available tables (SQLite):', allTables.map((t: any) => t.name))
          }
        }
      }
    } catch (tableCheckError) {
      console.error('[Products API] Error checking if table exists:', tableCheckError)
    }
    
    if (!tableExists) {
      await db.close()
      // Try to get available tables for better error message
      let availableTables: string[] = []
      try {
        const dbUrl = process.env.DATABASE_URL || ''
        const isPostgres = false // SQLite only
        if (isPostgres) {
          const listTablesQuery = `
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
            ORDER BY table_name
          `
          const tables = await db.query(listTablesQuery, [])
          availableTables = tables.map((t: any) => t.table_name)
        }
      } catch (e) {
        // Ignore error getting table list
      }
      
      return NextResponse.json(
        { 
          error: `Table '${tableInfo.tableName}' does not exist`,
          message: availableTables.length > 0 
            ? `Available tables: ${availableTables.join(', ')}. Set PRODUCTS_TABLE_NAME environment variable to use one of these tables.`
            : 'Please check your database configuration. Set PRODUCTS_TABLE_NAME environment variable if using a different table name.',
          availableTables
        },
        { status: 500 }
      )
    }
    
    // Update table name if we found a different one
    if (actualTableName !== tableInfo.tableName) {
      tableInfo.tableName = actualTableName
      console.log(`[Products API] Using detected table: ${actualTableName}`)
    }
    
    const hasCategoryColumn = await checkCategoryColumn(db, tableInfo.tableName)
    tableInfo.hasCategoryColumn = hasCategoryColumn
    console.log('[Products API] Table info:', tableInfo)
    console.log('[Products API] Category column exists:', hasCategoryColumn)
    
    // Check total products in table for debugging
    try {
      const totalCheckQuery = `SELECT COUNT(*) as total FROM ${tableInfo.tableName} WHERE price_bdt IS NOT NULL AND price_bdt > 0`
      const totalCheck = await db.query(totalCheckQuery, [])
      console.log('[Products API] Total products in table (with price):', totalCheck[0]?.total || 0)
      
      if (hasCategoryColumn) {
        const categoryCheckQuery = `SELECT COUNT(*) as total, category FROM ${tableInfo.tableName} WHERE price_bdt IS NOT NULL AND price_bdt > 0 GROUP BY category LIMIT 10`
        const categoryCheck = await db.query(categoryCheckQuery, [])
        console.log('[Products API] Products by category:', categoryCheck)
      }
    } catch (checkError) {
      console.error('[Products API] Error checking table data:', checkError)
    }

    const { whereClause, params } = buildWhereClause({
      category,
      brand,
      search,
      hasCategoryColumn: tableInfo.hasCategoryColumn,
    })

    console.log('[Products API] Where clause:', whereClause)
    console.log('[Products API] Query params:', params)

    const pagedQuery = `
      WITH aggregated AS (
        SELECT
          standard_name,
          brand,
          MIN(price_bdt) AS min_price,
          MAX(price_bdt) AS max_price,
          AVG(price_bdt) AS avg_price,
          COUNT(DISTINCT vendor_name) AS vendor_count,
          COUNT(*) AS total_listings
        FROM ${tableInfo.tableName}
        ${whereClause}
        GROUP BY standard_name, brand
      )
      SELECT *
      FROM aggregated
      ORDER BY vendor_count DESC, min_price ASC
      LIMIT $${params.length + 1}
      OFFSET $${params.length + 2}
    `

    console.log('[Products API] Executing query:', pagedQuery)
    const offset = (page - 1) * limit
    console.log('[Products API] Query params:', [...params, limit, offset])
    const pagedRows = await db.query(pagedQuery, [...params, limit, offset])
    console.log('[Products API] Query returned', pagedRows.length, 'rows')
    if (pagedRows.length > 0) {
      console.log('[Products API] Sample products:', pagedRows.slice(0, 3).map((r: any) => ({
        standard_name: r.standard_name,
        brand: r.brand,
        vendor_count: r.vendor_count,
        min_price: r.min_price
      })))
    }
    
    const total = await countProducts(db, tableInfo.tableName, whereClause, params)
    console.log('[Products API] Total products count:', total)
    
    // Debug: Check raw product count before grouping
    try {
      const rawCountQuery = `SELECT COUNT(*) as total FROM ${tableInfo.tableName} ${whereClause}`
      const rawCount = await db.query(rawCountQuery, params)
      console.log('[Products API] Raw product count (before grouping):', rawCount[0]?.total || 0)
      
      // Check unique standard_name count
      const uniqueCountQuery = `
        SELECT COUNT(DISTINCT standard_name) as total 
        FROM ${tableInfo.tableName} 
        ${whereClause}
      `
      const uniqueCount = await db.query(uniqueCountQuery, params)
      console.log('[Products API] Unique standard_name count:', uniqueCount[0]?.total || 0)
    } catch (debugError) {
      console.error('[Products API] Error in debug queries:', debugError)
    }

    const standardNames = pagedRows.map((row: any) => row.standard_name)
    const priceEntriesByProduct = await fetchPriceEntriesForProducts(
      db,
      tableInfo,
      category,
      standardNames
    )

    const products = pagedRows.map((row: any) =>
      mapRowToProduct(row, priceEntriesByProduct.get(row.standard_name) || [])
    )

    const brandStats = await fetchBrandStats(db, tableInfo, category)
    const totalPages = total > 0 ? Math.ceil(total / limit) : 0

    return NextResponse.json({
      products,
      pagination: {
        total,
        page,
        limit,
        totalPages,
      },
      stats: {
        brands: brandStats,
      },
      category,
    })
  } catch (error) {
    console.error('[Products API] Error fetching products:', error)
    console.error('[Products API] Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    return NextResponse.json(
      { 
        error: 'Failed to fetch products',
        details: error instanceof Error ? error.message : 'Unknown error',
        category,
        tableName: tableInfo?.tableName || 'unknown'
      },
      { status: 500 }
    )
  } finally {
    if (db) {
      await db.close()
    }
  }
}

function sanitizeLimit(rawLimit: string | null) {
  const parsed = parseInt(rawLimit || '', 10)
  if (!parsed || parsed < 1) return DEFAULT_LIMIT
  return Math.min(parsed, MAX_LIMIT)
}

async function checkCategoryColumn(db: any, tableName: string): Promise<boolean> {
  try {
    // Try to query the category column to see if it exists
    const checkQuery = `SELECT category FROM ${tableName} LIMIT 1`
    await db.query(checkQuery, [])
    return true
  } catch (error) {
    console.log('[Products API] Category column does not exist or error checking:', error)
    return false
  }
}

function resolveTableInfo(): TableInfo {
  if (cachedTableInfo) return cachedTableInfo
  // Default to assuming category column exists, but we'll check dynamically
  cachedTableInfo = { tableName: PRODUCTS_TABLE, hasCategoryColumn: true }
  return cachedTableInfo
}

interface BuildWhereClauseArgs {
  category: string
  brand: string | null
  search: string | null
  hasCategoryColumn: boolean
}

function buildWhereClause({
  category,
  brand,
  search,
  hasCategoryColumn,
}: BuildWhereClauseArgs) {
  const filters: string[] = ['price_bdt IS NOT NULL', 'price_bdt > 0']
  const params: any[] = []

  applyCategoryFilter(filters, params, category, hasCategoryColumn)

  if (search) {
    const likeValue = `%${search}%`
    const standardParam = addParam(params, likeValue)
    const rawParam = addParam(params, likeValue)
    const brandParam = addParam(params, likeValue)
    filters.push(
      `(standard_name ILIKE ${standardParam} OR raw_name ILIKE ${rawParam} OR brand ILIKE ${brandParam})`
    )
  }

  if (brand) {
    const brandParam = addParam(params, brand)
    filters.push(`brand ILIKE ${brandParam}`)
  }

  const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : ''
  return { whereClause, params }
}

function addParam(params: any[], value: any) {
  params.push(value)
  return `$${params.length}`
}

function applyCategoryFilter(
  filters: string[],
  params: any[],
  category: string,
  hasCategoryColumn: boolean
) {
  if (!category) return

  if (hasCategoryColumn) {
    const categoryParam = addParam(params, category)
    filters.push(`category = ${categoryParam}`)
    console.log('[Products API] Using category column filter:', category)
    return
  }

  const fallbackFilter = getCategoryNameFilter(category)
  if (fallbackFilter) {
    filters.push(`(${fallbackFilter})`)
    console.log('[Products API] Using name-based category filter for:', category)
  } else {
    console.log('[Products API] No category filter found for:', category, '- showing all products')
  }
}

async function countProducts(
  db: any,
  tableName: string,
  whereClause: string,
  params: any[]
) {
  const countQuery = `
    SELECT COUNT(*) AS total
    FROM (
      SELECT 1
      FROM ${tableName}
      ${whereClause}
      GROUP BY standard_name, brand
    ) sub
  `
  const result = await db.query(countQuery, params)
  return result?.[0]?.total ? Number(result[0].total) : 0
}

async function fetchPriceEntriesForProducts(
  db: any,
  tableInfo: TableInfo,
  category: string,
  standardNames: string[]
) {
  const map = new Map<string, PriceEntry[]>()
  if (!standardNames.length) {
    return map
  }

  const priceFilters = ['price_bdt IS NOT NULL', 'price_bdt > 0']
  const params: any[] = []
  applyCategoryFilter(priceFilters, params, category, tableInfo.hasCategoryColumn)

  const namePlaceholders = standardNames
    .map((name) => addParam(params, name))
    .join(', ')
  priceFilters.push(`standard_name IN (${namePlaceholders})`)

  const whereClause = `WHERE ${priceFilters.join(' AND ')}`

  const priceQuery = `
    SELECT
      standard_name,
      id,
      vendor_name,
      raw_name,
      price_bdt,
      availability_status,
      product_url,
      image_url,
      scraped_at,
      description
    FROM ${tableInfo.tableName}
    ${whereClause}
    ORDER BY price_bdt ASC
  `

    const priceRows = await db.query(priceQuery, params)
    console.log(`[Products API] Fetched ${priceRows.length} price entries for ${standardNames.length} products`)
    
    for (const row of priceRows) {
      const entry: PriceEntry = {
        id: row.id,
        vendor_name: row.vendor_name,
        raw_name: row.raw_name,
        price_bdt: Number(row.price_bdt),
        availability_status: row.availability_status,
        product_url: row.product_url,
        image_url: row.image_url,
        scraped_at: row.scraped_at,
        description: row.description,
      }
      const list = map.get(row.standard_name) || []
      list.push(entry)
      map.set(row.standard_name, list)
    }
    
    // Debug: Log sample data
    if (standardNames.length > 0 && map.size > 0) {
      const firstProductName = standardNames[0]
      const firstProductEntries = map.get(firstProductName) || []
      console.log(`[Products API] Sample product "${firstProductName}": ${firstProductEntries.length} entries, first raw_name: ${firstProductEntries[0]?.raw_name || 'N/A'}`)
    }
    
    return map
}

async function fetchBrandStats(db: any, tableInfo: TableInfo, category: string) {
  const filters: string[] = ['price_bdt IS NOT NULL', 'price_bdt > 0']
  const params: any[] = []
  applyCategoryFilter(filters, params, category, tableInfo.hasCategoryColumn)
  const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : ''

  const brandQuery = `
    WITH base AS (
      SELECT brand
      FROM ${tableInfo.tableName}
      ${whereClause}
      GROUP BY standard_name, brand
    )
    SELECT brand, COUNT(*) AS count
    FROM base
    GROUP BY brand
    ORDER BY count DESC
  `

  const rows = await db.query(brandQuery, params)
  return rows.map((row: any) => ({
    brand: row.brand,
    count: Number(row.count),
  }))
}

function mapRowToProduct(row: any, priceEntries: PriceEntry[]) {
  const uniqueVendors = Array.from(new Set(priceEntries.map((entry) => entry.vendor_name)))
  const uniqueImages = Array.from(
    new Set(priceEntries.map((entry) => entry.image_url).filter(Boolean))
  )

  return {
    id: row.standard_name,
    standard_name: row.standard_name,
    brand: row.brand,
    min_price: Number(row.min_price),
    max_price: Number(row.max_price),
    avg_price: Number(row.avg_price),
    vendor_count: Number(row.vendor_count),
    total_listings: Number(row.total_listings),
    vendors: uniqueVendors,
    images: uniqueImages,
    price_entries: priceEntries,
  }
}

function getCategoryNameFilter(category: string): string | null {
  const categoryLower = category.toLowerCase()

  if (categoryLower === 'processor' || categoryLower === 'cpu') {
    return `(raw_name LIKE '%core i%' OR raw_name LIKE '%ryzen%' OR raw_name LIKE '%pentium%' OR raw_name LIKE '%celeron%' OR raw_name LIKE '%athlon%' OR raw_name LIKE '%threadripper%' OR raw_name LIKE '%processor%' OR standard_name LIKE '%core i%' OR standard_name LIKE '%ryzen%')`
  }

  if (categoryLower === 'graphics-card' || categoryLower === 'gpu') {
    return `(raw_name LIKE '%rtx%' OR raw_name LIKE '%gtx%' OR raw_name LIKE '%rx %' OR raw_name LIKE '%radeon%' OR raw_name LIKE '%geforce%' OR raw_name LIKE '%graphics card%' OR raw_name LIKE '%gpu%' OR standard_name LIKE '%rtx%' OR standard_name LIKE '%gtx%')`
  }

  if (categoryLower === 'ram' || categoryLower === 'memory') {
    return `(raw_name LIKE '%ddr3%' OR raw_name LIKE '%ddr4%' OR raw_name LIKE '%ddr5%' OR raw_name LIKE '%memory%' OR raw_name LIKE '% ram%' OR raw_name LIKE '%ram %' OR standard_name LIKE '%ddr%' OR standard_name LIKE '%memory%')`
  }

  if (categoryLower === 'ssd' || categoryLower === 'storage') {
    return `(raw_name LIKE '%nvme%' OR raw_name LIKE '%m.2%' OR raw_name LIKE '%m2%' OR raw_name LIKE '%sata%' OR raw_name LIKE '% ssd%' OR raw_name LIKE '%solid state%' OR standard_name LIKE '%ssd%' OR standard_name LIKE '%nvme%')`
  }

  if (categoryLower === 'motherboard' || categoryLower === 'mobo') {
    return `(raw_name LIKE '%motherboard%' OR raw_name LIKE '%mainboard%' OR raw_name LIKE '%mobo%' OR raw_name LIKE '%atx%' OR raw_name LIKE '%micro atx%' OR raw_name LIKE '%mini itx%' OR standard_name LIKE '%motherboard%')`
  }

  if (categoryLower === 'power-supply' || categoryLower === 'psu') {
    return `(raw_name LIKE '%power supply%' OR raw_name LIKE '% psu%' OR raw_name LIKE '%psu %' OR raw_name LIKE '%80+%' OR raw_name LIKE '%80 plus%' OR raw_name LIKE '%watt%' OR standard_name LIKE '%power supply%' OR standard_name LIKE '%psu%')`
  }

  if (categoryLower === 'cpu-cooler' || categoryLower === 'cooler') {
    return `(raw_name LIKE '%cpu cooler%' OR raw_name LIKE '%cooler%' OR raw_name LIKE '%aio%' OR raw_name LIKE '%all-in-one%' OR raw_name LIKE '%liquid cooler%' OR raw_name LIKE '%air cooler%' OR standard_name LIKE '%cooler%')`
  }

  return null
}

