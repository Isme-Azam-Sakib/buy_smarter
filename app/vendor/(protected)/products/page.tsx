import { requireVendor } from '@/lib/admin-auth'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function VendorProductsPage() {
  const session = await requireVendor()
  const canAccess =
    session.vendorStatus === 'approved' &&
    session.permissions?.includes('products')

  if (!canAccess) {
    return (
      <div className="p-8">
        <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Products management is locked
          </h2>
          <p className="text-gray-600 mb-4">
            Once your store is approved and granted access, you&apos;ll be able to
            manage product listings here.
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
        <h2 className="text-3xl font-bold text-gray-900 mb-2">
          Manage Your Products
        </h2>
        <p className="text-gray-600">
          Product integration tools will appear here. We&apos;re setting things up for
          your account. Stay tuned!
        </p>
      </div>
    </div>
  )
}

