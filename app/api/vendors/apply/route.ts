import { NextRequest, NextResponse } from 'next/server'
import { submitVendorApplication } from '@/lib/vendor-db'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { vendor_name, website_url, email, phone, contact_person, additional_details } = body

    // Validate required fields
    if (!vendor_name || !website_url || !email) {
      return NextResponse.json(
        { error: 'Vendor name, website URL, and email are required' },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      )
    }

    // Validate URL format
    try {
      new URL(website_url)
    } catch {
      return NextResponse.json(
        { error: 'Invalid website URL format' },
        { status: 400 }
      )
    }

    // Submit the application
    const application = await submitVendorApplication(
      vendor_name,
      email,
      website_url,
      phone,
      contact_person,
      additional_details
    )

    return NextResponse.json({
      success: true,
      message: 'Application submitted successfully',
      application: {
        id: application.id,
        vendor_name: application.vendor_name,
        status: application.status,
      },
    })
  } catch (error: any) {
    console.error('Vendor application error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

