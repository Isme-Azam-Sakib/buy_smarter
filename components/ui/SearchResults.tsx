'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { X, ExternalLink, Wrench, Package } from 'lucide-react'
import { CPUProduct } from '@/lib/types'
import { formatPrice, getBrandColor, getVendorDisplayName } from '@/lib/utils'
import { CATEGORIES } from '@/lib/categories'
import { usePCBuilder } from '@/lib/contexts/PCBuilderContext'

/** Extract only the model name from AI hints like "High-Performance Air Cooler (e.g., Deepcool AK620)" → "Deepcool AK620". Drops leading "NVIDIA " so "NVIDIA GeForce RTX 4060 Ti 16GB" → "GeForce RTX 4060 Ti 16GB". */
function getModelOnlyHint(hint: string | undefined): string {
  if (!hint || typeof hint !== 'string') return ''
  const s = hint.trim()
  if (!s) return ''

  let result: string

  // "(e.g., Deepcool AK620)" or "(e.g. Deepcool AK620)"
  const egInParens = s.match(/\(e\.g\.?,?\s*([^)]+)\)/i)
  if (egInParens?.[1]) {
    result = egInParens[1].trim()
  } else {
    // "e.g., Deepcool AK620" or "e.g. Deepcool AK620" at end
    const egSuffix = s.match(/e\.g\.?,?\s+(.+?)(?:\s*$|\))/is)
    if (egSuffix?.[1]) {
      result = egSuffix[1].trim()
    } else {
      // Last parenthesized segment that looks like a model (short, alphanumeric)
      const lastParen = s.match(/\(([^)]{2,50})\)\s*$/)
      if (lastParen?.[1] && !/^(e\.g\.|example|like|e\.g\.?,)/i.test(lastParen[1])) {
        result = lastParen[1].trim()
      } else {
        result = s
      }
    }
  }

  // Drop leading "NVIDIA " so we show "GeForce RTX 4060 Ti 16GB" not "NVIDIA GeForce RTX 4060 Ti 16GB"
  return result.replace(/^\s*nvidia\s+/i, '').trim()
}

interface SearchResultsProps {
  query: string
  response: any
  onClose: () => void
}

function getProductDisplayNameBase(product: CPUProduct): string {
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

function hasUppercase(str: string): boolean {
  return /[A-Z]/.test(str)
}

function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .split(/\s+/)
    .map((word) => {
      if (!word) return word
      // Keep all-caps abbreviations as-is
      if (word === word.toUpperCase()) return word
      // If it looks like a CPU model (e.g. i5-7640x), keep as-is to avoid breaking it
      if (/^i[3579]/i.test(word) || /\d/.test(word)) return word
      return word.charAt(0).toUpperCase() + word.slice(1)
    })
    .join(' ')
}

function getFormattedProductName(product: CPUProduct): string {
  let name = getProductDisplayNameBase(product)
  const brand = product.brand?.trim()

  if (brand) {
    const lowerName = name.toLowerCase()
    const lowerBrand = brand.toLowerCase()
    if (!lowerName.startsWith(lowerBrand)) {
      name = `${brand} ${name}`
    }
  }

  // If the string has no uppercase characters at all, apply a light title case
  if (!hasUppercase(name)) {
    name = toTitleCase(name)
  }

  return name.replace(/\s+/g, ' ').trim()
}

function getBestVendorEntry(product: CPUProduct) {
  if (!product.price_entries || !Array.isArray(product.price_entries) || product.price_entries.length === 0) {
    return null
  }
  // Prefer the first entry that has a valid numeric price
  const priced = product.price_entries.find(
    (entry) => typeof entry.price_bdt === 'number' && entry.price_bdt > 0
  )
  return priced || product.price_entries[0]
}

function getProductImageForSearch(product: CPUProduct): string | null {
  if (product.images && product.images.length > 0) {
    return product.images[0]
  }
  if (product.price_entries && Array.isArray(product.price_entries)) {
    const entryWithImage = product.price_entries.find((entry) => entry.image_url)
    if (entryWithImage?.image_url) {
      return entryWithImage.image_url
    }
  }
  return null
}

