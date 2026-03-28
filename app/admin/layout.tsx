import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { getAdminSession } from '@/lib/admin-auth'
import AdminLayout from '@/components/admin/AdminLayout'

export default async function AdminLayoutWrapper({
  children,
}: {
  children: React.ReactNode
}) {
  // Get pathname from headers set by middleware
  const headersList = await headers()
  const pathname = headersList.get('x-pathname') || ''
  
  // Check if this is the login page
  const isLoginPage = pathname === '/admin/login'
  
  // If on login page, check if already logged in and redirect
  if (isLoginPage) {
    const session = await getAdminSession()
    if (session) {
      redirect('/admin/dashboard')
    }
    return (
      <div className="min-h-screen">
        {children}
      </div>
    )
  }
  
  // For all other admin pages, require authentication
  const session = await getAdminSession()
  
  // If no session, redirect to login
  if (!session) {
    redirect('/admin/login')
  }

  // Render with AdminLayout (includes sidebar) for authenticated users
  return (
    <AdminLayout 
      user={{
        username: session.username,
        email: session.email,
        role: session.role,
        vendorId: session.vendorId,
        vendorStatus: session.vendorStatus,
        permissions: session.permissions,
      }}
    >
      {children}
    </AdminLayout>
  )
}

