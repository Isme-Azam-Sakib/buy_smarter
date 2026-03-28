import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getDatabase } from '@/lib/database'
import { requireAdmin } from '@/lib/admin-auth'
import { getVendorLogo, getAvailabilityText } from '@/lib/utils'
import ProductEditForm from '@/components/admin/ProductEditForm'
import RefreshButton from '@/components/admin/RefreshButton'
import VendorLogo from '@/components/admin/VendorLogo'

interface ProductDetail {
  id: number
  vendor_name: string
  standard_name: string
  brand: string | null
  category: string | null
  price_bdt: number | null
  availability_status: string | null
  product_url: string | null
  updated_at: string | null
  created_at: string | null
  scraped_at: string | null
  image_url: string | null
  description: string | null
}

export const dynamic = 'force-dynamic'

export default async function AdminProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string }
}) {
  await requireAdmin()

  // Handle both Promise and direct params (Next.js 13+ compatibility)
  const resolvedParams = 'then' in params ? await params : params
  const productId = resolvedParams.id

  const db = await getDatabase()
  try {
    if (!productId || isNaN(Number(productId))) {
      return notFound()
    }

    const product = (await db.get(
      `
        SELECT 
          id,
          vendor_name,
          standard_name,
          brand,
          category,
          price_bdt,
          availability_status,
          product_url,
          image_url,
          updated_at,
          created_at,
          scraped_at,
          description
        FROM all_products
        WHERE id = ?
        LIMIT 1
      `,
      [productId]
    )) as ProductDetail | undefined

    if (!product) {
      return notFound()
    }

    const formatDate = (dateStr: string | null) => {
      if (!dateStr) return 'Unknown'
      const date = new Date(dateStr)
      return date.toLocaleString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    }

    const getTimeAgo = (dateStr: string | null) => {
      if (!dateStr) return 'Unknown'
      const date = new Date(dateStr)
      const now = new Date()
      const diffMs = now.getTime() - date.getTime()
      const diffSeconds = Math.floor(diffMs / 1000)
      const diffMinutes = Math.floor(diffSeconds / 60)
      const diffHours = Math.floor(diffMinutes / 60)
      const diffDays = Math.floor(diffHours / 24)
      
      if (diffSeconds < 60) return 'Just Now'
      if (diffMinutes < 60) return `${diffMinutes} minute(s) ago`
      if (diffHours < 24) return `${diffHours} hour(s) ago`
      if (diffDays === 1) return '1 day ago'
      return `${diffDays} day(s) ago`
    }

    const vendorLogo = getVendorLogo(product.vendor_name)
    const availabilityText = getAvailabilityText(product.availability_status || 'in_stock')
    const isInStock = product.availability_status === 'in_stock'

    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs uppercase tracking-wider text-gray-400">Edit mode</p>
              <h1 className="text-3xl font-bold text-gray-900">{product.standard_name}</h1>
            </div>
            <Link href="/admin/products/list" className="text-purple-600 hover:underline">
              ← Back to list
            </Link>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Image Upload Area */}
            <div className="lg:col-span-2">
              <ProductEditForm {...product} />
            </div>

            {/* Right: Details Panel */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">DETAILS</h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-gray-500 mb-2">Vendor Logo</p>
                    <VendorLogo src={vendorLogo} alt={product.vendor_name} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Vendor Name</p>
                    <p className="text-sm font-medium text-gray-900">{product.vendor_name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Created at</p>
                    <p className="text-sm text-gray-900">{formatDate(product.created_at)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Scraped at</p>
                    <p className="text-sm text-gray-900">{getTimeAgo(product.scraped_at)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Last Updated</p>
                    <p className="text-sm text-gray-900">{getTimeAgo(product.updated_at)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Stock status</p>
                    <span
                      className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${
                        isInStock
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {availabilityText}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">ACTIONS</h3>
                <div className="space-y-2">
                  {product.product_url && (
                    <a
                      href={product.product_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm text-gray-700 transition-colors"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                        />
                      </svg>
                      Open Product Page
                    </a>
                  )}
                  <RefreshButton productId={product.id.toString()} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  } finally {
    await db.close()
  }
}

