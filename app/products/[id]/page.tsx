'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { 
  ArrowLeft, 
  ExternalLink, 
  Star, 
  CheckCircle, 
  XCircle, 
  Clock,
  ShoppingCart,
  Heart,
  Share2,
  TrendingUp,
  TrendingDown,
  Minus
} from 'lucide-react'

interface ProductDetails {
  productId: number
  standardName: string
  category: string
  brand: string
  currentCheapestPrice: number
  keySpecsJson: any
  imageUrls: string[]
  createdAt: string
  updatedAt: string
  priceEntries: Array<{
    id: number
    scrapedPrice: number
    availabilityStatus: string
    productUrl: string
    scrapedTimestamp: string
    vendor: {
      name: string
      website: string
      logoUrl: string
    }
  }>
  relatedProducts: Array<{
    productId: number
    standardName: string
    brand: string
    currentCheapestPrice: number
    imageUrls: string[]
  }>
}

export default function ProductDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const [product, setProduct] = useState<ProductDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedImage, setSelectedImage] = useState(0)
  const [priceSort, setPriceSort] = useState<'asc' | 'desc'>('asc')

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        setLoading(true)
        const response = await fetch(`/api/products/${params.id}`)
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('Product not found')
          }
          throw new Error('Failed to fetch product details')
        }
        
        const data = await response.json()
        setProduct(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setLoading(false)
      }
    }

    if (params.id) {
      fetchProduct()
    }
  }, [params.id])

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-BD', {
      style: 'currency',
      currency: 'BDT',
      minimumFractionDigits: 0
    }).format(price)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-BD', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const getAvailabilityIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'in_stock':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'out_of_stock':
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return <Clock className="h-4 w-4 text-yellow-500" />
    }
  }

  const getAvailabilityText = (status: string) => {
    switch (status.toLowerCase()) {
      case 'in_stock':
        return 'In Stock'
      case 'out_of_stock':
        return 'Out of Stock'
      default:
        return 'Check Availability'
    }
  }

  const getAvailabilityColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'in_stock':
        return 'text-green-600 bg-green-50'
      case 'out_of_stock':
        return 'text-red-600 bg-red-50'
      default:
        return 'text-yellow-600 bg-yellow-50'
    }
  }

  const getCategoryColor = (category: string) => {
    const colors: { [key: string]: string } = {
      cpu: 'bg-blue-100 text-blue-800',
      gpu: 'bg-purple-100 text-purple-800',
      ram: 'bg-green-100 text-green-800',
      motherboard: 'bg-orange-100 text-orange-800',
      psu: 'bg-red-100 text-red-800',
      case: 'bg-gray-100 text-gray-800',
      storage: 'bg-yellow-100 text-yellow-800',
      cooling: 'bg-cyan-100 text-cyan-800'
    }
    return colors[category.toLowerCase()] || 'bg-gray-100 text-gray-800'
  }

  const sortedPriceEntries = product?.priceEntries.sort((a, b) => 
    priceSort === 'asc' ? a.scrapedPrice - b.scrapedPrice : b.scrapedPrice - a.scrapedPrice
  ) || []

  const priceRange = product?.priceEntries.length > 1 ? {
    min: Math.min(...product.priceEntries.map(p => p.scrapedPrice)),
    max: Math.max(...product.priceEntries.map(p => p.scrapedPrice)),
    difference: Math.max(...product.priceEntries.map(p => p.scrapedPrice)) - Math.min(...product.priceEntries.map(p => p.scrapedPrice))
  } : null

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

  if (error || !product) {
    return (
      <main className="min-h-screen">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Product Not Found</h1>
            <p className="text-gray-600 mb-4">{error || 'The product you are looking for does not exist.'}</p>
            <button 
              onClick={() => router.back()}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Go Back
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
        {/* Back Button */}
        <button 
          onClick={() => router.back()}
          className="flex items-center text-gray-600 hover:text-gray-800 mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Products
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Product Images */}
          <div className="space-y-4">
            {/* Main Image */}
            <div className="aspect-square bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              {product.imageUrls && product.imageUrls.length > 0 ? (
                <img
                  src={product.imageUrls[selectedImage]}
                  alt={product.standardName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400 text-6xl">
                  📦
                </div>
              )}
            </div>

            {/* Thumbnail Images */}
            {product.imageUrls && product.imageUrls.length > 1 && (
              <div className="grid grid-cols-4 gap-2">
                {product.imageUrls.map((url, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedImage(index)}
                    className={`aspect-square bg-white rounded border-2 overflow-hidden ${
                      selectedImage === index ? 'border-blue-500' : 'border-gray-200'
                    }`}
                  >
                    <img
                      src={url}
                      alt={`${product.standardName} ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Details */}
          <div className="space-y-6">
            {/* Header */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(product.category)}`}>
                  {product.category.toUpperCase()}
                </span>
                <span className="text-sm text-gray-600">{product.brand}</span>
              </div>
              
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                {product.standardName}
              </h1>

              {/* Price Range */}
              <div className="flex items-center gap-4 mb-4">
                <div className="text-3xl font-bold text-green-600">
                  {formatPrice(product.currentCheapestPrice)}
                </div>
                {priceRange && (
                  <div className="text-sm text-gray-600">
                    <span className="text-gray-500">Range: </span>
                    {formatPrice(priceRange.min)} - {formatPrice(priceRange.max)}
                    <span className="ml-2 text-xs bg-gray-100 px-2 py-1 rounded">
                      {formatPrice(priceRange.difference)} difference
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2">
                <ShoppingCart className="h-4 w-4" />
                Buy Now
              </button>
              <button className="px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50">
                <Heart className="h-4 w-4" />
              </button>
              <button className="px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50">
                <Share2 className="h-4 w-4" />
              </button>
            </div>

            {/* Key Specifications */}
            {product.keySpecsJson && Object.keys(product.keySpecsJson).length > 0 && (
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <h3 className="font-semibold text-gray-900 mb-3">Key Specifications</h3>
                <div className="grid grid-cols-1 gap-2">
                  {Object.entries(product.keySpecsJson).map(([key, value]) => (
                    <div key={key} className="flex justify-between py-1 border-b border-gray-100 last:border-b-0">
                      <span className="text-sm font-medium text-gray-600">{key}:</span>
                      <span className="text-sm text-gray-900">{String(value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Product Info */}
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-3">Product Information</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Product ID:</span>
                  <span className="text-gray-900">#{product.productId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Added:</span>
                  <span className="text-gray-900">{formatDate(product.createdAt)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Last Updated:</span>
                  <span className="text-gray-900">{formatDate(product.updatedAt)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Available from:</span>
                  <span className="text-gray-900">{product.priceEntries.length} vendor{product.priceEntries.length !== 1 ? 's' : ''}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Vendor Prices Section */}
        <div className="mt-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              Available from {product.priceEntries.length} Vendor{product.priceEntries.length !== 1 ? 's' : ''}
            </h2>
            
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Sort by price:</span>
              <select
                value={priceSort}
                onChange={(e) => setPriceSort(e.target.value as 'asc' | 'desc')}
                className="px-3 py-1 border border-gray-300 rounded text-sm"
              >
                <option value="asc">Low to High</option>
                <option value="desc">High to Low</option>
              </select>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            {sortedPriceEntries.map((entry, index) => (
              <div 
                key={entry.id}
                className={`p-4 border-b border-gray-100 last:border-b-0 ${
                  index === 0 ? 'bg-green-50' : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      {index === 0 && (
                        <span className="bg-green-600 text-white text-xs px-2 py-1 rounded-full font-medium">
                          Best Price
                        </span>
                      )}
                      <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getAvailabilityColor(entry.availabilityStatus)}`}>
                        {getAvailabilityIcon(entry.availabilityStatus)}
                        {getAvailabilityText(entry.availabilityStatus)}
                      </div>
                    </div>
                    
                    <div>
                      <div className="font-semibold text-gray-900">{entry.vendor.name}</div>
                      <div className="text-sm text-gray-600">
                        Updated: {formatDate(entry.scrapedTimestamp)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-xl font-bold text-gray-900">
                        {formatPrice(entry.scrapedPrice)}
                      </div>
                      {index > 0 && (
                        <div className="text-sm text-gray-600">
                          {formatPrice(entry.scrapedPrice - sortedPriceEntries[0].scrapedPrice)} more
                        </div>
                      )}
                    </div>
                    
                    {entry.productUrl && (
                      <a
                        href={entry.productUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
                      >
                        <ExternalLink className="h-4 w-4" />
                        Visit Store
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Related Products */}
        {product.relatedProducts.length > 0 && (
          <div className="mt-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Related Products</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {product.relatedProducts.map((related) => (
                <div
                  key={related.productId}
                  onClick={() => router.push(`/products/${related.productId}`)}
                  className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
                >
                  <div className="w-full h-32 bg-gray-100 flex items-center justify-center">
                    {related.imageUrls && related.imageUrls.length > 0 ? (
                      <img
                        src={related.imageUrls[0]}
                        alt={related.standardName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-gray-400 text-2xl">📦</div>
                    )}
                  </div>
                  
                  <div className="p-4">
                    <h3 className="font-semibold text-gray-900 text-sm line-clamp-2 mb-2">
                      {related.standardName}
                    </h3>
                    <p className="text-sm text-gray-600 mb-2">{related.brand}</p>
                    <div className="text-lg font-bold text-green-600">
                      {formatPrice(related.currentCheapestPrice)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <Footer />
    </main>
  )
}