function buildSearchHint(categoryId: string, rawTerm: string): string {
  const term = rawTerm.trim()
  if (!term) return term

  const lower = term.toLowerCase()

  if (categoryId === 'ssd') {
    const sizeMatch = lower.match(/\b(\d+\s*(?:tb|gb))\b/)
    const hasM2 = /m\.?2/.test(lower)
    const hasNvme = /nvme/.test(lower)
    const parts = []
    if (sizeMatch) parts.push(sizeMatch[1].replace(/\s+/, ''))
    if (hasM2) parts.push('m.2')
    if (hasNvme) parts.push('nvme')
    if (parts.length) return parts.join(' ')
  }

  if (categoryId === 'motherboard') {
    const chipMatch = lower.match(
      /\b(b[3-9]\d{2}|x[3-9]\d{2}|a[3-9]\d{2}|z[3-9]\d{2})\b/
    )
    if (chipMatch) return chipMatch[1]
    const socketMatch = lower.match(/\b(am4|am5|lga\s*\d{3,5})\b/)
    if (socketMatch) return socketMatch[1].replace(/\s+/, ' ')
  }

  if (categoryId === 'cpu-cooler') {
    const radMatch = lower.match(/\b(120|240|360)\s*mm\b/)
    if (radMatch) return `${radMatch[1]}mm`
  }

  return term
}

