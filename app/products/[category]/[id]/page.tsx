'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, ExternalLink, CheckCircle, AlertCircle, TrendingUp, Users, Package, Loader2, Sparkles, Star, ChevronRight, RefreshCw } from 'lucide-react'
import Link from 'next/link'
import { CPUProduct, PriceEntry } from '@/lib/types'
import { formatPrice, formatDate, getBrandColor, getAvailabilityColor, getAvailabilityText, getVendorLogo, getVendorDisplayName, getTimeAgo } from '@/lib/utils'
import { CATEGORIES, getCategoryById } from '@/lib/categories'
import { Cpu, Monitor, MemoryStick, HardDrive, CircuitBoard, Zap as ZapIcon, Wind } from 'lucide-react'
import Header from '@/components/ui/Header'
import Footer from '@/components/ui/Footer'
import SimilarProducts from '@/components/features/SimilarProducts'
import PriceRefreshPreferenceModal, { PriceRefreshPreference } from '@/components/features/PriceRefreshPreferenceModal'

const iconMap: { [key: string]: any } = {
  Cpu,
  Monitor,
  MemoryStick,
  HardDrive,
  CircuitBoard,
  Zap: ZapIcon,
  Wind
}

const PREFERENCE_STORAGE_KEY = 'priceRefreshPreference'

