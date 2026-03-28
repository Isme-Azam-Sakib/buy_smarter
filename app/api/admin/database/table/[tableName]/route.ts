import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getDatabase } from '@/lib/database'

export async function GET(
  request: NextRequest,
  { params }: { params: { tableName: string } }
) {
  try {
    await requireAdmin()
    const db = await getDatabase()
    const tableName = decodeURIComponent(params.tableName)
    
    const url = new URL(request.url)
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = parseInt(url.searchParams.get('limit') || '50')
    const search = url.searchParams.get('search') || ''
    const sortBy = url.searchParams.get('sortBy') || ''
    const sortOrder = url.searchParams.get('sortOrder') || 'asc'
    const offset = (page - 1) * limit
    
    const isPostgres = false // SQLite only
    
    // Validate table name (prevent SQL injection)
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
      return NextResponse.json(
        { error: 'Invalid table name' },
        { status: 400 }
      )
    }
    
    // Get table schema
    let columns: any[] = []
    if (isPostgres) {
      const schemaResult = await db.query(`
        SELECT 
          column_name,
          data_type,
          is_nullable,
          column_default
        FROM information_schema.columns
        WHERE table_name = $1
        ORDER BY ordinal_position
      `, [tableName])
      columns = schemaResult
    } else {
      // SQLite - use parameterized query for table name
      const schemaResult = await db.query(`PRAGMA table_info("${tableName}")`)
      columns = schemaResult.map((col: any) => ({
        column_name: col.name,
        data_type: col.type,
        is_nullable: col.notnull === 0 ? 'YES' : 'NO',
        column_default: col.dflt_value,
      }))
    }
    
    // Build query with search
    let whereClause = ''
    let queryParams: any[] = []
    const searchPattern = `%${search}%`
    
    if (search) {
      // Search across all text columns
      const textColumns = columns
        .filter((col: any) => {
          const dataType = col.data_type?.toLowerCase() || ''
          return ['text', 'varchar', 'character varying', 'string', 'char'].some(t => 
            dataType.includes(t)
          ) || !dataType.includes('int') && !dataType.includes('real') && !dataType.includes('numeric')
        })
        .map((col: any) => col.column_name)
      
      if (textColumns.length > 0) {
        if (isPostgres) {
          whereClause = 'WHERE ' + textColumns
            .map((col, idx) => `${col}::text ILIKE $${idx + 1}`)
            .join(' OR ')
          queryParams = textColumns.map(() => searchPattern)
        } else {
          whereClause = 'WHERE ' + textColumns
            .map(col => `${col} LIKE ?`)
            .join(' OR ')
          queryParams = textColumns.map(() => searchPattern)
        }
      }
    }
    
    // Get total count
    let totalCount = 0
    if (isPostgres) {
      const countResult = await db.query(
        `SELECT COUNT(*) as count FROM "${tableName}" ${whereClause}`,
        queryParams
      )
      totalCount = parseInt(countResult[0]?.count || '0')
    } else {
      const countResult = await db.query(
        `SELECT COUNT(*) as count FROM "${tableName}" ${whereClause}`,
        queryParams
      )
      totalCount = countResult[0]?.count || 0
    }
    
    // Build ORDER BY clause
    let orderByClause = ''
    if (sortBy) {
      // Validate sortBy column name (prevent SQL injection)
      const validColumn = columns.find((col: any) => col.column_name === sortBy)
      if (validColumn) {
        const validSortOrder = sortOrder.toLowerCase() === 'desc' ? 'DESC' : 'ASC'
        if (isPostgres) {
          orderByClause = `ORDER BY "${sortBy}" ${validSortOrder}`
        } else {
          orderByClause = `ORDER BY "${sortBy}" ${validSortOrder}`
        }
      } else {
        // Default to first column if invalid
        if (isPostgres) {
          orderByClause = `ORDER BY "${columns[0]?.column_name || '1'}" ASC`
        } else {
          orderByClause = `ORDER BY "${columns[0]?.column_name || '1'}" ASC`
        }
      }
    } else {
      // Default to first column
      if (columns.length > 0) {
        if (isPostgres) {
          orderByClause = `ORDER BY "${columns[0].column_name}" ASC`
        } else {
          orderByClause = `ORDER BY "${columns[0].column_name}" ASC`
        }
      }
    }
    
    // Get data with pagination and sorting
    let data: any[] = []
    if (isPostgres) {
      const paramCount = queryParams.length
      const dataResult = await db.query(
        `SELECT * FROM "${tableName}" ${whereClause} ${orderByClause} LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`,
        [...queryParams, limit, offset]
      )
      data = dataResult
    } else {
      const dataResult = await db.query(
        `SELECT * FROM "${tableName}" ${whereClause} ${orderByClause} LIMIT ? OFFSET ?`,
        [...queryParams, limit, offset]
      )
      data = dataResult
    }
    
    return NextResponse.json({
      tableName,
      columns,
      data,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    })
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Database table error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