export default function SearchResults({ query, response, onClose }: SearchResultsProps) {
  const router = useRouter()
  const { addToBuilder, clearBuilder } = usePCBuilder()
  // Handle error responses
  if (response.error || !response.type || response.type === 'error') {
    // Extract error information with fallbacks
    const errorMessage = response.error || response.message || 'An unknown error occurred'
    const errorDetails = response.details || 
      (response.error === 'AI service is not configured. Please set GEMINI_API_KEY.' 
        ? 'The Gemini API key is not configured. Please add it to your .env.local file and restart the server.'
        : 'Please check your API configuration and try again.')
    
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full">
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
            <h3 className="text-xl font-semibold text-gray-900">Error</h3>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>
          <div className="p-6">
            <div className="mb-4">
              <p className="text-sm text-gray-500 mb-2">Your query:</p>
              <p className="text-gray-900 font-medium">&quot;{query}&quot;</p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800 font-medium mb-2">{errorMessage}</p>
              <p className="text-red-600 text-sm mb-3">{errorDetails}</p>
              {response.error === 'AI service is not configured. Please set GEMINI_API_KEY.' && (
                <div className="mt-3 pt-3 border-t border-red-200">
                  <p className="text-red-700 text-sm font-semibold mb-2">How to fix:</p>
                  <ol className="text-red-700 text-sm list-decimal list-inside space-y-1">
                    <li>Open <code className="bg-red-100 px-1 rounded">.env.local</code> file</li>
                    <li>Make sure <code className="bg-red-100 px-1 rounded">GEMINI_API_KEY</code> is set</li>
                    <li>Stop the development server (Ctrl+C)</li>
                    <li>Restart it with <code className="bg-red-100 px-1 rounded">npm run dev</code></li>
                  </ol>
                </div>
              )}
            </div>
            <button
              onClick={onClose}
              className="mt-4 px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (response.type === 'unavailable_category' || response.type === 'general_question') {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
            <h3 className="text-xl font-semibold text-gray-900">Search Results</h3>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>
          <div className="p-6">
            <div className="mb-4">
              <p className="text-sm text-gray-500 mb-2">Your query:</p>
              <p className="text-gray-900 font-medium">&quot;{query}&quot;</p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <p className="text-gray-800 whitespace-pre-wrap">{response.message}</p>
            </div>
            {response.availableCategories && (
              <div className="mt-4">
                <p className="text-sm font-medium text-gray-700 mb-2">Available categories:</p>
                <div className="flex flex-wrap gap-2">
                  {response.availableCategories.map((cat: string) => (
                    <span
                      key={cat}
                      className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm"
                    >
                      {cat}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-6 flex gap-3">
              <Link
                href="/products"
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-center font-medium"
              >
                Browse Products
              </Link>
              <Link
                href="/builder"
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-center font-medium"
              >
                PC Builder
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (response.type === 'single_product' && response.products) {
    const products = response.products as CPUProduct[]
    const cheapestProduct = products[0]
    const cheapestVendor = cheapestProduct ? getBestVendorEntry(cheapestProduct) : null
    const cheapestImage = cheapestProduct ? getProductImageForSearch(cheapestProduct) : null

    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[80vh] overflow-y-auto">
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
            <h3 className="text-xl font-semibold text-gray-900">Search Results</h3>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>
          <div className="p-6">
            <div className="mb-4">
              <p className="text-sm text-gray-500 mb-2">Your query:</p>
              <p className="text-gray-900 font-medium">&quot;{query}&quot;</p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <p className="text-gray-800 whitespace-pre-wrap">{response.message}</p>
            </div>

            {cheapestProduct && (
              <div className="mb-6">
                <h4 className="text-lg font-semibold text-gray-900 mb-3">Best Match</h4>
                <Link
                  href={`/products/${response.category}/${encodeURIComponent(cheapestProduct.standard_name)}`}
                  className="block bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-200 rounded-xl p-4 hover:border-purple-300 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    {cheapestImage && (
                      <img
                        src={cheapestImage}
                        alt={getFormattedProductName(cheapestProduct)}
                        className="w-20 h-20 object-contain bg-white rounded-lg"
                      />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getBrandColor(cheapestProduct.brand)}`}>
                          {cheapestProduct.brand}
                        </span>
                        <span className="text-sm text-gray-500">
                          {cheapestProduct.vendor_count} vendor{cheapestProduct.vendor_count !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <h5 className="font-semibold text-gray-900 mb-1">
                        {getFormattedProductName(cheapestProduct)}
                      </h5>
                      <p className="text-2xl font-bold text-purple-600">
                        {formatPrice(cheapestProduct.min_price)}
                      </p>
                      {cheapestVendor && (
                        <p className="mt-1 text-xs text-gray-600">
                          Lowest price from{' '}
                          <span className="font-semibold">
                            {getVendorDisplayName(cheapestVendor.vendor_name)}
                          </span>
                        </p>
                      )}
                    </div>
                    <ExternalLink className="h-5 w-5 text-gray-400" />
                  </div>
                </Link>
              </div>
            )}

            {products.length > 0 && (
              <div>
                <h4 className="text-lg font-semibold text-gray-900 mb-3">
                  Matching components ({products.length})
                </h4>
                <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Component
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Brand
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Price (min - max)
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Vendors
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Best vendor
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Listings
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {products.map((product, index) => {
                        const bestVendor = getBestVendorEntry(product)
                        const imageSrc = getProductImageForSearch(product)
                        return (
                          <tr
                            key={product.id}
                            className={index === 0 ? 'bg-purple-50/60' : 'bg-white'}
                          >
                            <td className="px-4 py-3 align-top">
                              <div className="flex items-start gap-3">
                                {imageSrc && (
                                  <img
                                    src={imageSrc}
                                    alt={getFormattedProductName(product)}
                                    className="w-10 h-10 object-contain bg-white rounded border border-gray-200"
                                  />
                                )}
                                <div>
                                  <p className="text-sm font-medium text-gray-900">
                                    {getFormattedProductName(product)}
                                  </p>
                                  {index === 0 && (
                                    <p className="mt-1 inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-[11px] font-semibold text-purple-700">
                                      Best match
                                    </p>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 align-top">
                              <span
                                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${getBrandColor(
                                  product.brand
                                )}`}
                              >
                                {product.brand || '—'}
                              </span>
                            </td>
                            <td className="px-4 py-3 align-top whitespace-nowrap">
                              <div className="text-sm font-semibold text-gray-900">
                                {formatPrice(product.min_price)}
                              </div>
                              {product.max_price && product.max_price !== product.min_price && (
                                <div className="text-xs text-gray-500">
                                  up to {formatPrice(product.max_price)}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3 align-top">
                              <span className="text-sm text-gray-900 font-medium">
                                {product.vendor_count ?? 0}
                              </span>
                            </td>
                            <td className="px-4 py-3 align-top">
                              {bestVendor ? (
                                <div className="text-xs text-gray-700">
                                  <div className="font-semibold">
                                    {getVendorDisplayName(bestVendor.vendor_name)}
                                  </div>
                                  {typeof bestVendor.price_bdt === 'number' && (
                                    <div className="text-[11px] text-gray-500">
                                      {formatPrice(bestVendor.price_bdt)}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs text-gray-400">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3 align-top">
                              <span className="text-sm text-gray-900 font-medium">
                                {product.total_listings ?? 0}
                              </span>
                            </td>
                            <td className="px-4 py-3 align-top text-right">
                              <Link
                                href={`/products/${response.category}/${encodeURIComponent(
                                  product.standard_name
                                )}`}
                                className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-purple-700 hover:border-purple-300 hover:bg-purple-50 transition-colors"
                              >
                                View details
                                <ExternalLink className="h-3 w-3" />
                              </Link>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  Prices are aggregated from multiple vendors where available, so you can compare
                  components side by side in one place.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (response.type === 'build' && response.buildProducts) {
    const buildProducts = response.buildProducts as Record<string, CPUProduct[]>
    const specComponents = (response.buildSpec?.components || []) as {
      category: string
      description?: string
      modelHint?: string
      priority?: string
    }[]

    // Only keep components for categories that exist in our database.
    const knownSpecComponents = specComponents.filter((comp) =>
      CATEGORIES.some((c) => c.id === comp.category)
    )

    const [searchState, setSearchState] = useState<
      Record<
        string,
        {
          term: string
          results: CPUProduct[]
          loading: boolean
          error?: string
          selected?: CPUProduct
        }
      >
    >({})

    const updateComponentState = (
      categoryId: string,
      patch: Partial<{
        term: string
        results: CPUProduct[]
        loading: boolean
        error?: string
        selected?: CPUProduct
      }>
    ) => {
      setSearchState((prev) => ({
        ...prev,
        [categoryId]: {
          term:
            patch.term !== undefined
              ? patch.term
              : prev[categoryId]?.term ||
                getModelOnlyHint(
                  knownSpecComponents.find((c) => c.category === categoryId)?.modelHint
                ) ||
                knownSpecComponents.find((c) => c.category === categoryId)?.modelHint ||
                '',
          results: patch.results !== undefined ? patch.results : prev[categoryId]?.results || [],
          loading: patch.loading !== undefined ? patch.loading : prev[categoryId]?.loading || false,
          error: patch.error !== undefined ? patch.error : prev[categoryId]?.error,
          selected:
            patch.selected !== undefined ? patch.selected : prev[categoryId]?.selected,
        },
      }))
    }

    const handleSearchComponent = async (categoryId: string) => {
      const state = searchState[categoryId]
      const term =
        state?.term ||
        getModelOnlyHint(
          knownSpecComponents.find((c) => c.category === categoryId)?.modelHint
        ) ||
        knownSpecComponents.find((c) => c.category === categoryId)?.modelHint ||
        ''

      const runGenericSearch = async (messageIfEmpty?: string) => {
        const params = new URLSearchParams({
          category: categoryId,
          limit: '6',
        })
        const res = await fetch(`/api/products?${params.toString()}`)
        if (!res.ok) {
          throw new Error(`Failed to load ${categoryId} list (${res.status})`)
        }
        const data = await res.json()
        const results: CPUProduct[] = data.products || []
        updateComponentState(categoryId, {
          results,
          loading: false,
          selected: results[0],
          error:
            results.length === 0
              ? 'No products found in this category.'
              : messageIfEmpty,
        })
      }

      updateComponentState(categoryId, { loading: true, error: undefined })

      try {
        // If there is no hint/term, just show some popular items from this category
        const searchHint = buildSearchHint(categoryId, term)

        if (!searchHint.trim()) {
          await runGenericSearch(undefined)
          return
        }

        const params = new URLSearchParams({
          category: categoryId,
          search: searchHint.trim(),
          limit: '8',
        })
        const res = await fetch(`/api/products?${params.toString()}`)
        if (!res.ok) {
          throw new Error(`Failed to search products (${res.status})`)
        }
        const data = await res.json()
        const results: CPUProduct[] = data.products || []

        if (results.length > 0) {
          updateComponentState(categoryId, {
            results,
            loading: false,
            selected: results[0],
            error: undefined,
          })
        } else {
          // No direct match for the hint – fall back to a generic list so the user can still choose
          await runGenericSearch('No exact match for this hint. Showing popular options instead.')
        }
      } catch (err: any) {
        updateComponentState(categoryId, {
          loading: false,
          error: err?.message || 'Search failed. Please try again.',
        })
      }
    }

    const handleApplyToBuilder = () => {
      // Build up selected products from user choices;
      // if user didn’t search/select for a category, fall back to the API’s first suggestion.
      const selected: { categoryId: string; product: CPUProduct }[] = []

      knownSpecComponents.forEach((spec) => {
        const categoryId = spec.category
        const state = searchState[categoryId]
        const explicit = state?.selected
        if (explicit) {
          selected.push({ categoryId, product: explicit })
          return
        }

        const fallbackList = buildProducts[categoryId]
        const fallback = fallbackList && fallbackList[0]
        if (fallback) {
          selected.push({ categoryId, product: fallback })
        }
      })

      if (!selected.length) return

      clearBuilder()
      selected.forEach(({ categoryId, product }) => {
        addToBuilder(categoryId, product)
      })

      onClose()
      router.push('/builder')
    }

    const estimatedTotal = Object.values(searchState).reduce((sum, state) => {
      if (state?.selected) {
        return sum + (state.selected.min_price || 0)
      }
      return sum
    }, 0)

    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[80vh] overflow-y-auto">
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
            <h3 className="text-xl font-semibold text-gray-900">AI PC Build Found</h3>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>
          <div className="p-6">
            <div className="mb-4">
              <p className="text-sm text-gray-500 mb-2">Your query:</p>
              <p className="text-gray-900 font-medium">&quot;{query}&quot;</p>
            </div>

            {knownSpecComponents.length > 0 && (
              <div className="mb-6">
                <h4 className="text-lg font-semibold text-gray-900 mb-3">
                  Recommended configuration overview
                </h4>
                <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Component
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Suggested model
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Details
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {knownSpecComponents.map((comp) => {
                        const category = CATEGORIES.find((c) => c.id === comp.category)
                        return (
                          <tr key={comp.category}>
                            <td className="px-4 py-3 align-top whitespace-nowrap text-sm font-medium text-gray-900">
                              {category?.name || comp.category}
                            </td>
                            <td className="px-4 py-3 align-top text-sm text-gray-800">
                              {getModelOnlyHint(comp.modelHint) || comp.modelHint || '—'}
                            </td>
                            <td className="px-4 py-3 align-top text-sm text-gray-600">
                              {comp.description || '—'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="space-y-5 mb-6">
              {knownSpecComponents.map((comp) => {
                const category = CATEGORIES.find((c) => c.id === comp.category)
                const state = searchState[comp.category] || {
                  term: getModelOnlyHint(comp.modelHint) || comp.modelHint || '',
                  results: [],
                  loading: false,
                }
                return (
                  <div
                    key={comp.category}
                    className="bg-gray-50 border border-gray-200 rounded-lg p-4"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h5 className="font-semibold text-gray-900">
                          {category?.name || comp.category}
                        </h5>
                        {comp.description && (
                          <p className="text-xs text-gray-600 mt-1">
                            {comp.description}
                          </p>
                        )}
                      </div>
                      {state.selected && (
                        <span className="text-xs font-medium text-green-700 bg-green-100 px-2 py-1 rounded-full">
                          Selected
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          value={state.term}
                          onChange={(e) =>
                            updateComponentState(comp.category, {
                              term: e.target.value,
                            })
                          }
                          placeholder={
                            getModelOnlyHint(comp.modelHint) ||
                            comp.modelHint ||
                            `Type a model name, e.g. "Ryzen 5 5600"`
                          }
                        />
                        <button
                          onClick={() => handleSearchComponent(comp.category)}
                          disabled={state.loading}
                          className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50"
                        >
                          {state.loading ? 'Searching...' : 'Search & select'}
                        </button>
                      </div>
                      {state.error && (
                        <p className="text-xs text-red-600">{state.error}</p>
                      )}
                      {state.results.length > 0 && (
                        <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                          {state.results.map((product) => {
                            const isActive =
                              state.selected &&
                              state.selected.standard_name ===
                                product.standard_name
                            const bestVendor = getBestVendorEntry(product)
                            return (
                              <button
                                key={product.id}
                                type="button"
                                onClick={() =>
                                  updateComponentState(comp.category, {
                                    selected: product,
                                  })
                                }
                                className={`w-full text-left px-3 py-2 rounded-lg border text-xs ${
                                  isActive
                                    ? 'border-purple-500 bg-purple-50'
                                    : 'border-gray-200 hover:bg-gray-100'
                                }`}
                              >
                                <div className="flex flex-col gap-0.5">
                                  <div className="flex justify-between items-center gap-2">
                                    <span className="font-medium text-gray-900 line-clamp-1">
                                      {getFormattedProductName(product)}
                                    </span>
                                    <span className="text-gray-700 font-semibold whitespace-nowrap">
                                      {formatPrice(product.min_price)}
                                    </span>
                                  </div>
                                  {bestVendor && (
                                    <div className="flex justify-between items-center gap-2 text-[11px] text-gray-600">
                                      <span className="line-clamp-1">
                                        Vendor:{' '}
                                        <span className="font-medium">
                                          {getVendorDisplayName(bestVendor.vendor_name)}
                                        </span>
                                      </span>
                                      {typeof bestVendor.price_bdt === 'number' && (
                                        <span className="whitespace-nowrap">
                                          {formatPrice(bestVendor.price_bdt)}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="bg-purple-50 border-2 border-purple-200 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-between">
                <span className="text-lg font-semibold text-gray-900">
                  Estimated Build Cost (from your selections):
                </span>
                <span className="text-2xl font-bold text-purple-600">
                  {estimatedTotal > 0 ? formatPrice(estimatedTotal) : '—'}
                </span>
              </div>
              <p className="mt-1 text-xs text-purple-700">
                You can fine-tune each part using the search boxes above. When
                you are happy, apply the build to the PC Builder.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleApplyToBuilder}
                className="flex-1 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-center font-medium flex items-center justify-center gap-2"
              >
                <Wrench className="h-5 w-5" />
                Apply selected parts in PC Builder
              </button>
              <button
                onClick={onClose}
                className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Fallback for unknown response types
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h3 className="text-xl font-semibold text-gray-900">Search Results</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>
        <div className="p-6">
          <div className="mb-4">
            <p className="text-sm text-gray-500 mb-2">Your query:</p>
            <p className="text-gray-900 font-medium">&quot;{query}&quot;</p>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-gray-800">
              {response.message || 'No results found. Please try a different search query.'}
            </p>
            <pre className="mt-2 text-xs text-gray-600 overflow-auto">
              {JSON.stringify(response, null, 2)}
            </pre>
          </div>
          <button
            onClick={onClose}
            className="mt-4 px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

