'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { ArrowLeft, Cpu, DollarSign, ShoppingCart, ExternalLink, CheckCircle, AlertCircle, Star, TrendingUp, Users, Package } from 'lucide-react'
import Link from 'next/link'
import { CPUProduct, PriceEntry } from '@/lib/types'
import { formatPrice, formatDate, getBrandColor, getAvailabilityColor, getAvailabilityText, getVendorLogo, getVendorDisplayName } from '@/lib/utils'

export default function CPUProductDetail() {
  const params = useParams()
  const productId = params.id as string
  const [product, setProduct] = useState<CPUProduct | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sortBy, setSortBy] = useState<'price' | 'vendor' | 'date'>('price')
  const [filterVendor, setFilterVendor] = useState('')

  useEffect(() => {
    if (productId) {
      fetchProductDetails()
    }
  }, [productId])

  const fetchProductDetails = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/cpu-products/${encodeURIComponent(productId)}`)
      
      if (response.status === 404) {
        setError('Product not found')
        return
      }
      
      if (!response.ok) {
        throw new Error('Failed to fetch product')
      }
      
      const data = await response.json()
      setProduct(data)
    } catch (err) {
      setError('Failed to load product details')
      console.error('Error fetching product:', err)
    } finally {
      setLoading(false)
    }
  }


  const sortPriceEntries = (entries: PriceEntry[]) => {
    const filtered = filterVendor 
      ? entries.filter(entry => entry.vendor_name.toLowerCase().includes(filterVendor.toLowerCase()))
      : entries

    switch (sortBy) {
      case 'price':
        return filtered.sort((a, b) => a.price_bdt - b.price_bdt)
      case 'vendor':
        return filtered.sort((a, b) => a.vendor_name.localeCompare(b.vendor_name))
      case 'date':
        return filtered.sort((a, b) => new Date(b.scraped_at).getTime() - new Date(a.scraped_at).getTime())
      default:
        return filtered
    }
  }


  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading product details...</p>
        </div>
      </div>
    )
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Product Not Found</h1>
          <p className="text-gray-600 mb-6">{error || 'The requested product could not be found.'}</p>
          <Link 
            href="/"
            className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Link>
        </div>
      </div>
    )
  }

  const sortedPriceEntries = sortPriceEntries(product.price_entries)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link 
                href="/"
                className="inline-flex items-center text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ArrowLeft className="h-5 w-5 mr-2" />
                Back to CPU Products
              </Link>
              <div className="hidden sm:block text-gray-400">/</div>
              <div className="hidden sm:block text-sm text-gray-500 truncate max-w-md">
                {product.standard_name}
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getBrandColor(product.brand)}`}>
                {product.brand}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Product Info */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-md p-6 sticky top-8">
              {/* Product Image */}
              <div className="aspect-w-16 aspect-h-9 bg-gray-100 rounded-lg overflow-hidden mb-6">
                {product.images.length > 0 ? (
                  <img
                    src={product.images[0]}
                    alt={product.standard_name}
                    className="w-full h-64 object-contain"
                  />
                ) : (
                  <div className="w-full h-64 flex items-center justify-center">
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
                    <span className="text-2xl font-bold text-green-700">
                      {formatPrice(product.min_price)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-green-600">
                    <span>Price Range</span>
                    <span>{formatPrice(product.min_price)} - {formatPrice(product.max_price)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-green-600">
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
                  <button className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium">
                    <ShoppingCart className="h-5 w-5 inline mr-2" />
                    Add to Build
                  </button>
                  <button 
                    className="w-full border border-gray-300 text-gray-700 py-3 px-4 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                    onClick={() => {
                      // Scroll to price comparison section
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
                  Price Comparison ({product.total_listings} listings)
                </h2>
                
                {/* Filters and Sort */}
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1">
                    <input
                      type="text"
                      placeholder="Filter by vendor name..."
                      value={filterVendor}
                      onChange={(e) => setFilterVendor(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as 'price' | 'vendor' | 'date')}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="price">Sort by Price</option>
                    <option value="vendor">Sort by Vendor</option>
                    <option value="date">Sort by Date</option>
                  </select>
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
                                  console.error('Image failed to load for vendor:', entry.vendor_name, 'Path:', getVendorLogo(entry.vendor_name))
                                  const target = e.target as HTMLImageElement;
                                  target.src = '/assets/images.jpg';
                                }}
                                onLoad={() => {
                                  console.log('Image loaded successfully for vendor:', entry.vendor_name, 'Path:', getVendorLogo(entry.vendor_name))
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
                          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
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
