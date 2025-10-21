'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { ArrowLeft, Cpu, DollarSign, ShoppingCart, ExternalLink, CheckCircle, AlertCircle, Star, TrendingUp, Users, Package, Brain } from 'lucide-react'
import Link from 'next/link'
import { CPUProduct, PriceEntry } from '@/lib/types'
import { formatPrice, formatDate, getBrandColor, getAvailabilityColor, getAvailabilityText, getVendorLogo, getVendorDisplayName } from '@/lib/utils'

interface AIProductDetailProps {
  params: {
    id: string
  }
}

export default function AIProductDetail() {
  const params = useParams()
  const productId = params.id as string
  const [product, setProduct] = useState<CPUProduct | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<'price' | 'vendor'>('price')
  const [filterVendor, setFilterVendor] = useState<string>('')

  useEffect(() => {
    async function fetchProduct() {
      try {
        setLoading(true)
        const response = await fetch(`/api/ai-products/${productId}`)
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        const data: CPUProduct = await response.json()
        setProduct(data)
      } catch (err) {
        console.error('Failed to fetch AI product:', err)
        setError('Failed to load AI product details. Please try again.')
      } finally {
        setLoading(false)
      }
    }

    fetchProduct()
  }, [productId])

  const sortPriceEntries = (entries: PriceEntry[]) => {
    const filtered = filterVendor 
      ? entries.filter(entry => entry.vendor_name.toLowerCase().includes(filterVendor.toLowerCase()))
      : entries
    
    return [...filtered].sort((a, b) => {
      if (sortBy === 'price') {
        return a.price_bdt - b.price_bdt
      }
      return a.vendor_name.localeCompare(b.vendor_name)
    })
  }

  const sortedPriceEntries = product ? sortPriceEntries(product.price_entries) : []

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mb-4"></div>
          <p className="text-purple-600 font-medium">AI is analyzing product details...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center p-8 bg-red-50 rounded-lg shadow-md">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-red-800">{error}</h2>
          <Link href="/" className="mt-4 inline-flex items-center text-blue-600 hover:underline">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Home
          </Link>
        </div>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center p-8 bg-yellow-50 rounded-lg shadow-md">
          <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-yellow-800">AI Product not found.</h2>
          <Link href="/" className="mt-4 inline-flex items-center text-blue-600 hover:underline">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Home
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link href="/" className="inline-flex items-center text-gray-600 hover:text-gray-900">
            <ArrowLeft className="h-5 w-5 mr-2" />
            Back to AI Products
          </Link>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Product Info */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-md p-6 sticky top-8">
              {/* AI Badge */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <Brain className="h-5 w-5 text-purple-600" />
                  <span className="text-sm font-medium text-purple-600">AI-Powered Analysis</span>
                </div>
                <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-medium">
                  ML Grouped
                </span>
              </div>

              {/* Product Image */}
              <div className="aspect-w-16 aspect-h-9 bg-gray-100 rounded-lg overflow-hidden mb-6 flex items-center justify-center">
                {product.images && product.images.length > 0 ? (
                  <img
                    src={product.images[0]}
                    alt={product.standard_name}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Cpu className="h-24 w-24 text-gray-400" />
                  </div>
                )}
              </div>

              {/* Product Details */}
              <div className="space-y-4">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 mb-2">
                    {product.standard_name}
                  </h1>
                  {product.price_entries.length > 0 && (
                    <p className="text-sm text-gray-600 italic">
                      "{product.price_entries[0].raw_name}"
                    </p>
                  )}
                </div>

                {/* Price Summary */}
                <div className="bg-green-50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-green-600">Best Price</span>
                    <span className="text-2xl font-bold text-green-600">{formatPrice(product.min_price)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600 text-sm">
                    <span>Average Price</span>
                    <span>{formatPrice(product.avg_price)}</span>
                  </div>
                </div>

                {/* Product Description */}
                {product.price_entries.length > 0 && product.price_entries[0].description && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
                      <Package className="h-4 w-4 mr-2" />
                      Product Description
                    </h3>
                    <div className="text-sm text-gray-700 leading-relaxed">
                      {product.price_entries[0].description}
                    </div>
                  </div>
                )}

                {/* Product Details */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
                    <Package className="h-4 w-4 mr-2" />
                    Product Details
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Brand:</span>
                      <span className="font-medium">{product.brand}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Model:</span>
                      <span className="font-medium">{product.standard_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Available at:</span>
                      <span className="font-medium">{product.vendor_count} vendors</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total listings:</span>
                      <span className="font-medium">{product.total_listings}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Price range:</span>
                      <span className="font-medium text-green-600">
                        {formatPrice(product.min_price)} - {formatPrice(product.max_price)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-blue-50 rounded-lg">
                    <Users className="h-6 w-6 text-blue-600 mx-auto mb-1" />
                    <p className="text-sm text-blue-600 font-medium">{product.vendor_count}</p>
                    <p className="text-xs text-blue-500">Vendors</p>
                  </div>
                  <div className="text-center p-3 bg-purple-50 rounded-lg">
                    <TrendingUp className="h-6 w-6 text-purple-600 mx-auto mb-1" />
                    <p className="text-sm text-purple-600 font-medium">{product.total_listings}</p>
                    <p className="text-xs text-purple-500">Listings</p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-2">
                  <button className="w-full bg-purple-600 text-white py-3 px-4 rounded-lg hover:bg-purple-700 transition-colors font-medium">
                    <ShoppingCart className="h-5 w-5 inline mr-2" />
                    Add to Build
                  </button>
                  <button
                    className="w-full border border-gray-300 text-gray-700 py-3 px-4 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                    onClick={() => {
                        document.getElementById('price-comparison')?.scrollIntoView({ behavior: 'smooth' })
                    }}
                  >
                    <ExternalLink className="h-5 w-5 inline mr-2" />
                    View All Listings
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Price Comparison */}
          <div className="lg:col-span-2">
            <div id="price-comparison" className="bg-white rounded-lg shadow-md">
              {/* Header */}
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  AI-Grouped Price Comparison ({product.total_listings} listings)
                </h2>
                {/* Sort and Filter */}
                <div className="flex flex-col sm:flex-row justify-between items-center space-y-3 sm:space-y-0">
                  <div className="flex items-center space-x-2">
                    <label htmlFor="sort-by" className="text-sm font-medium text-gray-700">Sort by:</label>
                    <select
                      id="sort-by"
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as 'price' | 'vendor')}
                      className="block w-full sm:w-auto rounded-md border-gray-300 shadow-sm focus:border-purple-300 focus:ring focus:ring-purple-200 focus:ring-opacity-50"
                    >
                      <option value="price">Price</option>
                      <option value="vendor">Vendor</option>
                    </select>
                  </div>
                  <div className="flex items-center space-x-2">
                    <label htmlFor="filter-vendor" className="text-sm font-medium text-gray-700">Filter vendor:</label>
                    <select
                      id="filter-vendor"
                      value={filterVendor}
                      onChange={(e) => setFilterVendor(e.target.value)}
                      className="block w-full sm:w-auto rounded-md border-gray-300 shadow-sm focus:border-purple-300 focus:ring focus:ring-purple-200 focus:ring-opacity-50"
                    >
                      <option value="">All Vendors</option>
                      {Array.from(new Set(product.price_entries.map(entry => entry.vendor_name))).map(
                        (vendorName) => (
                          <option key={vendorName} value={vendorName}>
                            {getVendorDisplayName(vendorName)}
                          </option>
                        )
                      )}
                    </select>
                  </div>
                </div>
              </div>

              {/* Price Entries */}
              <div className="divide-y divide-gray-200">
                {sortedPriceEntries.map((entry, index) => (
                  <div key={entry.id} className="p-6 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-3">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-white rounded-lg border border-gray-200 flex items-center justify-center overflow-hidden">
                              <img
                                src={getVendorLogo(entry.vendor_name)}
                                alt={getVendorDisplayName(entry.vendor_name)}
                                width={32}
                                height={32}
                                className="object-contain max-w-full max-h-full"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.src = '/assets/images.jpg';
                                }}
                              />
                            </div>
                            <div>
                              <h3 className="font-medium text-gray-900">{getVendorDisplayName(entry.vendor_name)}</h3>
                              <p className="text-sm text-gray-600">{entry.raw_name}</p>
                            </div>
                          </div>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getAvailabilityColor(entry.availability_status)}`}>
                            {getAvailabilityText(entry.availability_status)}
                          </span>
                          {index === 0 && sortBy === 'price' && (
                            <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium flex items-center">
                              <Star className="h-3 w-3 mr-1" />
                              Best Price
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right ml-4">
                        <p className="text-2xl font-bold text-gray-900 mb-2">
                          {formatPrice(entry.price_bdt)}
                        </p>
                        <a
                          href={entry.product_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
                        >
                          View Product
                          <ExternalLink className="h-4 w-4 ml-2" />
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
