import { NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/admin-auth'

export async function GET() {
  try {
    const session = await getAdminSession()
    
    if (!session) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    return NextResponse.json({ 
      user: {
        id: session.userId,
        username: session.username,
        email: session.email,
        role: session.role,
        vendorId: session.vendorId,
        vendorStatus: session.vendorStatus,
        permissions: session.permissions,
        managedVendorName: session.managedVendorName,
      }
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Not authenticated' },
      { status: 401 }
    )
  }
}

