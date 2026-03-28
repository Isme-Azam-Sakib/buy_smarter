import { requireVendor } from '@/lib/admin-auth'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function VendorAnalyticsPage() {
  const session = await requireVendor()
  const canAccess =
    session.vendorStatus === 'approved' &&
    session.permissions?.includes('analytics')

  if (!canAccess) {
    return (
      <div className="p-8">
        <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Analytics are locked
          </h2>
          <p className="text-gray-600 mb-4">
            You&apos;ll gain access to performance insights once your account is
            approved and granted analytics permissions.
          </p>
          <Link
            href="/vendor/application"
            className="text-purple-600 font-semibold hover:text-purple-700"
          >
            Review your application status
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Store Analytics</h2>
        <p className="text-gray-600">
          Your sales, traffic, and pricing insights will appear here once data is
          available.
        </p>
      </div>
    </div>
  )
}

