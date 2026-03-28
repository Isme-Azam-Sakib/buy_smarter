import { getAdminSession } from '@/lib/admin-auth'
import { getVendorByAdminUserId } from '@/lib/vendor-db'
import Link from 'next/link'

export const dynamic = 'force-dynamic'
import { 
  Play, 
  BarChart3, 
  Package, 
  TrendingUp,
  Database,
  RefreshCw
} from 'lucide-react'

export default async function AdminDashboard() {
  const session = await getAdminSession()
  
  if (!session) {
    return null // This should never happen due to layout protection, but TypeScript needs this
  }

  const isVendor = session.role === 'vendor'
  let vendorName: string | null = null
  
  // Get vendor name if user is a vendor
  if (isVendor && session.userId) {
    try {
      const vendor = await getVendorByAdminUserId(session.userId)
      vendorName = vendor?.vendor_name || null
    } catch (error) {
      console.error('Error fetching vendor:', error)
    }
  }

  // Fetch vendor product count if vendor
  let vendorProductCount = '0'
  if (isVendor && vendorName) {
    try {
      const { getDatabase } = await import('@/lib/database')
      const db = await getDatabase()
      const result = await db.get(
        'SELECT COUNT(*) as count FROM all_products WHERE vendor_name = ?',
        [vendorName]
      ) as { count: number } | undefined
      vendorProductCount = result?.count?.toString() || '0'
      await db.close()
    } catch (error) {
      console.error('Error fetching vendor stats:', error)
    }
  }

  // Superadmin stats
  const superadminStats = [
    {
      title: 'Total Products',
      value: 'Loading...',
      icon: Package,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      href: '/admin/products',
    },
    {
      title: 'Vendors',
      value: '5',
      icon: Database,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      href: '/admin/products',
    },
    {
      title: 'Last Scrape',
      value: 'Today',
      icon: RefreshCw,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      href: '/admin/history',
    },
  ]

  // Vendor stats - only Total Products
  const vendorStats = [
    {
      title: 'Total Products',
      value: vendorProductCount,
      icon: Package,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      href: '/admin/products',
    },
  ]

  const quickStats = isVendor ? vendorStats : superadminStats

  // Superadmin actions
  const superadminActions = [
    {
      title: 'Run Bulk Scraper',
      description: 'Initialize scraping for all vendors',
      icon: Play,
      href: '/admin/scrapers',
      color: 'bg-blue-500',
    },
    {
      title: 'Manage Products',
      description: 'Search and edit products',
      icon: Package,
      href: '/admin/products',
      color: 'bg-purple-500',
    },
  ]

  // Vendor actions - only Manage Products
  const vendorActions = [
    {
      title: 'Manage Products',
      description: 'Search and edit your products',
      icon: Package,
      href: '/admin/products',
      color: 'bg-purple-500',
    },
  ]

  const quickActions = isVendor ? vendorActions : superadminActions

  return (
    <div className="p-6 lg:p-8">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard</h1>
        <p className="text-gray-600">Welcome back, {session.username}. Here&apos;s what&apos;s happening with your store.</p>
      </div>

      {/* Quick Stats */}
      <div className={`grid grid-cols-1 ${isVendor ? 'md:grid-cols-1' : 'md:grid-cols-3'} gap-6 mb-8`}>
        {quickStats.map((stat) => {
          const Icon = stat.icon
          return (
            <Link
              key={stat.title}
              href={stat.href}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">{stat.title}</p>
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                </div>
                <div className={`${stat.bgColor} p-3 rounded-lg`}>
                  <Icon className={`h-6 w-6 ${stat.color}`} />
                </div>
              </div>
            </Link>
          )
        })}
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className={`grid grid-cols-1 ${isVendor ? 'md:grid-cols-1' : 'md:grid-cols-3'} gap-6`}>
          {quickActions.map((action) => {
            const Icon = action.icon
            return (
              <Link
                key={action.title}
                href={action.href}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all group"
              >
                <div className="flex items-start gap-4">
                  <div className={`${action.color} p-3 rounded-lg text-white group-hover:scale-110 transition-transform`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1 group-hover:text-purple-600 transition-colors">
                      {action.title}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {action.description}
                    </p>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Recent Activity - Only for superadmin */}
      {!isVendor && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Recent Activity</h2>
            <Link href="/admin/history" className="text-sm text-purple-600 hover:text-purple-700">
              View all
            </Link>
          </div>
          <div className="text-center py-8 text-gray-500">
            <p>No recent activity to display</p>
          </div>
        </div>
      )}
    </div>
  )
}

