import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getDatabase } from '@/lib/database'

export async function POST() {
  // Require admin authentication
  const session = await requireAdmin()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = await getDatabase()
  try {
    // Count products with NULL IDs
    const countResult = await db.get(
      'SELECT COUNT(*) as count FROM all_products WHERE id IS NULL'
    )
    const nullCount = countResult?.count || 0

    if (nullCount === 0) {
      return NextResponse.json({
        success: true,
        message: 'No products with NULL IDs found',
        deleted: 0,
      })
    }

    // Delete products with NULL IDs
    const deleteResult = await db.run(
      'DELETE FROM all_products WHERE id IS NULL'
    )

    return NextResponse.json({
      success: true,
      message: `Deleted ${nullCount} products with NULL IDs`,
      deleted: nullCount,
      changes: deleteResult?.changes || 0,
    })
  } catch (error: any) {
    console.error('Database cleanup error:', error)
    return NextResponse.json(
      { error: error.message || 'Cleanup failed' },
      { status: 500 }
    )
  } finally {
    await db.close()
  }
}

export async function GET() {
  // Require admin authentication
  const session = await requireAdmin()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = await getDatabase()
  try {
    // Count products with NULL IDs
    const countResult = await db.get(
      'SELECT COUNT(*) as count FROM all_products WHERE id IS NULL'
    )
    const nullCount = countResult?.count || 0

    return NextResponse.json({
      success: true,
      nullIdCount: nullCount,
      message: nullCount > 0 
        ? `Found ${nullCount} products with NULL IDs` 
        : 'No products with NULL IDs found',
    })
  } catch (error: any) {
    console.error('Database check error:', error)
    return NextResponse.json(
      { error: error.message || 'Check failed' },
      { status: 500 }
    )
  } finally {
    await db.close()
  }
}
