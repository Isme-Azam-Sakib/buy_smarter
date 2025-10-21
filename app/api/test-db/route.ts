import { NextResponse } from 'next/server'
import { getDatabase } from '@/lib/database'

export async function GET() {
  try {
    console.log('Testing database connection...')
    const db = await getDatabase()
    console.log('Database connected')
    
    // Simple test query
    const result = await db.query('SELECT COUNT(*) as count FROM cpu_products')
    console.log('Query result:', result)
    
    await db.close()
    
    return NextResponse.json({ 
      success: true, 
      count: result[0]?.count || 0,
      message: 'Database connection successful'
    })
  } catch (error) {
    console.error('Database test error:', error)
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
