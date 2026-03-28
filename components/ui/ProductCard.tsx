'use client'

import { ShoppingCart, ExternalLink, Wrench, Check } from 'lucide-react'
import { CPUProduct } from '@/lib/types'
import { formatPrice, getBrandColor } from '@/lib/utils'
import Tooltip from '@/components/ui/Tooltip'

interface ProductCardProps {
  product: CPUProduct
  variant?: 'detailed' | 'showcase'
  categoryIcon?: React.ComponentType<{ className?: string }>
  categoryIconColor?: string
  onProductClick: (product: CPUProduct) => void
  onAddToBuilder?: (e: React.MouseEvent, product: CPUProduct) => void
  isInBuilder?: (product: CPUProduct) => boolean
  getProductDisplayName: (product: CPUProduct) => string
}

export default function ProductCard({
  product,
  variant = 'detailed',
  categoryIcon: CategoryIcon,
  categoryIconColor,
  onProductClick,
  onAddToBuilder,
  isInBuilder,
  getProductDisplayName,
}: ProductCardProps) {
  const handleCardClick = () => {
    onProductClick(product)
  }

  const handleAddToBuilder = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onAddToBuilder) {
      onAddToBuilder(e, product)
    }
  }

  const handleViewDetails = (e: React.MouseEvent) => {
    e.stopPropagation()
    onProductClick(product)
  }

  const handleExternalLink = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (product.price_entries && product.price_entries.length > 0) {
      window.open(product.price_entries[0].product_url, '_blank')
    }
  }

  const inBuilder = isInBuilder ? isInBuilder(product) : false

  if (variant === 'showcase') {
    return (
      <div
        className="group flex flex-col h-full border border-slate-200 rounded-2xl p-5 bg-white hover:shadow-xl transition cursor-pointer"
        onClick={handleCardClick}
      >
        {/* Product Image */}
        <div className="aspect-[4/3] rounded-xl bg-slate-50 mb-4 flex items-center justify-center overflow-hidden flex-shrink-0">
          {product.images && product.images.length > 0 ? (
            <img
              src={product.images[0]}
              alt={product.standard_name}
              className="w-full h-full object-contain"
              loading="lazy"
            />
          ) : (
            <div className="text-slate-300">
              {CategoryIcon && <CategoryIcon className="h-12 w-12" />}
            </div>
          )}
        </div>

        {/* Product Info */}
        <div className="flex items-center justify-between mb-3">
          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getBrandColor(product.brand)}`}>
            {product.brand}
          </span>
          {onAddToBuilder && (
            <button
              onClick={handleAddToBuilder}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-colors text-xs font-medium ${
                inBuilder
                  ? 'bg-green-500 text-white hover:bg-green-600'
                  : 'bg-purple-600 text-white hover:bg-purple-700'
              }`}
              aria-label="Add to PC Builder"
            >
              {inBuilder ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Wrench className="h-3.5 w-3.5" />
              )}
              {inBuilder ? 'Added' : 'Add to PC Builder'}
            </button>
          )}
        </div>

        <h3 className="text-base font-semibold text-slate-900 mb-3 line-clamp-2">
          {getProductDisplayName(product)}
        </h3>

        <div className="flex items-baseline gap-3 mb-4">
          <span className="text-2xl font-bold text-emerald-600">
            {formatPrice(product.min_price)}
          </span>
          {product.max_price && product.max_price !== product.min_price && (
            <span className="text-xs text-slate-500">
              up to {formatPrice(product.max_price)}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500 mb-4">
          <span>{product.vendor_count} vendors</span>
        </div>

        <button
          className="mt-auto w-full inline-flex items-center justify-center gap-2 rounded-xl bg-purple-600 text-white py-2 text-sm font-semibold hover:bg-purple-700 transition"
          onClick={handleViewDetails}
        >
          <ShoppingCart className="h-4 w-4" />
          View details
        </button>
      </div>
    )
  }

  // Detailed variant (default)
  return (
    <div
      className="bg-white rounded-lg shadow-md hover:shadow-xl transition-all duration-200 cursor-pointer group border-2 border-transparent hover:border-purple-200"
      onClick={handleCardClick}
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
            {CategoryIcon && (
              <CategoryIcon
                className={`h-16 w-16 ${categoryIconColor || 'text-gray-400'}`}
              />
            )}
          </div>
        )}
      </div>

      {/* Product Info */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getBrandColor(product.brand)}`}>
            {product.brand}
          </span>
          {onAddToBuilder && (
            <button
              onClick={handleAddToBuilder}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-colors text-xs font-medium ${
                inBuilder
                  ? 'bg-green-500 text-white hover:bg-green-600'
                  : 'bg-purple-600 text-white hover:bg-purple-700'
              }`}
              aria-label="Add to PC Builder"
            >
              {inBuilder ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Wrench className="h-3.5 w-3.5" />
              )}
              {inBuilder ? 'Added' : 'Add to PC Builder'}
            </button>
          )}
        </div>

        <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2 text-sm">
          {getProductDisplayName(product)}
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
        </div>

        <div className="flex space-x-2">
          <button
            className="flex-1 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
            onClick={handleViewDetails}
          >
            <ShoppingCart className="h-4 w-4 inline mr-1" />
            View Details
          </button>
          {product.price_entries && product.price_entries.length > 0 && (
            <button
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm"
              onClick={handleExternalLink}
            >
              <ExternalLink className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

