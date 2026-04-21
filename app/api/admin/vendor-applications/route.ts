import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getAllVendorApplications } from '@/lib/vendor-db'

export async function GET() {
  try {
    const session = await requireAdmin()
    if (session.role !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const applications = await getAllVendorApplications()
    return NextResponse.json({ applications })
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error fetching vendor applications:', error)
    console.error('Error stack:', error.stack)
    return NextResponse.json(
      { error: error.message || 'Internal server error', details: process.env.NODE_ENV === 'development' ? error.stack : undefined },
      { status: 500 }
    )
  }
}

