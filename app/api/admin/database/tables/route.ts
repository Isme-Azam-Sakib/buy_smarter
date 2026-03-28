import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getDatabase } from '@/lib/database'

export async function GET() {
  try {
    await requireAdmin()
    const db = await getDatabase()
    
    // Get all tables
    const isPostgres = false // SQLite only
    let tables: any[] = []
    
    if (isPostgres) {
      const result = await db.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name
      `)
      tables = result.map((row: any) => ({ name: row.table_name }))
    } else {
      const result = await db.query(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
        ORDER BY name
      `)
      tables = result.map((row: any) => ({ name: row.name }))
    }
    
    return NextResponse.json({ tables })
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Database tables error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

