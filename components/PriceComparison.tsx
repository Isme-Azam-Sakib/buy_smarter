'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ExternalLink, TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface Product {
  productId: number
  standardName: string
  brand: string
  category: string
  currentCheapestPrice: number
  imageUrls: string[]
  priceEntries: {
    id: number
    scrapedPrice: number
    availabilityStatus: string
    productUrl: string
    vendor: {
      name: string
      website: string
    }
  }[]
}

// Mock price history for demonstration
const generateMockPriceHistory = (currentPrice: number) => {
  const history = []
  let price = currentPrice
  for (let i = 0; i < 4; i++) {
    history.unshift(price)
    price += Math.floor(Math.random() * 2000) + 500
  }
  return history
}

export default function PriceComparison() {
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  const categories = [
    { id: 'all', name: 'All Categories' },
    { id: 'cpu', name: 'CPU' },
    { id: 'gpu', name: 'GPU' },
    { id: 'ram', name: 'RAM' },
    { id: 'motherboard', name: 'Motherboard' },
    { id: 'psu', name: 'Power Supply' },
    { id: 'case', name: 'Case' },
  ]

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true)
        const params = new URLSearchParams({
          limit: '6',
          page: '1'
        })
        
        if (selectedCategory !== 'all') {
          params.append('category', selectedCategory)
        }

        const response = await fetch(`/api/products?${params}`)
        if (!response.ok) throw new Error('Failed to fetch products')
        
        const result = await response.json()
        setProducts(result.products)
      } catch (error) {
        console.error('Error fetching products:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchProducts()
  }, [selectedCategory])

  const getPriceTrend = (currentPrice: number) => {
    // Generate mock price history for demonstration
    const priceHistory = generateMockPriceHistory(currentPrice)
    if (priceHistory.length < 2) return 'stable'
    const latest = priceHistory[priceHistory.length - 1]
    const previous = priceHistory[priceHistory.length - 2]
    
    if (latest < previous) return 'down'
    if (latest > previous) return 'up'
    return 'stable'
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-BD', {
      style: 'currency',
      currency: 'BDT',
      minimumFractionDigits: 0,
    }).format(price)
  }

  return (
    <section className="py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Price Comparison
          </h2>
          <p className="text-xl text-gray-600">
            Find the best deals on PC components across Bangladesh
          </p>
        </div>

        {/* Category Filter */}
        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedCategory === category.id
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {category.name}
            </button>
          ))}
        </div>

        {/* Products Grid */}
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((product) => {
              const trend = getPriceTrend(product.currentCheapestPrice)
              
              return (
                <div key={product.productId} className="card hover:shadow-lg transition-shadow">
                  <div className="flex items-center mb-4">
                    <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center">
                      {product.imageUrls && product.imageUrls.length > 0 ? (
                        <img
                          src={product.imageUrls[0]}
                          alt={product.standardName}
                          className="w-full h-full object-contain rounded-lg"
                        />
                      ) : (
                        <div className="text-gray-400 text-2xl">📦</div>
                      )}
                    </div>
                    <div className="ml-4 flex-1">
                      <h3 className="font-semibold text-gray-900 text-sm">
                        {product.standardName}
                      </h3>
                      <p className="text-gray-500 text-sm">{product.brand}</p>
                      <div className="flex items-center mt-1">
                        <span className="text-2xl font-bold text-primary-600">
                          {formatPrice(product.currentCheapestPrice)}
                        </span>
                        <div className="ml-2">
                          {trend === 'down' && (
                            <TrendingDown className="h-4 w-4 text-green-500" />
                          )}
                          {trend === 'up' && (
                            <TrendingUp className="h-4 w-4 text-red-500" />
                          )}
                          {trend === 'stable' && (
                            <Minus className="h-4 w-4 text-gray-400" />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Vendor List */}
                  <div className="space-y-2">
                    <h4 className="font-medium text-gray-900 text-sm">Available at:</h4>
                    {product.priceEntries.slice(0, 3).map((entry, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
                      >
                        <div className="flex items-center">
                          <span className="text-sm font-medium text-gray-700">
                            {entry.vendor.name}
                          </span>
                          {entry.availabilityStatus !== 'in_stock' && (
                            <span className="ml-2 text-xs text-red-500">Out of Stock</span>
                          )}
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-semibold text-gray-900">
                            {formatPrice(entry.scrapedPrice)}
                          </span>
                          {entry.productUrl && (
                            <a
                              href={entry.productUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary-600 hover:text-primary-700"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <Link href="/products" className="w-full mt-4 btn-primary block text-center">
                    View All Prices
                  </Link>
                </div>
              )
            })}
          </div>
        )}

        <div className="text-center mt-12">
          <Link href="/products" className="btn-secondary">
            View All Products
          </Link>
        </div>
      </div>
    </section>
  )
}
