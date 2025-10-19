'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { Search, Filter, Grid, List, Star, ExternalLink } from 'lucide-react'

interface Product {
  productId: number
  standardName: string
  category: string
  brand: string
  currentCheapestPrice: number
  keySpecsJson: any
  imageUrls: string[]
  priceEntries: Array<{
    id: number
    scrapedPrice: number
    availabilityStatus: string
    productUrl: string
    vendor: {
      name: string
      website: string
    }
  }>
}

interface ProductsResponse {
  products: Product[]
  pagination: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
  stats: {
    categories: Array<{ category: string; count: number }>
    brands: Array<{ brand: string; count: number }>
  }
}

export default function ProductsPage() {
  const router = useRouter()
  const [data, setData] = useState<ProductsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedBrand, setSelectedBrand] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const searchInputRef = useRef<HTMLInputElement>(null)

  const fetchProducts = useCallback(async (searchQuery?: string) => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '20'
      })
      
      const query = searchQuery !== undefined ? searchQuery : searchTerm
      if (query) params.append('search', query)
      if (selectedCategory) params.append('category', selectedCategory)
      if (selectedBrand) params.append('brand', selectedBrand)

      const response = await fetch(`/api/products?${params}`)
      if (!response.ok) throw new Error('Failed to fetch products')
      
      const result = await response.json()
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }, [currentPage, selectedCategory, selectedBrand])

  // Initial load and when filters change (not search)
  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])


  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const searchValue = searchInputRef.current?.value || ''
    setSearchTerm(searchValue)
    setCurrentPage(1)
    fetchProducts(searchValue)
  }

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Don't update state, just let the input handle its own value
    // This prevents re-renders and focus loss
  }

  const clearFilters = () => {
    setSearchTerm('')
    setSelectedCategory('')
    setSelectedBrand('')
    setCurrentPage(1)
    if (searchInputRef.current) {
      searchInputRef.current.value = ''
    }
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-BD', {
      style: 'currency',
      currency: 'BDT',
      minimumFractionDigits: 0
    }).format(price)
  }

  const getCategoryColor = (category: string) => {
    const colors: { [key: string]: string } = {
      cpu: 'bg-blue-100 text-blue-800',
      gpu: 'bg-purple-100 text-purple-800',
      ram: 'bg-green-100 text-green-800',
      motherboard: 'bg-orange-100 text-orange-800',
      psu: 'bg-red-100 text-red-800',
      case: 'bg-gray-100 text-gray-800',
      storage: 'bg-yellow-100 text-yellow-800'
    }
    return colors[category.toLowerCase()] || 'bg-gray-100 text-gray-800'
  }

  if (loading) {
    return (
      <main className="min-h-screen">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        </div>
        <Footer />
      </main>
    )
  }

  if (error) {
    return (
      <main className="min-h-screen">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Error Loading Products</h1>
            <p className="text-gray-600">{error}</p>
            <button 
              onClick={() => fetchProducts()}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Try Again
            </button>
          </div>
        </div>
        <Footer />
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Product Catalog</h1>
          <p className="text-gray-600">
            Browse {data?.pagination.total || 0} products from multiple vendors with real-time price comparison
          </p>
        </div>

        {/* Filters and Search */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Search */}
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search products, brands, or categories..."
                    defaultValue={searchTerm}
                    onChange={handleSearchChange}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Category Filter */}
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Categories</option>
                {data?.stats.categories.map((cat) => (
                  <option key={cat.category} value={cat.category}>
                    {cat.category.toUpperCase()} ({cat.count})
                  </option>
                ))}
              </select>

              {/* Brand Filter */}
              <select
                value={selectedBrand}
                onChange={(e) => setSelectedBrand(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Brands</option>
                {data?.stats.brands.map((brand) => (
                  <option key={brand.brand} value={brand.brand}>
                    {brand.brand} ({brand.count})
                  </option>
                ))}
              </select>

              <button
                type="submit"
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Search
              </button>
            </div>

            {/* Clear Filters */}
            {(searchTerm || selectedCategory || selectedBrand) && (
              <button
                type="button"
                onClick={clearFilters}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Clear all filters
              </button>
            )}
          </form>
        </div>

        {/* View Controls */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded ${viewMode === 'grid' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'}`}
            >
              <Grid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'}`}
            >
              <List className="h-4 w-4" />
            </button>
          </div>

          <div className="text-sm text-gray-600">
            Showing {data?.products.length || 0} of {data?.pagination.total || 0} products
          </div>
        </div>

        {/* Products Grid/List */}
        {data?.products.length === 0 ? (
          <div className="text-center py-12">
            <h3 className="text-lg font-medium text-gray-900 mb-2">No products found</h3>
            <p className="text-gray-600">Try adjusting your search or filters</p>
          </div>
        ) : (
          <div className={viewMode === 'grid' 
            ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'
            : 'space-y-4'
          }>
            {data?.products.map((product) => (
              <div
                key={product.productId}
                onClick={() => router.push(`/products/${product.productId}`)}
                className={`bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow cursor-pointer ${
                  viewMode === 'list' ? 'flex' : ''
                }`}
              >
                {/* Product Image */}
                <div className={`${viewMode === 'list' ? 'w-32 h-32' : 'w-full h-48'} bg-gray-100 flex items-center justify-center`}>
                  {product.imageUrls && product.imageUrls.length > 0 ? (
                    <img
                      src={product.imageUrls[0]}
                      alt={product.standardName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-gray-400 text-4xl">📦</div>
                  )}
                </div>

                {/* Product Info */}
                <div className={`p-4 ${viewMode === 'list' ? 'flex-1' : ''}`}>
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-gray-900 text-sm line-clamp-2">
                      {product.standardName}
                    </h3>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(product.category)}`}>
                      {product.category.toUpperCase()}
                    </span>
                  </div>

                  <p className="text-sm text-gray-600 mb-3">{product.brand}</p>

                  {/* Specifications */}
                  {product.keySpecsJson && Object.keys(product.keySpecsJson).length > 0 && (
                    <div className="mb-3">
                      <h4 className="text-xs font-medium text-gray-700 mb-1">Key Specs:</h4>
                      <div className="text-xs text-gray-600 space-y-1">
                        {Object.entries(product.keySpecsJson).slice(0, 3).map(([key, value]) => (
                          <div key={key}>
                            <span className="font-medium">{key}:</span> {String(value)}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Price */}
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-lg font-bold text-green-600">
                        {formatPrice(product.currentCheapestPrice)}
                      </div>
                      {product.priceEntries.length > 1 && (
                        <div className="text-xs text-gray-500">
                          from {product.priceEntries.length} vendors
                        </div>
                      )}
                    </div>
                    
                    {product.priceEntries.length > 0 && product.priceEntries[0].productUrl && (
                      <a
                        href={product.priceEntries[0].productUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                  </div>

                  {/* Vendor Info */}
                  {product.priceEntries.length > 0 && (
                    <div className="mt-2 text-xs text-gray-500">
                      {product.priceEntries.length === 1 ? (
                        <>via {product.priceEntries[0].vendor.name}</>
                      ) : (
                        <>from {product.priceEntries.length} vendors</>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {data && data.pagination.totalPages > 1 && (
          <div className="flex justify-center items-center space-x-2 mt-8">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="px-3 py-2 text-sm border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Previous
            </button>
            
            <span className="px-4 py-2 text-sm text-gray-600">
              Page {currentPage} of {data.pagination.totalPages}
            </span>
            
            <button
              onClick={() => setCurrentPage(prev => Math.min(data.pagination.totalPages, prev + 1))}
              disabled={currentPage === data.pagination.totalPages}
              className="px-3 py-2 text-sm border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Next
            </button>
          </div>
        )}
      </div>

      <Footer />
    </main>
  )
}
