import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import {
  updateVendorRecord,
  deleteVendorRecord,
  getVendorById,
} from '@/lib/vendor-db'
import { updateAdminUserPermissions } from '@/lib/admin-db'

export async function PATCH(
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

    const body = await request.json()
    const vendor = await updateVendorRecord(vendorId, body)

    if (vendor?.admin_user_id && body.permissions) {
      await updateAdminUserPermissions(vendor.admin_user_id, body.permissions)
    }

    return NextResponse.json({ success: true, vendor })
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Update vendor error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
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

    const vendor = await getVendorById(vendorId)
    if (!vendor) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })
    }

    await deleteVendorRecord(vendorId)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Delete vendor error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

