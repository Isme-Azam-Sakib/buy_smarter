import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import {
  createAdminUser,
  getAdminByEmail,
  getAdminByUsername,
} from '@/lib/admin-db'
import { buildSessionPayload } from '@/lib/admin-auth'

export async function POST(request: NextRequest) {
  try {
    const { username, email, password } = await request.json()

    if (!username || !email || !password) {
      return NextResponse.json(
        { error: 'Username, email, and password are required' },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      )
    }

    const existingUser = await getAdminByUsername(username)
    if (existingUser) {
      return NextResponse.json(
        { error: 'Username already exists' },
        { status: 400 }
      )
    }

    const existingEmail = await getAdminByEmail(email)
    if (existingEmail) {
      return NextResponse.json(
        { error: 'Email already exists' },
        { status: 400 }
      )
    }

    const user = await createAdminUser(username, email, password, {
      role: 'vendor',
      permissions: [],
    })

    const sessionPayload = await buildSessionPayload(user)
    const cookieStore = await cookies()
    cookieStore.set('admin_session', JSON.stringify(sessionPayload), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
    })

    return NextResponse.json({
      success: true,
      user: sessionPayload,
    })
  } catch (error: any) {
    console.error('Vendor registration error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

