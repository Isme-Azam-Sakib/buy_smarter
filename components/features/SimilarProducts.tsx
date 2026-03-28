'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { CPUProduct } from '@/lib/types'
import ProductCard from '@/components/ui/ProductCard'
import { getCategoryById, CATEGORIES } from '@/lib/categories'
import { Cpu, Monitor, MemoryStick, HardDrive, CircuitBoard, Zap as ZapIcon, Wind } from 'lucide-react'
import { usePCBuilder } from '@/lib/contexts/PCBuilderContext'

const iconMap: { [key: string]: any } = {
  Cpu,
  Monitor,
  MemoryStick,
  HardDrive,
  CircuitBoard,
  Zap: ZapIcon,
  Wind
}

interface SimilarProductsProps {
  category: string
  productId: string
  currentProductName?: string
}

export default function SimilarProducts({ category, productId, currentProductName }: SimilarProductsProps) {
  const router = useRouter()
  const { addToBuilder, builderItems } = usePCBuilder()
  const [similarProducts, setSimilarProducts] = useState<CPUProduct[]>([])
  const [loading, setLoading] = useState(true)

  const categoryData = getCategoryById(category) || CATEGORIES[0]
  const CategoryIcon = iconMap[categoryData.icon] || Cpu

  useEffect(() => {
    async function fetchSimilarProducts() {
      try {
        setLoading(true)
        const response = await fetch(
          `/api/products/${encodeURIComponent(category)}/${encodeURIComponent(productId)}/similar`
        )
        if (!response.ok) {
          throw new Error('Failed to fetch similar products')
        }
        const data = await response.json()
        // Filter out the current product if it somehow appears in the results
        const filtered = data.products?.filter(
          (p: CPUProduct) => p.standard_name !== currentProductName && p.id !== productId
        ) || []
        setSimilarProducts(filtered)
      } catch (error) {
        console.error('Failed to fetch similar products:', error)
        setSimilarProducts([])
      } finally {
        setLoading(false)
      }
    }

    fetchSimilarProducts()
  }, [category, productId, currentProductName])

  const handleProductClick = (product: CPUProduct) => {
    router.push(`/products/${category}/${encodeURIComponent(product.standard_name)}`)
  }

  const handleAddToBuilder = (e: React.MouseEvent, product: CPUProduct) => {
    e.stopPropagation()
    addToBuilder(category, product)
  }

  const isInBuilder = (product: CPUProduct) => {
    const builderProduct = builderItems[category]
    if (!builderProduct) return false
    if (Array.isArray(builderProduct)) {
      return builderProduct.some((p) => p?.id === product.id || p?.standard_name === product.standard_name)
    }
    return builderProduct.id === product.id || builderProduct.standard_name === product.standard_name
  }

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

  if (loading) {
    return (
      <div className="py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading similar products...</p>
        </div>
      </div>
    )
  }

  if (similarProducts.length === 0) {
    return null // Don't show section if no similar products
  }

  return (
    <div className="mt-12 py-8 border-t border-gray-200">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Similar Products</h2>
        <p className="text-gray-600">Products with similar features in this category</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {similarProducts.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            variant="showcase"
            categoryIcon={CategoryIcon}
            categoryIconColor={categoryData.color}
            onProductClick={handleProductClick}
            onAddToBuilder={handleAddToBuilder}
            isInBuilder={isInBuilder}
            getProductDisplayName={getProductDisplayName}
          />
        ))}
      </div>
    </div>
  )
}

