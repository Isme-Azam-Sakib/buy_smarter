import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import {
  createVendorManual,
  getVendorsWithAdmins,
  getProductVendorNames,
} from '@/lib/vendor-db'
import { getAdminByUsername } from '@/lib/admin-db'

export async function GET(request: NextRequest) {
  try {
    const session = await requireAdmin()
    if (session.role !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const url = new URL(request.url)
    const productVendors = url.searchParams.get('productVendors')
    
    if (productVendors === 'true') {
      const vendorNames = await getProductVendorNames()
      return NextResponse.json({ vendorNames })
    }

    const vendors = await getVendorsWithAdmins()
    return NextResponse.json({ vendors })
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Fetch vendors error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAdmin()
    if (session.role !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const {
      vendor_name,
      website_url,
      email,
      phone,
      contact_person,
      status,
      adminUsername,
      permissions,
      managed_vendor_name,
    } = body

    if (!vendor_name || !email) {
      return NextResponse.json(
        { error: 'Vendor name and email are required' },
        { status: 400 }
      )
    }

    let adminUserId: number | undefined
    if (adminUsername) {
      const adminUser = await getAdminByUsername(adminUsername)
      if (!adminUser || adminUser.role !== 'vendor') {
        return NextResponse.json(
          { error: 'Vendor admin username is invalid' },
          { status: 400 }
        )
      }
      adminUserId = adminUser.id
    }

    const vendor = await createVendorManual({
      vendor_name,
      website_url,
      email,
      phone,
      contact_person,
      status,
      admin_user_id: adminUserId,
      permissions,
      managed_vendor_name: managed_vendor_name || null,
    })

    return NextResponse.json({ success: true, vendor })
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Create vendor error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

