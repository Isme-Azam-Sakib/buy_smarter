import { NextRequest, NextResponse } from 'next/server'
import { requireVendor } from '@/lib/admin-auth'
import {
  submitVendorApplication,
  getLatestVendorApplicationForUser,
} from '@/lib/vendor-db'

export async function GET() {
  try {
    const session = await requireVendor()
    const application = await getLatestVendorApplicationForUser(session.userId)

    return NextResponse.json({ application })
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Fetch vendor application error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireVendor()
    const {
      vendor_name,
      website_url,
      email,
      phone,
      contact_person,
      additional_details,
    } = await request.json()

    if (!vendor_name || !website_url || !email) {
      return NextResponse.json(
        { error: 'Vendor name, website URL, and email are required' },
        { status: 400 }
      )
    }

    const application = await submitVendorApplication(
      vendor_name,
      email,
      website_url,
      phone,
      contact_person,
      additional_details,
      session.userId
    )

    return NextResponse.json({
      success: true,
      message: 'Application submitted successfully',
      application,
    })
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Submit vendor application error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

