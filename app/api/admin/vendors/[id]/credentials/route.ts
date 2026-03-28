import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getVendorById } from '@/lib/vendor-db'
import { updateAdminUserPassword } from '@/lib/admin-db'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAdmin()
    if (session.role !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const vendorId = Number(params.id)
    if (Number.isNaN(vendorId)) {
      return NextResponse.json({ error: 'Invalid vendor id' }, { status: 400 })
    }

    const { password } = await request.json()
    if (!password || password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters long' },
        { status: 400 }
      )
    }

    const vendor = await getVendorById(vendorId)
    if (!vendor || !vendor.admin_user_id) {
      return NextResponse.json(
        { error: 'Vendor does not have an associated user' },
        { status: 400 }
      )
    }

    await updateAdminUserPassword(vendor.admin_user_id, password)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Reset vendor credentials error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

