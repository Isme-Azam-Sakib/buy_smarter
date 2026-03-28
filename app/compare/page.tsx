'use client'

import { useState, useEffect, useRef } from 'react'
import { Search, ExternalLink, ChevronDown } from 'lucide-react'
import Link from 'next/link'
import Header from '@/components/ui/Header'
import Footer from '@/components/ui/Footer'
import { CPUProduct, PriceEntry } from '@/lib/types'
import { formatPrice, getVendorLogo, getVendorDisplayName } from '@/lib/utils'
import { CATEGORIES } from '@/lib/categories'

interface ComparisonProduct extends CPUProduct {
  selectedEntry?: PriceEntry
}

export default function ComparePage() {
  const [selectedCategory, setSelectedCategory] = useState<string>('processor')
  const [products, setProducts] = useState<(ComparisonProduct | null)[]>([null, null, null])
  const [searchQueries, setSearchQueries] = useState<string[]>(['', '', ''])
  const [searchResults, setSearchResults] = useState<(CPUProduct[] | null)[]>([null, null, null])
  const [showDropdowns, setShowDropdowns] = useState<boolean[]>([false, false, false])
  const [loading, setLoading] = useState<boolean[]>([false, false, false])
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false)
  const searchTimeoutRefs = useRef<(NodeJS.Timeout | null)[]>([])
  const categoryDropdownRef = useRef<HTMLDivElement>(null)

  // Search for products in the selected category
  const searchProducts = async (query: string, columnIndex: number) => {
    if (!query.trim()) {
      setSearchResults(prev => {
        const newResults = [...prev]
        newResults[columnIndex] = null
        return newResults
      })
      return
    }

    setLoading(prev => {
      const newLoading = [...prev]
      newLoading[columnIndex] = true
      return newLoading
    })

    try {
      const response = await fetch(
        `/api/products?category=${encodeURIComponent(selectedCategory)}&search=${encodeURIComponent(query)}&limit=20`
      )
      if (!response.ok) throw new Error('Failed to search products')
      
      const data = await response.json()
      console.log(`Search for "${query}" in category "${selectedCategory}" found ${data.products?.length || 0} products`)
      
      setSearchResults(prev => {
        const newResults = [...prev]
        newResults[columnIndex] = data.products || []
        return newResults
      })
    } catch (error) {
      console.error('Error searching products:', error)
      setSearchResults(prev => {
        const newResults = [...prev]
        newResults[columnIndex] = []
        return newResults
      })
    } finally {
      setLoading(prev => {
        const newLoading = [...prev]
        newLoading[columnIndex] = false
        return newLoading
      })
    }
  }

  // Handle search input change with debounce
  const handleSearchChange = (value: string, columnIndex: number) => {
    const newQueries = [...searchQueries]
    newQueries[columnIndex] = value
    setSearchQueries(newQueries)

    // Clear existing timeout
    if (searchTimeoutRefs.current[columnIndex]) {
      clearTimeout(searchTimeoutRefs.current[columnIndex])
    }

    // Show dropdown when typing
    if (value.trim()) {
      setShowDropdowns(prev => {
        const newShow = [...prev]
        newShow[columnIndex] = true
        return newShow
      })
    } else {
      setShowDropdowns(prev => {
        const newShow = [...prev]
        newShow[columnIndex] = false
        return newShow
      })
    }

    // Debounce search
    searchTimeoutRefs.current[columnIndex] = setTimeout(() => {
      searchProducts(value, columnIndex)
    }, 300)
  }

  // Select a product
  const selectProduct = async (product: CPUProduct, columnIndex: number) => {
    try {
      // Use the product data we already have from search
      // Find the cheapest in-stock entry
      const inStockEntries = (product.price_entries || []).filter(
        e => (e.availability_status === 'in_stock' || e.availability_status === 'limited') && e.price_bdt > 0
      )
      const cheapestEntry = inStockEntries.length > 0
        ? inStockEntries.reduce((cheapest, current) => 
            current.price_bdt < cheapest.price_bdt ? current : cheapest
          )
        : product.price_entries?.[0]

      const newProducts = [...products]
      newProducts[columnIndex] = {
        ...product,
        selectedEntry: cheapestEntry
      }
      setProducts(newProducts)

      // Close dropdown and clear search
      setShowDropdowns(prev => {
        const newShow = [...prev]
        newShow[columnIndex] = false
        return newShow
      })
      setSearchQueries(prev => {
        const newQueries = [...prev]
        newQueries[columnIndex] = ''
        return newQueries
      })
    } catch (error) {
      console.error('Error selecting product:', error)
    }
  }

  // Remove a product
  const removeProduct = (columnIndex: number) => {
    const newProducts = [...products]
    newProducts[columnIndex] = null
    setProducts(newProducts)
  }

  // Get product description as array
  const getProductDescription = (product: ComparisonProduct): string[] => {
    if (!product.selectedEntry?.description) return []
    
    const desc = product.selectedEntry.description
    if (!desc || typeof desc !== 'string') return []

    // Try to parse as JSON array
    try {
      const parsed = JSON.parse(desc)
      if (Array.isArray(parsed)) {
        return parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      }
    } catch {
      // Not JSON, continue with string processing
    }

    // Split by common delimiters
    const delimiters = [', ', '; ', ' | ', '\n']
    for (const delimiter of delimiters) {
      if (desc.includes(delimiter)) {
        return desc.split(delimiter).map(item => item.trim()).filter(Boolean)
      }
    }

    return [desc]
  }

  // Get a user-friendly display name for search results
  const getSearchDisplayName = (product: CPUProduct): string => {
    const firstEntry = product.price_entries && product.price_entries[0]
    if (firstEntry?.raw_name && typeof firstEntry.raw_name === 'string' && firstEntry.raw_name.trim()) {
      return firstEntry.raw_name.trim()
    }
    return product.standard_name
  }

  // Get cheapest entry for search result display
  const getCheapestEntryForSearch = (product: CPUProduct): PriceEntry | null => {
    const entries = product.price_entries || []
    if (!entries.length) return null
    const inStock = entries.filter(
      (e) =>
        (e.availability_status === 'in_stock' || e.availability_status === 'limited') &&
        typeof e.price_bdt === 'number' &&
        e.price_bdt > 0
    )
    const source = inStock.length ? inStock : entries.filter((e) => typeof e.price_bdt === 'number' && e.price_bdt > 0)
    if (!source.length) return entries[0]
    return source.reduce((cheapest, current) =>
      current.price_bdt < cheapest.price_bdt ? current : cheapest
    )
  }

  // Get product model (extract from raw_name or standard_name)
  const getProductModel = (product: ComparisonProduct): string => {
    if (product.selectedEntry?.raw_name) {
      return product.selectedEntry.raw_name
    }
    return product.standard_name
  }

  // Get cheapest vendor entry
  const getCheapestEntry = (product: ComparisonProduct): PriceEntry | null => {
    if (product.selectedEntry) return product.selectedEntry
    
    const inStockEntries = (product.price_entries || []).filter(
      e => (e.availability_status === 'in_stock' || e.availability_status === 'limited') && e.price_bdt > 0
    )
    
    if (inStockEntries.length === 0) return null
    
    return inStockEntries.reduce((cheapest, current) => 
      current.price_bdt < cheapest.price_bdt ? current : cheapest
    )
  }

  // Handle category change - clear all products
  const handleCategoryChange = (categoryId: string) => {
    setSelectedCategory(categoryId)
    setProducts([null, null, null])
    setSearchQueries(['', '', ''])
    setSearchResults([null, null, null])
    setShowDropdowns([false, false, false])
  }

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target.closest('.search-container') && !target.closest('.category-dropdown')) {
        setShowDropdowns([false, false, false])
        setCategoryDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      searchTimeoutRefs.current.forEach(timeout => {
        if (timeout) clearTimeout(timeout)
      })
    }
  }, [])

  const selectedCategoryData = CATEGORIES.find(cat => cat.id === selectedCategory) || CATEGORIES[0]

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Left Side - Title, Description, and Category Selector */}
          <div className="lg:col-span-1">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              Product Comparison
            </h1>
            <p className="text-gray-600 text-sm leading-relaxed mb-6">
              Find and select products to see the differences and similarities between them and grab the best one at the best price!
            </p>
            
            {/* Category Dropdown */}
            <div className="relative category-dropdown" ref={categoryDropdownRef}>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Choose a category
              </label>
              <button
                onClick={() => setCategoryDropdownOpen(!categoryDropdownOpen)}
                className="w-full flex items-center justify-between px-4 py-2 bg-white border border-gray-300 rounded-lg hover:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <span className="text-gray-900">{selectedCategoryData.name}</span>
                <ChevronDown className={`h-5 w-5 text-gray-500 transition-transform ${categoryDropdownOpen ? 'transform rotate-180' : ''}`} />
              </button>
              
              {categoryDropdownOpen && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                  <ul className="py-1">
                    {CATEGORIES.map((category) => (
                      <li
                        key={category.id}
                        onClick={() => {
                          handleCategoryChange(category.id)
                          setCategoryDropdownOpen(false)
                        }}
                        className={`px-4 py-2 cursor-pointer hover:bg-purple-50 transition-colors ${
                          selectedCategory === category.id ? 'bg-purple-50 text-purple-700 font-medium' : 'text-gray-900'
                        }`}
                      >
                        {category.name}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* Right Side - Comparison Table */}
          <div className="lg:col-span-4">
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              {/* Table Header with Search Bars */}
              <div className="grid grid-cols-4 border-b border-gray-200 bg-gray-50">
                <div className="px-4 py-3 font-semibold text-gray-700 border-r border-gray-200">
                  Specifications
                </div>
                {[0, 1, 2].map((columnIndex) => {
                  const product = products[columnIndex]
                  const searchQuery = searchQueries[columnIndex]
                  const results = searchResults[columnIndex]
                  const showDropdown = showDropdowns[columnIndex]
                  const isLoading = loading[columnIndex]

                  return (
                    <div key={columnIndex} className="px-4 py-3 border-r border-gray-200 last:border-r-0 relative search-container">
                      <div className="relative">
                        <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                        <input
                          type="text"
                          placeholder="Search and Select Product"
                          value={searchQuery}
                          onChange={(e) => handleSearchChange(e.target.value, columnIndex)}
                          onFocus={() => {
                            if (searchQuery.trim() && results) {
                              setShowDropdowns(prev => {
                                const newShow = [...prev]
                                newShow[columnIndex] = true
                                return newShow
                              })
                            }
                          }}
                          className="w-full pl-8 pr-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        />
                      </div>

                      {/* Search Results Dropdown */}
                      {showDropdown && (results !== null || isLoading) && (
                        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                          {isLoading ? (
                            <div className="p-3 text-center text-sm text-gray-500">Searching...</div>
                          ) : results && results.length > 0 ? (
                            <ul className="py-1">
                              {results.map((result) => {
                                const cheapestEntry = getCheapestEntryForSearch(result)
                                const vendorLabel = cheapestEntry
                                  ? getVendorDisplayName(cheapestEntry.vendor_name)
                                  : ''
                                const priceValue =
                                  typeof cheapestEntry?.price_bdt === 'number' && cheapestEntry.price_bdt > 0
                                    ? cheapestEntry.price_bdt
                                    : result.min_price

                                return (
                                  <li
                                    key={result.standard_name}
                                    onClick={() => selectProduct(result, columnIndex)}
                                    className="px-3 py-2 hover:bg-purple-50 cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors"
                                  >
                                    <div className="font-medium text-sm text-gray-900">
                                      {getSearchDisplayName(result)}
                                    </div>
                                    <div className="text-xs text-gray-500 mt-0.5">
                                      {vendorLabel && (
                                        <span className="mr-1">{vendorLabel}</span>
                                      )}
                                      {vendorLabel && '• '}{formatPrice(priceValue)}
                                    </div>
                                  </li>
                                )
                              })}
                            </ul>
                          ) : (
                            <div className="p-3 text-center text-sm text-gray-500">
                              {searchQuery.trim() ? 'No products found' : 'Start typing to search...'}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Comparison Rows */}
              <div className="divide-y divide-gray-200">
                {/* Product Image Row */}
                <div className="grid grid-cols-4">
                  <div className="px-4 py-3 font-medium text-gray-700 bg-gray-50 border-r border-gray-200">
                    Product Image
                  </div>
                  {[0, 1, 2].map((columnIndex) => {
                    const product = products[columnIndex]
                    const cheapestEntry = product ? getCheapestEntry(product) : null

                    return (
                      <div key={columnIndex} className="px-4 py-3 border-r border-gray-200 last:border-r-0">
                        {product && cheapestEntry?.image_url ? (
                          <img
                            src={cheapestEntry.image_url}
                            alt={product.standard_name}
                            className="w-full h-48 object-contain bg-gray-50 rounded"
                          />
                        ) : (
                          <div className="w-full h-48 bg-gray-100 rounded flex items-center justify-center">
                            <span className="text-gray-400 text-sm">No product selected</span>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Product Name Row */}
                <div className="grid grid-cols-4">
                  <div className="px-4 py-3 font-medium text-gray-700 bg-gray-50 border-r border-gray-200">
                    Product Name
                  </div>
                  {[0, 1, 2].map((columnIndex) => {
                    const product = products[columnIndex]
                    const cheapestEntry = product ? getCheapestEntry(product) : null

                    return (
                      <div key={columnIndex} className="px-4 py-3 border-r border-gray-200 last:border-r-0">
                        {product ? (
                          <div className="text-sm text-gray-900">
                            <Link
                              href={`/products/${selectedCategory}/${encodeURIComponent(
                                product.standard_name
                              )}`}
                              className="text-purple-700 hover:text-purple-900 hover:underline"
                            >
                              {cheapestEntry?.raw_name || product.standard_name}
                            </Link>
                          </div>
                        ) : (
                          <div className="text-sm text-gray-400">-</div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Vendor Row */}
                <div className="grid grid-cols-4">
                  <div className="px-4 py-3 font-medium text-gray-700 bg-gray-50 border-r border-gray-200">
                    Cheapest Vendor
                  </div>
                  {[0, 1, 2].map((columnIndex) => {
                    const product = products[columnIndex]
                    const cheapestEntry = product ? getCheapestEntry(product) : null

                    return (
                      <div key={columnIndex} className="px-4 py-3 border-r border-gray-200 last:border-r-0">
                        {product && cheapestEntry ? (
                          <div className="flex items-center gap-2">
                            <img
                              src={getVendorLogo(cheapestEntry.vendor_name)}
                              alt={cheapestEntry.vendor_name}
                              className="h-8 w-8 object-contain"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = '/assets/images.jpg'
                              }}
                            />
                            <div className="text-sm font-medium text-gray-900">
                              {getVendorDisplayName(cheapestEntry.vendor_name)}
                            </div>
                          </div>
                        ) : (
                          <div className="text-sm text-gray-400">-</div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Price Row */}
                <div className="grid grid-cols-4">
                  <div className="px-4 py-3 font-medium text-gray-700 bg-gray-50 border-r border-gray-200">
                    Cheapest Price
                  </div>
                  {[0, 1, 2].map((columnIndex) => {
                    const product = products[columnIndex]
                    const cheapestEntry = product ? getCheapestEntry(product) : null

                    return (
                      <div key={columnIndex} className="px-4 py-3 border-r border-gray-200 last:border-r-0">
                        {product && cheapestEntry && cheapestEntry.price_bdt > 0 ? (
                          <div>
                            <div className="text-lg font-bold text-purple-600 mb-1">
                              {formatPrice(cheapestEntry.price_bdt)}
                            </div>
                            {cheapestEntry.product_url && (
                              <a
                                href={cheapestEntry.product_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-purple-600 hover:text-purple-700 font-medium"
                              >
                                View in shop <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                          </div>
                        ) : (
                          <div className="text-sm text-gray-400">-</div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Model Row */}
                <div className="grid grid-cols-4">
                  <div className="px-4 py-3 font-medium text-gray-700 bg-gray-50 border-r border-gray-200">
                    Model
                  </div>
                  {[0, 1, 2].map((columnIndex) => {
                    const product = products[columnIndex]

                    return (
                      <div key={columnIndex} className="px-4 py-3 border-r border-gray-200 last:border-r-0">
                        {product ? (
                          <div className="text-sm text-gray-900">{getProductModel(product)}</div>
                        ) : (
                          <div className="text-sm text-gray-400">-</div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Brand Row */}
                <div className="grid grid-cols-4">
                  <div className="px-4 py-3 font-medium text-gray-700 bg-gray-50 border-r border-gray-200">
                    Brand
                  </div>
                  {[0, 1, 2].map((columnIndex) => {
                    const product = products[columnIndex]

                    return (
                      <div key={columnIndex} className="px-4 py-3 border-r border-gray-200 last:border-r-0">
                        {product ? (
                          <div className="text-sm text-gray-900">{product.brand || 'N/A'}</div>
                        ) : (
                          <div className="text-sm text-gray-400">-</div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Description Row */}
                <div className="grid grid-cols-4">
                  <div className="px-4 py-3 font-medium text-gray-700 bg-gray-50 border-r border-gray-200">
                    Description
                  </div>
                  {[0, 1, 2].map((columnIndex) => {
                    const product = products[columnIndex]
                    const description = product ? getProductDescription(product) : []

                    return (
                      <div key={columnIndex} className="px-4 py-3 border-r border-gray-200 last:border-r-0">
                        {product && description.length > 0 ? (
                          <ul className="text-sm text-gray-700 space-y-1">
                            {description.map((item, idx) => (
                              <li key={idx} className="flex items-start">
                                <span className="mr-2">•</span>
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <div className="text-sm text-gray-400">-</div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  )
}
