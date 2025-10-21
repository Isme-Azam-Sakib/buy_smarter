'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Cpu, DollarSign, ShoppingCart, ExternalLink, Brain, Zap } from 'lucide-react'
import { CPUProduct, CPUProductsProps } from '@/lib/types'
import { formatPrice, getBrandColor } from '@/lib/utils'

export default function AIProducts({ searchQuery = '' }: CPUProductsProps) {
  const router = useRouter()
  const [products, setProducts] = useState<CPUProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState(searchQuery)
  const [selectedBrand, setSelectedBrand] = useState('')
  const [brands, setBrands] = useState<{ brand: string; count: number }[]>([])
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 12,
    totalPages: 0
  })

  const fetchProducts = async (page = 1, searchTerm = '', brand = '') => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '12',
        ...(searchTerm && { search: searchTerm }),
        ...(brand && { brand })
      })

      const response = await fetch(`/api/ai-products-pg?${params}`)
      const data = await response.json()

      if (data.error) {
        console.error('Error fetching products:', data.error)
        return
      }

      setProducts(data.products)
      setPagination(data.pagination)
      setBrands(data.stats.brands)
    } catch (error) {
      console.error('Error fetching products:', error)
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
    // Use the AI-generated standard name as the ID
    const productId = encodeURIComponent(product.standard_name)
    router.push(`/ai-products-pg/${productId}`)
  }

  const handlePageChange = (newPage: number) => {
    fetchProducts(newPage, search, selectedBrand)
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center mb-4">
          <Brain className="h-8 w-8 text-purple-600 mr-2" />
          <h1 className="text-4xl font-bold text-gray-900">AI-Powered CPU Discovery</h1>
        </div>
        <p className="text-xl text-gray-600 mb-4">
          Products grouped by our custom AI model for intelligent matching
        </p>
        <div className="flex items-center justify-center space-x-2 text-sm text-purple-600">
          <Zap className="h-4 w-4" />
          <span>Powered by Machine Learning</span>
        </div>
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
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="sm:w-48">
              <select
                value={selectedBrand}
                onChange={(e) => setSelectedBrand(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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
              className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition-colors"
            >
              Search
            </button>
          </div>
        </form>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex flex-col justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mb-4"></div>
          <p className="text-purple-600 font-medium">AI is processing products...</p>
          <p className="text-gray-500 text-sm mt-2">This may take a moment as we analyze each product with our machine learning model</p>
        </div>
      )}

      {/* Products Grid */}
      {!loading && (
        <>
          <div className="mb-6">
            <p className="text-gray-600">
              Showing {products.length} of {pagination.total} AI-grouped products
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {products.map((product) => (
              <div 
                key={product.id} 
                className="bg-white rounded-lg shadow-md hover:shadow-xl hover:scale-105 transition-all duration-200 cursor-pointer group border-2 border-transparent hover:border-purple-200"
                onClick={() => handleProductClick(product)}
              >
                {/* Product Image */}
                <div className="aspect-w-16 aspect-h-9 bg-gray-100 rounded-t-lg overflow-hidden flex items-center justify-center">
                  {product.images && product.images.length > 0 ? (
                    <img
                      src={product.images[0]}
                      alt={product.standard_name}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Cpu className="h-16 w-16 text-gray-400" />
                    </div>
                  )}
                </div>

                {/* Product Info */}
                <div className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getBrandColor(product.brand)}`}>
                      {product.brand}
                    </span>
                    <div className="flex items-center text-xs text-purple-600">
                      <Brain className="h-3 w-3 mr-1" />
                      AI Grouped
                    </div>
                  </div>

                  <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">
                    {product.standard_name}
                  </h3>

                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Best Price:</span>
                      <span className="font-semibold text-green-600">
                        {formatPrice(product.min_price)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Vendors:</span>
                      <span className="font-medium">{product.vendor_count}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Listings:</span>
                      <span className="font-medium">{product.total_listings}</span>
                    </div>
                  </div>

                  <div className="flex space-x-2">
                    <button 
                      className="flex-1 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 group-hover:bg-purple-700 transition-colors text-sm font-medium"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleProductClick(product)
                      }}
                    >
                      <ShoppingCart className="h-4 w-4 inline mr-1" />
                      View Details
                    </button>
                    <button 
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 group-hover:bg-gray-50 transition-colors text-sm"
                      onClick={(e) => {
                        e.stopPropagation()
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
            <div className="flex justify-center items-center space-x-2 mt-8">
              <button
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page === 1}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              
              <div className="flex space-x-1">
                {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                  const page = i + 1
                  return (
                    <button
                      key={page}
                      onClick={() => handlePageChange(page)}
                      className={`px-4 py-2 rounded-lg ${
                        pagination.page === page
                          ? 'bg-purple-600 text-white'
                          : 'border border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {page}
                    </button>
                  )
                })}
              </div>

              <button
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page === pagination.totalPages}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {/* No Results */}
      {!loading && products.length === 0 && (
        <div className="text-center py-12">
          <Brain className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No products found</h3>
          <p className="text-gray-600">Try adjusting your search or filter criteria</p>
        </div>
      )}
    </div>
  )
}
