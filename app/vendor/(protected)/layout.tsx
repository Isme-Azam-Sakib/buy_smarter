import { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { getAdminSession } from '@/lib/admin-auth'
import AdminLayout from '@/components/admin/AdminLayout'
import {
  LayoutDashboard,
  FileText,
  Package,
  BarChart3,
} from 'lucide-react'

const vendorNavItems = [
  { title: 'Dashboard', href: '/vendor/dashboard', icon: LayoutDashboard, key: 'dashboard' },
  { title: 'My Application', href: '/vendor/application', icon: FileText, key: 'application' },
  { title: 'My Products', href: '/vendor/products', icon: Package, key: 'products' },
  { title: 'Analytics', href: '/vendor/analytics', icon: BarChart3, key: 'analytics' },
]

export default async function VendorProtectedLayout({ children }: { children: ReactNode }) {
  let session
  try {
    session = await getAdminSession()
  } catch (error: any) {
    console.error('Error getting admin session:', error)
    redirect('/vendor/login')
  }

  if (!session || session.role !== 'vendor') {
    redirect('/vendor/login')
  }

  const allowedMenuItems = vendorNavItems.filter((item) => {
    if (item.key === 'dashboard' || item.key === 'application') {
      return true
    }
    const hasPermission = session.permissions?.includes(item.key || '')
    return session.vendorStatus === 'approved' && Boolean(hasPermission)
  })

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
      menuItemsOverride={allowedMenuItems}
      logoutPath="/api/vendor/auth/logout"
    >
      {children}
    </AdminLayout>
  )
}

