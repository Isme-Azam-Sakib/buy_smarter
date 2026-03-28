'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, Cpu, Monitor, MemoryStick, HardDrive, CircuitBoard, Zap as ZapIcon, Wind } from 'lucide-react'
import { CPUProduct } from '@/lib/types'
import { CATEGORIES } from '@/lib/categories'
import { usePCBuilder } from '@/lib/contexts/PCBuilderContext'
import ProductCard from '@/components/ui/ProductCard'

interface CategoryShowcaseProps {
  categoryId: string
  limit?: number
}

const iconMap: Record<string, any> = {
  Cpu,
  Monitor,
  MemoryStick,
  HardDrive,
  CircuitBoard,
  Zap: ZapIcon,
  Wind,
}

export default function CategoryShowcase({ categoryId, limit = 4 }: CategoryShowcaseProps) {
  const router = useRouter()
  const { addToBuilder, builderItems } = usePCBuilder()
  const [products, setProducts] = useState<CPUProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const categoryMeta = CATEGORIES.find((cat) => cat.id === categoryId)
  const CategoryIcon = iconMap[categoryMeta?.icon || 'Cpu'] || Cpu

  const fetchShowcase = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        category: categoryId,
        limit: String(limit),
      })
      const response = await fetch(`/api/products?${params.toString()}`)
      
      // Check if response is actually JSON
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text()
        console.error(`[CategoryShowcase] Non-JSON response for ${categoryId}:`, text.substring(0, 200))
        throw new Error(`Server returned HTML instead of JSON. Status: ${response.status}`)
      }
      
      const data = await response.json()
      
      if (!response.ok) {
        const errorMsg = data.error || data.details || `Failed to load ${categoryId} products (${response.status})`
        console.error(`[CategoryShowcase] API error for ${categoryId}:`, errorMsg, data)
        throw new Error(errorMsg)
      }
      
      if (data.error) {
        const errorMsg = data.error || data.details || `Failed to load ${categoryId} products`
        console.error(`[CategoryShowcase] API returned error for ${categoryId}:`, errorMsg, data)
        throw new Error(errorMsg)
      }
      
      setProducts(data.products || [])
      setError(null)
    } catch (err: any) {
      console.error(`[CategoryShowcase] Error fetching ${categoryId}:`, err)
      setError(err.message || 'Unable to load products')
      setProducts([])
    } finally {
      setLoading(false)
    }
  }, [categoryId, limit])

  useEffect(() => {
    fetchShowcase()
  }, [fetchShowcase])

  const handleProductClick = (product: CPUProduct) => {
    const slug = encodeURIComponent(product.standard_name)
    router.push(`/products/${categoryId}/${slug}`)
  }

  const handleAddToBuilder = (e: React.MouseEvent, product: CPUProduct) => {
    e.stopPropagation()
    addToBuilder(categoryId, product)
  }

  const isInBuilder = (product: CPUProduct) => {
    const builderProduct = builderItems[categoryId]
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

  return (
    <section className="py-12 border-b border-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="p-2 rounded-lg bg-slate-100 text-slate-700">
                <CategoryIcon className="h-5 w-5" />
              </span>
              <p className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
                {categoryMeta?.name || categoryId}
              </p>
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900">
              Featured {categoryMeta?.name?.toLowerCase() || categoryId}
            </h2>
          </div>

          <Link
            href={`/products/${categoryId}`}
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            View all {categoryMeta?.name || categoryId}
            <ArrowRight className="h-4 w-4 ml-2" />
          </Link>
        </div>

        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: limit }).map((_, idx) => (
              <div
                key={idx}
                className="h-48 rounded-2xl border border-slate-200 bg-slate-50 animate-pulse"
              />
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-red-800 mb-1">Unable to load products</h3>
                <p className="text-sm text-red-700">{error}</p>
                <button
                  onClick={() => {
                    setError(null)
                    fetchShowcase()
                  }}
                  className="mt-3 text-sm text-red-600 hover:text-red-800 font-medium underline"
                >
                  Try again
                </button>
              </div>
            </div>
          </div>
        )}

        {!loading && !error && products.length === 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-slate-500 text-sm">
            No products available right now. Check back soon!
          </div>
        )}

        {!loading && !error && products.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                variant="showcase"
                categoryIcon={CategoryIcon}
                onProductClick={handleProductClick}
                onAddToBuilder={handleAddToBuilder}
                isInBuilder={isInBuilder}
                getProductDisplayName={getProductDisplayName}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

