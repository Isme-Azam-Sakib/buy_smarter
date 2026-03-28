import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Add security headers
  const response = NextResponse.next()
  
  // Add pathname to headers for use in server components
  response.headers.set('x-pathname', pathname)
  
  // Security headers
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'origin-when-cross-origin')
  response.headers.set('X-DNS-Prefetch-Control', 'on')
  
  // Protect admin routes (except login and API routes)
  if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/login') && !pathname.startsWith('/api')) {
    const adminSession = request.cookies.get('admin_session')
    
    // If no session, redirect to login
    if (!adminSession) {
      const loginUrl = new URL('/admin/login', request.url)
      loginUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(loginUrl)
    }
  }
  
  // If accessing login page while already logged in, redirect to dashboard
  if (pathname === '/admin/login') {
    const adminSession = request.cookies.get('admin_session')
    if (adminSession) {
      return NextResponse.redirect(new URL('/admin/dashboard', request.url))
    }
  }
  
  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
