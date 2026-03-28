'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Search, Filter, X, SlidersHorizontal, ArrowUpDown } from 'lucide-react'
import { Cpu, Monitor, MemoryStick, HardDrive, CircuitBoard, Zap as ZapIcon, Wind } from 'lucide-react'
import { CPUProduct } from '@/lib/types'
import { CATEGORIES, Category } from '@/lib/categories'
import { usePCBuilder } from '@/lib/contexts/PCBuilderContext'
import ProductCard from '@/components/ui/ProductCard'
import { CustomInput } from '@/components/ui/CustomInput'

interface CategoryProductsProps {
  initialCategory?: string
  searchQuery?: string
}

const iconMap: { [key: string]: any } = {
  Cpu,
  Monitor,
  MemoryStick,
  HardDrive,
  CircuitBoard,
  Zap: ZapIcon,
  Wind
}

type SortOption = 'price-asc' | 'price-desc' | 'vendor-desc' | 'name-asc' | 'name-desc'

export default function CategoryProducts({ initialCategory, searchQuery = '' }: CategoryProductsProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const { addToBuilder, builderItems } = usePCBuilder()
  const [products, setProducts] = useState<CPUProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState(searchQuery)
  const [selectedBrand, setSelectedBrand] = useState('')
  const categoryParam = searchParams.get('category')
  const [selectedCategory, setSelectedCategory] = useState(initialCategory || categoryParam || 'processor')
  const [brands, setBrands] = useState<{ brand: string; count: number }[]>([])
  const [sortBy, setSortBy] = useState<SortOption>('price-asc')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [minVendors, setMinVendors] = useState('')
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 12,
    totalPages: 0
  })

  const currentCategory = CATEGORIES.find(cat => cat.id === selectedCategory) || CATEGORIES[0]
  const CategoryIcon = iconMap[currentCategory.icon] || Cpu

  const fetchProducts = async (page = 1, searchTerm = '', brand = '', category = 'processor', sort: SortOption = 'price-asc') => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '12',
        category: category,
        ...(searchTerm && { search: searchTerm }),
        ...(brand && { brand })
      })

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000)

      const response = await fetch(`/api/products?${params}`, {
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()

      if (data.error) {
        console.error('Error fetching products:', data.error)
        return
      }

      let fetchedProducts: CPUProduct[] = data.products || []

      // Debug: Check if price_entries are being returned
      if (process.env.NODE_ENV === 'development' && fetchedProducts.length > 0) {
        console.log('Sample product from API:', {
          standard_name: fetchedProducts[0].standard_name,
          has_price_entries: !!fetchedProducts[0].price_entries,
          price_entries_count: fetchedProducts[0].price_entries?.length || 0,
          first_price_entry: fetchedProducts[0].price_entries?.[0]
        })
      }

      // Apply client-side filtering
      if (minPrice) {
        fetchedProducts = fetchedProducts.filter(p => p.min_price >= parseFloat(minPrice))
      }
      if (maxPrice) {
        fetchedProducts = fetchedProducts.filter(p => p.min_price <= parseFloat(maxPrice))
      }
      if (minVendors) {
        fetchedProducts = fetchedProducts.filter(p => p.vendor_count >= parseInt(minVendors))
      }

      // Apply client-side sorting
      fetchedProducts = sortProducts(fetchedProducts, sort)

      setProducts(fetchedProducts)
      setPagination(data.pagination || { total: 0, page: 1, limit: 12, totalPages: 0 })
      setBrands(data.stats?.brands || [])
    } catch (error: any) {
      console.error('Error fetching products:', error)
      if (error.name === 'AbortError') {
        console.error('Request timeout - API is taking too long')
      }
      setProducts([])
      setPagination({ total: 0, page: 1, limit: 12, totalPages: 0 })
      setBrands([])
    } finally {
      setLoading(false)
    }
  }

  const sortProducts = (products: CPUProduct[], sort: SortOption): CPUProduct[] => {
    const sorted = [...products]
    switch (sort) {
      case 'price-asc':
        return sorted.sort((a, b) => a.min_price - b.min_price)
      case 'price-desc':
        return sorted.sort((a, b) => b.min_price - a.min_price)
      case 'vendor-desc':
        return sorted.sort((a, b) => b.vendor_count - a.vendor_count)
      case 'name-asc':
        return sorted.sort((a, b) => a.standard_name.localeCompare(b.standard_name))
      case 'name-desc':
        return sorted.sort((a, b) => b.standard_name.localeCompare(a.standard_name))
      default:
        return sorted
    }
  }

  useEffect(() => {
    fetchProducts(1, search, selectedBrand, selectedCategory, sortBy)
  }, [search, selectedBrand, selectedCategory, sortBy])

  useEffect(() => {
    const nextCategory = initialCategory || categoryParam || 'processor'
    setSelectedCategory((prev) => (prev === nextCategory ? prev : nextCategory))
  }, [initialCategory, categoryParam])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchProducts(1, search, selectedBrand, selectedCategory, sortBy)
  }

  const handleProductClick = (product: CPUProduct) => {
    const productId = encodeURIComponent(product.standard_name)
    router.push(`/products/${selectedCategory}/${productId}`)
  }

  const handleAddToBuilder = (e: React.MouseEvent, product: CPUProduct) => {
    e.stopPropagation()
    addToBuilder(selectedCategory, product)
  }

  const isInBuilder = (product: CPUProduct) => {
    const builderProduct = builderItems[selectedCategory]
    if (!builderProduct) return false
    if (Array.isArray(builderProduct)) return builderProduct.some((p) => p?.id === product.id)
    return builderProduct.id === product.id
  }

  const getProductDisplayName = (product: CPUProduct): string => {
    // Try to get the first available raw_name from price entries
    if (product.price_entries && Array.isArray(product.price_entries) && product.price_entries.length > 0) {
      // Try the first entry
      const firstEntry = product.price_entries[0]
      if (firstEntry?.raw_name && typeof firstEntry.raw_name === 'string' && firstEntry.raw_name.trim()) {
        return firstEntry.raw_name.trim()
      }
      // If first entry doesn't have a valid raw_name, search for one that does
      for (const entry of product.price_entries) {
        if (entry?.raw_name && typeof entry.raw_name === 'string' && entry.raw_name.trim()) {
          return entry.raw_name.trim()
        }
      }
    }
    // Fallback to standard_name
    return product.standard_name || 'Unknown Product'
  }

  const handlePageChange = (newPage: number) => {
    fetchProducts(newPage, search, selectedBrand, selectedCategory, sortBy)
  }

  const handleCategoryChange = (categoryId: string) => {
    setSelectedCategory(categoryId)
    setSearch('')
    setSelectedBrand('')
    setMinPrice('')
    setMaxPrice('')
    setMinVendors('')

    const segments = (pathname || '').split('/').filter(Boolean)
    const isCategoryListingPage = segments[0] === 'products' && segments.length === 2

    if (isCategoryListingPage) {
      router.push(`/products/${categoryId}`, { scroll: false })
    } else {
      router.push(`?category=${categoryId}`, { scroll: false })
    }
  }

  const clearFilters = () => {
    setSearch('')
    setSelectedBrand('')
    setMinPrice('')
    setMaxPrice('')
    setMinVendors('')
    setSortBy('price-asc')
  }

  const hasActiveFilters = search || selectedBrand || minPrice || maxPrice || minVendors

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile Filter Button */}
      <div className="lg:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
        >
          <Filter className="h-4 w-4" />
          Filters
        </button>
        <div className="text-sm text-gray-600">
          {pagination.total} products
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex gap-6">
          {/* Sidebar */}
          <aside className={`
            ${isSidebarOpen ? 'fixed inset-0 z-50 bg-white' : 'hidden'} 
            lg:block lg:relative lg:z-auto
            w-full lg:w-80 flex-shrink-0
            bg-white rounded-lg shadow-md p-6
            overflow-y-auto lg:overflow-y-visible
            max-h-screen lg:max-h-none
          `}>
            {/* Mobile Close Button */}
            <div className="lg:hidden flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Filters</h2>
              <button
                onClick={() => setIsSidebarOpen(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Category Selection */}
            <div className="mb-6 pb-6 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
                <CategoryIcon className={`h-4 w-4 mr-2 text-${currentCategory.color}-600`} />
                Category
              </h3>
              <div className="space-y-2">
                {CATEGORIES.map((category) => {
                  const Icon = iconMap[category.icon] || Cpu
                  const isActive = selectedCategory === category.id
                  return (
                    <button
                      key={category.id}
                      onClick={() => handleCategoryChange(category.id)}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                        isActive
                          ? `${getCategoryButtonClass(category.color)} font-medium`
                          : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <Icon className={`h-4 w-4`} />
                      <span>{category.name}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Search */}
            <div className="mb-6 pb-6 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
                <Search className="h-4 w-4 mr-2 text-gray-600" />
                Search
              </h3>
              <form onSubmit={handleSearch}>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <CustomInput
                    type="text"
                    placeholder={`Search ${currentCategory.name.toLowerCase()}...`}
                    value={search}
                    onChange={(value) => setSearch(value)}
                    inputClassName="pl-10"
                    className=""
                    label="Search"
                  />
                </div>
              </form>
            </div>

            {/* Brand Filter */}
            <div className="mb-6 pb-6 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
                <SlidersHorizontal className="h-4 w-4 mr-2 text-gray-600" />
                Brand
              </h3>
              <select
                value={selectedBrand}
                onChange={(e) => setSelectedBrand(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
              >
                <option value="">All Brands</option>
                {brands.map((brand) => (
                  <option key={brand.brand} value={brand.brand}>
                    {brand.brand} ({brand.count})
                  </option>
                ))}
              </select>
            </div>

            {/* Price Range */}
            <div className="mb-6 pb-6 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Price Range (BDT)</h3>
              <div className="space-y-3">
                <div>
                  <CustomInput
                    type="number"
                    placeholder="0"
                    value={minPrice}
                    onChange={(value) => setMinPrice(value)}
                    label="Min Price"
                    className=""
                  />
                </div>
                <div>
                  <CustomInput
                    type="number"
                    placeholder="No limit"
                    value={maxPrice}
                    onChange={(value) => setMaxPrice(value)}
                    label="Max Price"
                    className=""
                  />
                </div>
              </div>
            </div>

            {/* Vendor Count */}
            <div className="mb-6 pb-6 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Minimum Vendors</h3>
              <CustomInput
                type="number"
                placeholder="Any"
                value={minVendors}
                onChange={(value) => setMinVendors(value)}
                label="Minimum Vendors"
                className=""
              />
            </div>

            {/* Clear Filters */}
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
              >
                Clear All Filters
              </button>
            )}
          </aside>

          {/* Main Content */}
          <main className="flex-1 min-w-0">
            {/* Header */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <div className="flex items-center mb-2">
                    <CategoryIcon className={`h-6 w-6 ${getCategoryIconColor(currentCategory.color)} mr-2`} />
                    <h1 className="text-2xl font-bold text-gray-900">{currentCategory.name}</h1>
                  </div>
                  <p className="text-sm text-gray-600">
                    {pagination.total} Logic-grouped products
                  </p>
                </div>

                {/* Sort */}
                <div className="flex items-center gap-3">
                  <ArrowUpDown className="h-4 w-4 text-gray-500" />
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortOption)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm font-medium"
                  >
                    <option value="price-asc">Price: Low to High</option>
                    <option value="price-desc">Price: High to Low</option>
                    <option value="vendor-desc">Most Vendors</option>
                    <option value="name-asc">Name: A-Z</option>
                    <option value="name-desc">Name: Z-A</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Loading State */}
            {loading && (
              <div className="flex flex-col justify-center items-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mb-4"></div>
                <p className="text-purple-600 font-medium">Loading products...</p>
              </div>
            )}

            {/* Products Grid */}
            {!loading && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {products.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      variant="detailed"
                      categoryIcon={CategoryIcon}
                      categoryIconColor={getCategoryIconColor(currentCategory.color, true)}
                      onProductClick={handleProductClick}
                      onAddToBuilder={handleAddToBuilder}
                      isInBuilder={isInBuilder}
                      getProductDisplayName={getProductDisplayName}
                    />
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
              <div className="text-center py-12 bg-white rounded-lg shadow-md">
                <CategoryIcon className={`h-16 w-16 ${getCategoryIconColor(currentCategory.color, true)} mx-auto mb-4`} />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No products found</h3>
                <p className="text-gray-600 mb-4">Try adjusting your search or filter criteria</p>
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  )
}

// Helper functions for dynamic colors
function getCategoryButtonClass(color: string): string {
  const colorMap: { [key: string]: string } = {
    blue: 'bg-blue-100 text-blue-700',
    purple: 'bg-purple-100 text-purple-700',
    green: 'bg-green-100 text-green-700',
    orange: 'bg-orange-100 text-orange-700',
    red: 'bg-red-100 text-red-700',
    yellow: 'bg-yellow-100 text-yellow-700',
    cyan: 'bg-cyan-100 text-cyan-700'
  }
  return colorMap[color] || 'bg-gray-100 text-gray-700'
}

function getCategoryIconColor(color: string, light: boolean = false): string {
  if (light) {
    const colorMap: { [key: string]: string } = {
      blue: 'text-blue-400',
      purple: 'text-purple-400',
      green: 'text-green-400',
      orange: 'text-orange-400',
      red: 'text-red-400',
      yellow: 'text-yellow-400',
      cyan: 'text-cyan-400'
    }
    return colorMap[color] || 'text-gray-400'
  } else {
    const colorMap: { [key: string]: string } = {
      blue: 'text-blue-600',
      purple: 'text-purple-600',
      green: 'text-green-600',
      orange: 'text-orange-600',
      red: 'text-red-600',
      yellow: 'text-yellow-600',
      cyan: 'text-cyan-600'
    }
    return colorMap[color] || 'text-gray-600'
  }
}