export default function CategoryProductDetail() {
  const params = useParams()
  const router = useRouter()
  const categoryId = params.category as string
  const productId = params.id as string
  const [product, setProduct] = useState<CPUProduct | null>(null)
  const [loading, setLoading] = useState(false) // Start false, will be set true when we fetch
  const [error, setError] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<'price' | 'vendor'>('price')
  const [filterVendor, setFilterVendor] = useState<string>('')
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  const [aiProduct, setAiProduct] = useState<CPUProduct | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [showPreferenceModal, setShowPreferenceModal] = useState(false)
  const [preference, setPreference] = useState<PriceRefreshPreference | null>(null) // Start null until loaded
  const [refreshing, setRefreshing] = useState(false)
  const [refreshMessage, setRefreshMessage] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [preferenceLoaded, setPreferenceLoaded] = useState(false)
  const AI_FEATURE_ENABLED = false

  const category = getCategoryById(categoryId) || CATEGORIES[0]
  const CategoryIcon = iconMap[category.icon] || Cpu

  // Fetch product based on preference
  const fetchProduct = async (
    forceRefresh = false,
    currentPreference?: PriceRefreshPreference,
    options: { suppressError?: boolean; useLoading?: boolean } = {}
  ) => {
    const { suppressError = false, useLoading = true } = options
    try {
      if (useLoading) {
        setLoading(true)
      }
      setError(null)
      
      // Determine if we should refresh based on preference or forceRefresh
      const pref = currentPreference || preference
      const shouldRefresh = forceRefresh || pref === 'always'

      const params = new URLSearchParams()
      if (shouldRefresh) {
        params.set('refresh', 'true')
      }
      // Cache buster to avoid stale responses after refresh
      params.set('ts', Date.now().toString())

      const response = await fetch(
        `/api/products/${categoryId}/${productId}${params.toString() ? `?${params.toString()}` : ''}`,
        { cache: 'no-store' }
      )
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const data: CPUProduct = await response.json()
      setProduct(data)
    } catch (err) {
      console.error('Failed to fetch product:', err)
      if (suppressError) {
        setRefreshMessage({
          type: 'error',
          message: 'Failed to load updated prices. Showing last available data.',
        })
      } else {
        setError('Failed to load product details. Please try again.')
      }
    } finally {
      if (useLoading) {
        setLoading(false)
      }
    }
  }

  // Load preference from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedPreference = localStorage.getItem(PREFERENCE_STORAGE_KEY) as PriceRefreshPreference | null
      if (storedPreference && ['fast', 'manual', 'always'].includes(storedPreference)) {
        setPreference(storedPreference)
        setPreferenceLoaded(true)
      } else {
        // First visit - show modal, but set preference to 'fast' as default
        setPreference('fast')
        setShowPreferenceModal(true)
        setPreferenceLoaded(true)
      }
    }
  }, [])

  // Save preference to localStorage
  const handlePreferenceSelect = (pref: PriceRefreshPreference) => {
    setPreference(pref)
    if (typeof window !== 'undefined') {
      localStorage.setItem(PREFERENCE_STORAGE_KEY, pref)
    }
    setShowPreferenceModal(false)
    // Fetch product based on preference
    if (pref === 'always') {
      fetchProduct(true, pref)
    } else {
      // For fast/manual, fetch without refresh
      fetchProduct(false, pref)
    }
  }

  // Fetch product when category/productId changes (only after preference is loaded)
  useEffect(() => {
    // Always fetch product once preference is loaded, regardless of modal state
    // Modal is just a UI overlay and shouldn't block data fetching
    if (preferenceLoaded && preference) {
      // When modal is shown (first visit), fetch with 'fast' mode (cached)
      // Otherwise use the user's preference
      const prefToUse = showPreferenceModal ? 'fast' : preference
      fetchProduct(false, prefToUse)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryId, productId, preferenceLoaded, preference])

  // Manual refresh handler
  const handleManualRefresh = async () => {
    setRefreshing(true)
    setRefreshMessage(null)
    try {
      // First trigger the refresh
      const refreshResponse = await fetch(
        `/api/products/${categoryId}/${productId}/refresh`,
        { method: 'POST' }
      )

      let refreshData: any = null
      try {
        refreshData = await refreshResponse.json()
      } catch {
        refreshData = null
      }

      // Check for HTTP errors or Python script failures
      if (!refreshResponse.ok) {
        // HTTP error (4xx, 5xx)
        let errorMsg = refreshData?.error || 'Failed to refresh product prices. Please try again.'
        
        // Include stderr details if available
        if (refreshData?.stderr) {
          const stderrLines = refreshData.stderr.split('\n').filter((line: string) => line.trim())
          const errorPatterns = [
            /ModuleNotFoundError/i,
            /FileNotFoundError/i,
            /PermissionError/i,
            /ConnectionError/i,
            /Timeout/i,
            /Error:/i,
          ]
          
          let relevantError = null
          for (const line of stderrLines.reverse()) {
            for (const pattern of errorPatterns) {
              if (pattern.test(line)) {
                relevantError = line.trim()
                break
              }
            }
            if (relevantError) break
          }
          
          if (!relevantError && stderrLines.length > 0) {
            relevantError = stderrLines[stderrLines.length - 1].trim()
          }
          
          if (relevantError && relevantError.length < 200) {
            errorMsg = `${errorMsg} Details: ${relevantError}`
          }
        }
        
        setRefreshMessage({
          type: 'error',
          message: errorMsg,
        })
        return
      }
      
      // Check if Python script returned success=false in JSON
      if (refreshData?.success === false) {
        setRefreshMessage({
          type: 'error',
          message: refreshData?.error || 'Scraping failed. Please try again.',
        })
        return
      }

      const scrapedCount = Number(refreshData?.scraped_count ?? refreshData?.results?.length ?? 0)

      // Wait a moment for database to update
      await new Promise(resolve => setTimeout(resolve, 1200))

      // Then fetch the updated product without blocking the page
      await fetchProduct(false, preference || undefined, { suppressError: true, useLoading: false })

      if (scrapedCount > 0) {
        setRefreshMessage({
          type: 'success',
          message: `Prices updated from ${scrapedCount} vendor${scrapedCount === 1 ? '' : 's'}.`,
        })
      } else {
        setRefreshMessage({
          type: 'error',
          message: 'No vendor prices were updated. The product URLs may be missing or unavailable.',
        })
      }
    } catch (err) {
      console.error('Failed to refresh product:', err)
      setRefreshMessage({
        type: 'error',
        message: 'Failed to refresh product prices. Please try again.',
      })
    } finally {
      setRefreshing(false)
    }
  }

  const handleAiGrouping = async () => {
    try {
      setAiLoading(true)
      setAiError(null)
      const res = await fetch(`/api/products/${categoryId}/${productId}/ai`)
      if (!res.ok) {
        throw new Error('Failed to run AI grouping')
      }
      const data = await res.json()
      setAiProduct(data.product)
    } catch (err: any) {
      console.error('AI regroup failed', err)
      setAiError(err.message ?? 'Unable to run AI grouping')
    } finally {
      setAiLoading(false)
    }
  }

  // Helper function to check if item is in stock
  const isInStock = (entry: PriceEntry): boolean => {
    const status = entry.availability_status?.toLowerCase() || ''
    return status === 'in_stock' || status === 'limited'
  }

  // Get in-stock price entries only
  const getInStockEntries = (entries: PriceEntry[]): PriceEntry[] => {
    return entries.filter(entry => isInStock(entry) && entry.price_bdt != null && entry.price_bdt > 0)
  }

  // Calculate prices from in-stock items only
  const calculateInStockPrices = (entries: PriceEntry[]) => {
    const inStockEntries = getInStockEntries(entries)
    if (inStockEntries.length === 0) {
      return {
        min_price: null,
        max_price: null,
        avg_price: null,
        price_range: null
      }
    }
    
    const prices = inStockEntries.map(e => e.price_bdt!).filter(p => p > 0)
    const min_price = Math.min(...prices)
    const max_price = Math.max(...prices)
    const avg_price = prices.reduce((sum, p) => sum + p, 0) / prices.length
    const price_range = max_price - min_price
    
    return {
      min_price,
      max_price,
      avg_price,
      price_range
    }
  }

  const sortPriceEntries = (entries: PriceEntry[]) => {
    const filtered = filterVendor 
      ? entries.filter(entry => entry.vendor_name.toLowerCase().includes(filterVendor.toLowerCase()))
      : entries
    
    return [...filtered].sort((a, b) => {
      if (sortBy === 'price') {
        // Handle NULL prices - put them at the end
        if (a.price_bdt == null && b.price_bdt == null) return 0
        if (a.price_bdt == null) return 1
        if (b.price_bdt == null) return -1
        return a.price_bdt - b.price_bdt
      }
      return a.vendor_name.localeCompare(b.vendor_name)
    })
  }

  // Don't show loading spinner if modal is open or preference not loaded yet
  if (loading && preferenceLoaded && !showPreferenceModal) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <PriceRefreshPreferenceModal
          isOpen={showPreferenceModal}
          onClose={() => {
            setShowPreferenceModal(false)
            if (!localStorage.getItem(PREFERENCE_STORAGE_KEY)) {
              handlePreferenceSelect('fast')
            }
          }}
          onSelect={handlePreferenceSelect}
        />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-purple-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              {preference === 'always' ? 'Collecting updated prices...' : 'Loading product...'}
            </h2>
            <p className="text-gray-600">
              {preference === 'always' 
                ? 'Fetching latest prices and availability from all vendors' 
                : 'Loading product details'}
            </p>
          </div>
        </div>
        <Footer />
      </div>
    )
  }

  // Only show error if we've finished loading, preference is loaded, and there's an actual error
  // Don't show error during initial loading or while waiting for preference to load
  if (error && !loading && preferenceLoaded) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <PriceRefreshPreferenceModal
          isOpen={showPreferenceModal}
          onClose={() => {
            if (typeof window !== 'undefined' && !localStorage.getItem(PREFERENCE_STORAGE_KEY)) {
              handlePreferenceSelect('fast')
            } else {
              setShowPreferenceModal(false)
            }
          }}
          onSelect={handlePreferenceSelect}
        />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Product Not Found</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <Link 
              href="/"
              className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Link>
          </div>
        </div>
        <Footer />
      </div>
    )
  }

  // Show "not found" only if we've finished loading and there's no product
  // After this check, if product is still null but we're not loading, show error
  if (!product) {
    if (!loading && preferenceLoaded) {
      return (
        <div className="min-h-screen bg-gray-50">
          <Header />
          <PriceRefreshPreferenceModal
            isOpen={showPreferenceModal}
            onClose={() => {
              if (typeof window !== 'undefined' && !localStorage.getItem(PREFERENCE_STORAGE_KEY)) {
                handlePreferenceSelect('fast')
              } else {
                setShowPreferenceModal(false)
              }
            }}
            onSelect={handlePreferenceSelect}
          />
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Product Not Found</h2>
              <p className="text-gray-600 mb-4">The product you are looking for does not exist.</p>
              <Link 
                href="/"
                className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Home
              </Link>
            </div>
          </div>
          <Footer />
        </div>
      )
    }
    // Still loading or preference not loaded yet, show loading state
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <PriceRefreshPreferenceModal
          isOpen={showPreferenceModal}
          onClose={() => {
            if (typeof window !== 'undefined' && !localStorage.getItem(PREFERENCE_STORAGE_KEY)) {
              handlePreferenceSelect('fast')
            } else {
              setShowPreferenceModal(false)
            }
          }}
          onSelect={handlePreferenceSelect}
        />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-purple-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Loading product...</h2>
          </div>
        </div>
        <Footer />
      </div>
    )
  }

  // At this point, product must not be null (all early returns handled above)
  if (!product) {
    return null // This should never happen, but satisfies TypeScript
  }

  const sortedEntries = sortPriceEntries(product.price_entries || [])
  const uniqueVendors = Array.from(new Set(product.price_entries?.map(e => e.vendor_name) || []))
  
  // Calculate prices from in-stock items only
  const inStockPrices = calculateInStockPrices(product.price_entries || [])

  // Get product display name (vendor-listed name)
  const getProductDisplayName = (product: CPUProduct): string => {
    if (product.price_entries && Array.isArray(product.price_entries) && product.price_entries.length > 0) {
      const firstEntry = product.price_entries[0]
      if (firstEntry?.raw_name && typeof firstEntry.raw_name === 'string' && firstEntry.raw_name.trim()) {
        return firstEntry.raw_name.trim()
      }
      for (const entry of product.price_entries) {
        if (entry?.raw_name && typeof entry.raw_name === 'string' && entry.raw_name.trim()) {
          return entry.raw_name.trim()
        }
      }
    }
    return product.standard_name || 'Unknown Product'
  }

  // Get and format product description as bullet points
  const getProductDescription = (): string[] => {
    if (!product.price_entries || product.price_entries.length === 0) return []
    
    // Collect all non-empty descriptions
    const descriptions = product.price_entries
      .map(entry => entry.description)
      .filter((desc): desc is string => !!desc && typeof desc === 'string' && desc.trim().length > 0)
    
    if (descriptions.length === 0) return []
    
    // Get the longest/most complete description
    const longestDescription = descriptions.reduce((longest, current) => 
      current.length > longest.length ? current : longest
    )
    
    // Try to parse as JSON array if it looks like one
    let parsed: string[] = []
    try {
      const jsonParsed = JSON.parse(longestDescription)
      if (Array.isArray(jsonParsed)) {
        parsed = jsonParsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      }
    } catch {
      // Not JSON, continue with string processing
    }
    
    // If we got an array from JSON parsing, use it
    if (parsed.length > 0) {
      return parsed.map(item => item.trim())
    }
    
    // Otherwise, try to split by common delimiters
    const delimiters = [', ', '; ', ' | ', '\n']
    let items: string[] = [longestDescription]
    
    for (const delimiter of delimiters) {
      if (longestDescription.includes(delimiter)) {
        items = longestDescription.split(delimiter).map(item => item.trim()).filter(Boolean)
        break
      }
    }
    
    // If we have multiple items, return them; otherwise return as single item
    return items.length > 1 ? items : [longestDescription]
  }

  const productDescriptionItems = getProductDescription()
  const productImages = product.images || []
  const mainImage = productImages[selectedImageIndex] || productImages[0]

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      {/* Price Refresh Preference Modal */}
      <PriceRefreshPreferenceModal
        isOpen={showPreferenceModal}
        onClose={() => {
          // If user closes without selecting, default to 'fast'
          if (typeof window !== 'undefined' && !localStorage.getItem(PREFERENCE_STORAGE_KEY)) {
            handlePreferenceSelect('fast')
          } else {
            setShowPreferenceModal(false)
          }
        }}
        onSelect={handlePreferenceSelect}
      />
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link 
            href="/"
            className="inline-flex items-center text-purple-600 hover:text-purple-700 mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Products
          </Link>
          <div className="flex items-center gap-2">
            <CategoryIcon className={`h-6 w-6 ${getCategoryIconColor(category.color)}`} />
            <span className="text-sm text-gray-500">{category.name}</span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Product Details - Image top center, product info + price comparison below */}

          {/* Image Viewer - top, centered alone */}
          <div className="flex justify-center mb-8">
            <div className="bg-white rounded-lg shadow-md p-6 w-full max-w-2xl">
              <div className="flex gap-4">
                {/* Vertical thumbnail strip on the left */}
                {productImages.length > 1 && (
                  <div className="flex flex-col gap-2 overflow-y-auto max-h-[400px]">
                    {productImages.map((image, index) => (
                      <button
                        key={index}
                        onClick={() => setSelectedImageIndex(index)}
                        className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                          selectedImageIndex === index
                            ? 'border-purple-600 ring-2 ring-purple-200'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <img
                          src={image}
                          alt={`${getProductDisplayName(product)} - View ${index + 1}`}
                          className="w-full h-full object-contain bg-gray-50"
                        />
                      </button>
                    ))}
                  </div>
                )}
                {/* Main image */}
                <div className="flex-1">
                  {mainImage ? (
                    <div className="w-72 h-72 mx-auto bg-gray-50 rounded-lg overflow-hidden flex items-center justify-center">
                      <img
                        src={mainImage}
                        alt={getProductDisplayName(product)}
                        className="w-full h-full object-contain"
                      />
                    </div>
                  ) : (
                    <div className="w-72 h-72 mx-auto bg-gray-100 rounded-lg flex items-center justify-center">
                      <CategoryIcon className={`h-24 w-24 ${getCategoryIconColor(category.color, true)}`} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

        {/* Bottom row: product info left, price comparison right */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8 items-start">

          {/* Left Column: Product Info */}
          <div className="bg-white rounded-lg shadow-md p-6">
              {/* Brand Tag */}
              <div className="mb-3">
                <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getBrandColor(product.brand)}`}>
                  {product.brand}
                </span>
              </div>

              {/* Product Name */}
              <h1 className="text-3xl font-bold text-gray-900 mb-4">
                {getProductDisplayName(product)}
              </h1>

              {/* Price Section */}
              <div className="mb-6 pb-6 border-b border-gray-200">
                {inStockPrices.min_price != null ? (
                  <>
                    <div className="flex items-baseline gap-3 mb-2">
                      <span className="text-4xl font-bold text-green-600">
                        {formatPrice(inStockPrices.min_price)}
                      </span>
                      {inStockPrices.max_price && inStockPrices.max_price !== inStockPrices.min_price && (
                        <span className="text-lg text-gray-500">
                          - {formatPrice(inStockPrices.max_price)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        {product.vendor_count} {product.vendor_count === 1 ? 'vendor' : 'vendors'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Package className="h-4 w-4" />
                        {getInStockEntries(product.price_entries || []).length} in stock
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-4">
                    <div className="text-2xl font-bold text-gray-400 mb-2">Not Available</div>
                    <div className="text-sm text-gray-500">No in-stock items found</div>
                  </div>
                )}
              </div>

              {/* Description */}
              {productDescriptionItems.length > 0 && (
                <div className="mb-2">
                  <h2 className="text-lg font-semibold text-gray-900 mb-3">Description</h2>
                  <ul className="space-y-2 text-gray-600">
                    {productDescriptionItems.map((item, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <span className="text-purple-600 mt-1.5 flex-shrink-0">•</span>
                        <span className="leading-relaxed">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

          {/* Right Column: Price Comparison */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="mb-6">
              <div className="mb-4">
                <h2 className="text-2xl font-bold text-gray-900 mb-1">
                  Price Comparison
                </h2>
                <p className="text-sm text-gray-500">
                  Compare prices from {product.vendor_count} {product.vendor_count === 1 ? 'vendor' : 'vendors'} • {product.total_listings} {product.total_listings === 1 ? 'listing' : 'listings'}
                </p>
              </div>

              {/* Quick Stats */}
              {inStockPrices.min_price != null ? (
                <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg mb-4">
                  <div className="text-center">
                    <div className="text-xs text-gray-500 mb-1">Best Price</div>
                    <div className="text-lg font-bold text-green-600">
                      {formatPrice(inStockPrices.min_price)}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-gray-500 mb-1">Average</div>
                    <div className="text-lg font-bold text-gray-900">
                      {formatPrice(inStockPrices.avg_price || 0)}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-gray-500 mb-1">Price Range</div>
                    <div className="text-lg font-bold text-purple-600">
                      {formatPrice(inStockPrices.price_range || 0)}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-gray-50 rounded-lg text-center mb-4">
                  <div className="text-sm text-gray-500">No in-stock items available</div>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleManualRefresh}
                  disabled={refreshing}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                  {refreshing ? 'Refreshing...' : 'Refresh Prices'}
                </button>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'price' | 'vendor')}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                >
                  <option value="price">Sort by Price</option>
                  <option value="vendor">Sort by Vendor</option>
                </select>
                {uniqueVendors.length > 0 && (
                  <select
                    value={filterVendor}
                    onChange={(e) => setFilterVendor(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">All Vendors</option>
                    {uniqueVendors.map(vendor => (
                      <option key={vendor} value={vendor}>{vendor}</option>
                    ))}
                  </select>
                )}
              </div>
              {refreshMessage && (
                <div
                  className={`mt-3 text-sm rounded-lg px-3 py-2 ${
                    refreshMessage.type === 'success'
                      ? 'bg-green-50 text-green-700 border border-green-200'
                      : 'bg-red-50 text-red-700 border border-red-200'
                  }`}
                >
                  {refreshMessage.message}
                </div>
              )}
            </div>

            <div className="space-y-4">
              {sortedEntries.map((entry, index) => (
                <div
                  key={entry.id}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <img
                          src={getVendorLogo(entry.vendor_name)}
                          alt={entry.vendor_name}
                          className="h-8 w-8 object-contain"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none'
                          }}
                        />
                        <div>
                          <div className="font-semibold text-gray-900">
                            {getVendorDisplayName(entry.vendor_name)}
                          </div>
                          <div className="text-sm text-gray-500">{entry.raw_name}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className={`px-2 py-1 rounded ${getAvailabilityColor(entry.availability_status)}`}>
                          {getAvailabilityText(entry.availability_status)}
                        </span>
                        {entry.scraped_at && (
                          <span className="text-gray-500">
                            Updated {getTimeAgo(entry.scraped_at)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right ml-4">
                      {isInStock(entry) && entry.price_bdt ? (
                        <div className="text-2xl font-bold text-green-600 mb-2">
                          {formatPrice(entry.price_bdt)}
                        </div>
                      ) : (
                        <div className="text-lg text-gray-500 mb-2">
                          Price not available
                        </div>
                      )}
                      <a
                        href={entry.product_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        View Product
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        {AI_FEATURE_ENABLED && aiProduct && (
          <div className="mt-12 bg-white rounded-lg shadow-md p-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-50 text-purple-600 text-xs font-semibold">
                  <Sparkles className="h-3 w-3" />
                  Experimental AI regroup
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mt-3">
                  {aiProduct.standard_name}
                </h2>
                <p className="text-sm text-gray-500">
                  {aiProduct.vendor_count} vendors • {aiProduct.total_listings} listings
                </p>
              </div>
              <div className="flex gap-4">
                <div className="text-center">
                  <p className="text-xs text-gray-500">Best price</p>
                  <p className="text-xl font-semibold text-emerald-600">{formatPrice(aiProduct.min_price)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500">Average</p>
                  <p className="text-xl font-semibold text-gray-900">{formatPrice(aiProduct.avg_price)}</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {aiProduct.price_entries.slice(0, 5).map((entry) => (
                <div key={entry.id} className="border border-gray-200 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <p className="font-semibold text-gray-900">{getVendorDisplayName(entry.vendor_name)}</p>
                    <p className="text-sm text-gray-500">{entry.raw_name}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-green-600">{formatPrice(entry.price_bdt)}</span>
                    <a
                      href={entry.product_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm text-purple-600 hover:text-purple-700"
                    >
                      <ExternalLink className="h-4 w-4" />
                      View
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Similar Products Section */}
        <SimilarProducts 
          category={categoryId}
          productId={productId}
          currentProductName={product.standard_name}
        />
      </div>
      <Footer />
    </div>
  )
}

// Helper function for category icon colors
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
