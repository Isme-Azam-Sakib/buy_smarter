'use client'

import { ReactNode, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard,
  Play,
  BarChart3,
  Package,
  History,
  Database,
  Settings,
  LogOut,
  Menu,
  X,
  Users,
  FileText,
  ChevronDown,
} from 'lucide-react'

interface MenuItem {
  title: string
  href: string
  icon: LucideIcon
  key?: string
  children?: MenuItem[]
}

interface AdminLayoutProps {
  children: ReactNode
  user?: {
    username: string
    email: string
    role?: 'superadmin' | 'vendor'
    vendorId?: number
    vendorStatus?: string
    permissions?: string[]
  }
  menuItemsOverride?: MenuItem[]
  logoutPath?: string
}

// Superadmin menu items
const superadminMenuItems: MenuItem[] = [
  {
    title: 'Dashboard',
    href: '/admin/dashboard',
    icon: LayoutDashboard,
    key: 'dashboard',
  },
  {
    title: 'Vendors',
    href: '#',
    icon: Users,
    key: 'vendors-root',
    children: [
      {
        title: 'Vendor Applications',
        href: '/admin/vendor-applications',
        icon: FileText,
        key: 'vendor-applications',
      },
      {
        title: 'Vendor Management',
        href: '/admin/vendor-management',
        icon: Settings,
        key: 'vendor-management',
      },
    ],
  },
  {
    title: 'Bulk Scraper',
    href: '/admin/scrapers',
    icon: Play,
    key: 'scrapers',
  },
  {
    title: 'Products',
    href: '/admin/products/list',
    icon: Package,
    key: 'products',
    children: [
      {
        title: 'Product List',
        href: '/admin/products/list',
        icon: Package,
        key: 'products-list',
      },
      {
        title: 'Manual Entry',
        href: '/admin/products/manual',
        icon: Package,
        key: 'products-manual',
      },
    ],
  },
  {
    title: 'History',
    href: '/admin/history',
    icon: History,
    key: 'history',
  },
  {
    title: 'Database',
    href: '/admin/database',
    icon: Database,
    key: 'database',
  },
]

// Vendor admin menu items - restricted access (will be filtered by permissions)
const vendorMenuItems: MenuItem[] = [
  {
    title: 'Dashboard',
    href: '/admin/dashboard',
    icon: LayoutDashboard,
    key: 'dashboard',
  },
  {
    title: 'Products',
    href: '/admin/products/list',
    icon: Package,
    key: 'products',
    children: [
      {
        title: 'Product List',
        href: '/admin/products/list',
        icon: Package,
        key: 'products-list',
      },
      {
        title: 'Manual Entry',
        href: '/admin/products/manual',
        icon: Package,
        key: 'products-manual',
      },
    ],
  },
]

