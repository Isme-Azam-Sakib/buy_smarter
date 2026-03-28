import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getDatabase } from '@/lib/database'
import { hasPermission } from '@/lib/admin-permissions'

export async function POST(request: NextRequest) {
  const session = await requireAdmin()
  if (!hasPermission(session, 'products.edit') && !hasPermission(session, 'products.delete')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const body = await request.json()
  const ids: number[] = Array.isArray(body.ids) ? body.ids : []
  const action: 'delete' | 'mark_out_of_stock' = body.action

  if (!ids.length || !['delete', 'mark_out_of_stock'].includes(action)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const db = await getDatabase()
  try {
    if (action === 'delete') {
      const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ')
      await db.run(
        `DELETE FROM all_products WHERE id IN (${placeholders})`,
        ids
      )
      return NextResponse.json({ success: true, action: 'delete', count: ids.length })
    }

    const placeholders = ids.map((_, i) => `$${i + 2}`).join(', ')
    await db.run(
      `UPDATE all_products SET availability_status = $1, updated_at = NOW() WHERE id IN (${placeholders})`,
      ['out_of_stock', ...ids]
    )

    return NextResponse.json({ success: true, action: 'mark_out_of_stock', count: ids.length })
  } catch (error) {
    console.error('Bulk action error', error)
    return NextResponse.json({ error: 'Bulk action failed' }, { status: 500 })
  } finally {
    await db.close()
  }
}

