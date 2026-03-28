import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getAdminByUsername, verifyPassword, updateLastLogin } from '@/lib/admin-db'
import { buildSessionPayload } from '@/lib/admin-auth'

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json()

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      )
    }

    const user = await getAdminByUsername(username)
    if (!user || user.role !== 'vendor') {
      return NextResponse.json(
        { error: 'Invalid vendor credentials' },
        { status: 401 }
      )
    }

    const isValid = verifyPassword(password, user.password_hash)
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid vendor credentials' },
        { status: 401 }
      )
    }

    await updateLastLogin(user.id)

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
    console.error('Vendor login error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

