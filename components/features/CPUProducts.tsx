'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Cpu, DollarSign, ShoppingCart, ExternalLink } from 'lucide-react'
import { CPUProduct, CPUProductsProps } from '@/lib/types'
import { formatPrice, getBrandColor } from '@/lib/utils'

export default function CPUProducts({ searchQuery = '' }: CPUProductsProps) {
  const router = useRouter()
  const [products, setProducts] = useState<CPUProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState(searchQuery)
  const [selectedBrand, setSelectedBrand] = useState('')
  const [brands, setBrands] = useState<{ brand: string; count: number }[]>([])
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  })

  const fetchProducts = async (page = 1, searchTerm = '', brand = '') => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pagination.limit.toString(),
        ...(searchTerm && { search: searchTerm }),
        ...(brand && { brand })
      })

      const response = await fetch(`/api/cpu-products?${params}`)
      const data = await response.json()

      if (data.products) {
        setProducts(data.products)
        setPagination(data.pagination)
        setBrands(data.stats.brands)
      }
    } catch (error) {
      console.error('Error fetching CPU products:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProducts(1, search, selectedBrand)
  }, [search, selectedBrand])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchProducts(1, search, selectedBrand)
  }


  const handleProductClick = (product: CPUProduct) => {
    // Encode the product ID for URL safety
    const encodedId = encodeURIComponent(product.standard_name)
    router.push(`/cpu-products/${encodedId}`)
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          CPU Price Comparison
        </h1>
        <p className="text-xl text-gray-600">
          Find the best CPU deals across multiple vendors in Bangladesh
        </p>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                <input
                  type="text"
                  placeholder="Search CPUs (e.g., Intel Core i5, AMD Ryzen 7)..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="sm:w-48">
              <select
                value={selectedBrand}
                onChange={(e) => setSelectedBrand(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Brands</option>
                {brands.map((brand) => (
                  <option key={brand.brand} value={brand.brand}>
                    {brand.brand} ({brand.count})
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
            >
              Search
            </button>
          </div>
        </form>
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <>
          {/* Results Summary */}
          <div className="mb-6">
            <p className="text-gray-600">
              Found {pagination.total} CPUs across {brands.length} brands
            </p>
          </div>

          {/* Products Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((product) => (
              <div 
                key={product.id} 
                className="bg-white rounded-lg shadow-md hover:shadow-xl hover:scale-105 transition-all duration-200 cursor-pointer group"
                onClick={() => handleProductClick(product)}
              >
                {/* Product Image */}
                <div className="aspect-w-16 aspect-h-9 bg-gray-100 rounded-t-lg overflow-hidden">
                  {product.images.length > 0 ? (
                    <img
                      src={product.images[0]}
                      alt={product.standard_name}
                      className="w-full h-48 object-contain"
                    />
                  ) : (
                    <div className="w-full h-48 flex items-center justify-center">
                      <Cpu className="h-16 w-16 text-gray-400" />
                    </div>
                  )}
                </div>

                {/* Product Info */}
                <div className="p-6">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-lg font-semibold text-gray-900 line-clamp-2">
                      {product.standard_name}
                    </h3>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getBrandColor(product.brand)}`}>
                      {product.brand}
                    </span>
                  </div>

                  {/* Price Range */}
                  <div className="mb-4">
                    <div className="flex items-center space-x-2 mb-1">
                      
                      <span className="text-2xl font-bold text-green-600">
                        {formatPrice(product.min_price)}
                      </span>
                      {product.min_price !== product.max_price && (
                        <>
                          <span className="text-gray-400">-</span>
                          <span className="text-lg text-gray-600">
                            {formatPrice(product.max_price)}
                          </span>
                        </>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">
                      Avg: {formatPrice(product.avg_price)} • {product.vendor_count} vendors
                    </p>
                  </div>

                  {/* Vendor List */}
                  <div className="mb-4">
                    <p className="text-sm text-gray-600 mb-2">Available at:</p>
                    <div className="flex flex-wrap gap-1">
                      {product.vendors.slice(0, 3).map((vendor) => (
                        <span
                          key={vendor}
                          className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded"
                        >
                          {vendor}
                        </span>
                      ))}
                      {product.vendors.length > 3 && (
                        <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                          +{product.vendors.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex space-x-2">
                    <button 
                      className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 group-hover:bg-blue-700 transition-colors text-sm font-medium"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleProductClick(product)
                      }}
                    >
                      <ShoppingCart className="h-4 w-4 inline mr-1" />
                      Compare Prices
                    </button>
                    <button 
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 group-hover:bg-gray-50 transition-colors text-sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        // Open the first vendor's product URL
                        if (product.price_entries.length > 0) {
                          window.open(product.price_entries[0].product_url, '_blank')
                        }
                      }}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex justify-center mt-8">
              <div className="flex space-x-2">
                <button
                  onClick={() => fetchProducts(pagination.page - 1, search, selectedBrand)}
                  disabled={pagination.page === 1}
                  className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Previous
                </button>
                
                {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                  const page = i + 1
                  return (
                    <button
                      key={page}
                      onClick={() => fetchProducts(page, search, selectedBrand)}
                      className={`px-4 py-2 rounded-lg ${
                        page === pagination.page
                          ? 'bg-blue-600 text-white'
                          : 'border border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {page}
                    </button>
                  )
                })}
                
                <button
                  onClick={() => fetchProducts(pagination.page + 1, search, selectedBrand)}
                  disabled={pagination.page === pagination.totalPages}
                  className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