export default function AdminLayout({
  children,
  user,
  menuItemsOverride,
  logoutPath = '/api/admin/auth/logout',
}: AdminLayoutProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({})
  
  // Don't render sidebar on login page - safety check
  if (!user || pathname === '/admin/login') {
    return <>{children}</>
  }
  
  // Helper function to check permissions
  const hasPermission = (permission: string): boolean => {
    if (!user?.permissions) return false
    if (user.role === 'superadmin') return true
    // Check exact match
    if (user.permissions.includes(permission)) return true
    // If checking a granular product permission, check if 'products' is granted
    if (permission.startsWith('products.') && user.permissions.includes('products')) {
      return true
    }
    return false
  }
  
  // Determine menu items based on user role
  const userRole = user?.role || 'superadmin'
  let baseMenuItems = menuItemsOverride || (userRole === 'superadmin' ? superadminMenuItems : vendorMenuItems)
  
  // Filter vendor menu items based on permissions
  if (!menuItemsOverride && userRole === 'vendor') {
    baseMenuItems = baseMenuItems
      .map((item) => {
        // Always show Dashboard
        if (item.key === 'dashboard') return item
        
        // Show Products menu if they have any product permission
        if (item.key === 'products') {
          if (hasPermission('products') || hasPermission('products.list') || hasPermission('products.manual') || hasPermission('products.edit')) {
            // Filter children based on permissions
            if (item.children) {
              const filteredChildren = item.children.filter((child) => {
                if (child.key === 'products-list') {
                  return hasPermission('products') || hasPermission('products.list')
                }
                if (child.key === 'products-manual') {
                  return hasPermission('products') || hasPermission('products.manual')
                }
                return true
              })
              // Only show parent if there are children to show
              if (filteredChildren.length > 0) {
                return { ...item, children: filteredChildren }
              }
            }
            return null
          }
          return null
        }
        
        // Show Statistics if they have analytics permission
        if (item.key === 'stats') {
          return hasPermission('analytics') ? item : null
        }
        
        return null
      })
      .filter((item): item is MenuItem => item !== null)
  }
  
  const menuItems = baseMenuItems

  const handleLogout = async () => {
    try {
      await fetch(logoutPath, { method: 'POST' })
      if (logoutPath.includes('/vendor/')) {
        router.push('/vendor/login')
      } else {
        router.push('/admin/login')
      }
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-50
          w-64 bg-white border-r border-gray-200
          transform transition-transform duration-300 ease-in-out
          ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200">
            <Link href="/" className="flex items-center gap-2 hover:opacity-90 transition-opacity">
              <div className="h-8 w-8 bg-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">BS</span>
              </div>
              <span className="text-xl font-bold text-gray-900">BuySmarter</span>
            </Link>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-gray-500 hover:text-gray-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 overflow-y-auto">
            <div className="space-y-1">
              {menuItems.map((item) => {
                const Icon = item.icon
                const sectionId = item.key || item.title
                const hasChildren = Array.isArray(item.children) && item.children.length > 0

                if (hasChildren && item.children) {
                  const childActive = item.children.some((child) => pathname.startsWith(child.href))
                  const isOpen =
                    typeof openSections[sectionId] === 'boolean'
                      ? openSections[sectionId]
                      : childActive

                  return (
                    <div key={sectionId} className="space-y-1">
                      <button
                        type="button"
                        onClick={() =>
                          setOpenSections((prev) => ({ ...prev, [sectionId]: !isOpen }))
                        }
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-left
                          ${
                            childActive
                              ? 'bg-purple-50 text-purple-700 font-medium'
                              : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                          }`}
                      >
                        <span className="flex items-center gap-3">
                          <Icon
                            className={`h-5 w-5 ${childActive ? 'text-purple-600' : 'text-gray-500'}`}
                          />
                          {item.title}
                        </span>
                        <ChevronDown
                          className={`h-4 w-4 transition-transform ${
                            isOpen ? 'rotate-180' : 'rotate-0'
                          }`}
                        />
                      </button>
                      {isOpen && (
                        <div className="ml-6 space-y-1">
                          {item.children.map((child) => {
                            const ChildIcon = child.icon
                            const childActiveExact = pathname === child.href
                            return (
                              <Link
                                key={child.href}
                                href={child.href}
                                onClick={() => setMobileMenuOpen(false)}
                                className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm
                                  ${
                                    childActiveExact
                                      ? 'bg-purple-50 text-purple-700 font-medium'
                                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                  }`}
                              >
                                <ChildIcon
                                  className={`h-4 w-4 ${
                                    childActiveExact ? 'text-purple-600' : 'text-gray-500'
                                  }`}
                                />
                                <span>{child.title}</span>
                              </Link>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                }

                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`
                      flex items-center gap-3 px-4 py-3 rounded-lg
                      transition-colors duration-200
                      ${
                        isActive
                          ? 'bg-purple-50 text-purple-700 font-medium'
                          : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                      }
                    `}
                  >
                    <Icon className={`h-5 w-5 ${isActive ? 'text-purple-600' : 'text-gray-500'}`} />
                    <span>{item.title}</span>
                  </Link>
                )
              })}
            </div>

            {/* Settings / Logout Section */}
            <div className="mt-8 pt-8 border-t border-gray-200">
              <div className="space-y-1">
                {!menuItemsOverride && (
                  <Link
                    href="/admin/settings"
                    className={`
                      flex items-center gap-3 px-4 py-3 rounded-lg
                      transition-colors duration-200
                      ${
                        pathname === '/admin/settings'
                          ? 'bg-purple-50 text-purple-700 font-medium'
                          : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                      }
                    `}
                  >
                    <Settings className="h-5 w-5 text-gray-500" />
                    <span>Settings</span>
                  </Link>
                )}
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-red-600 hover:bg-red-50 transition-colors duration-200"
                >
                  <LogOut className="h-5 w-5" />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          </nav>

          {/* User Info */}
          {user && (
            <div className="px-4 py-4 border-t border-gray-200">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center">
                  <span className="text-purple-600 font-semibold text-sm">
                    {user.username.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{user.username}</p>
                  <p className="text-xs text-gray-500 truncate">{user.email}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-4 lg:px-6">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden text-gray-500 hover:text-gray-700"
          >
            <Menu className="h-6 w-6" />
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-4">
            <div className="hidden md:block">
              <p className="text-sm text-gray-600">
                Welcome back, <span className="font-medium text-gray-900">{user?.username || 'Admin'}</span>
              </p>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}

