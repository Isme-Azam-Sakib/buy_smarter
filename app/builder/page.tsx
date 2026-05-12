'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import Header from '@/components/ui/Header'
import Footer from '@/components/ui/Footer'
import { usePCBuilder } from '@/lib/contexts/PCBuilderContext'
import { CATEGORIES } from '@/lib/categories'
import { formatPrice, getBrandColor, getVendorLogo, getVendorDisplayName } from '@/lib/utils'
import { Cpu, Monitor, MemoryStick, HardDrive, CircuitBoard, Zap, Wind, X, Plus, Printer } from 'lucide-react'
import { CPUProduct } from '@/lib/types'

const iconMap: { [key: string]: any } = {
  Cpu,
  Monitor,
  MemoryStick,
  HardDrive,
  CircuitBoard,
  Zap,
  Wind
}

function getProductDisplayName(product: CPUProduct): string {
  if (product.price_entries && Array.isArray(product.price_entries) && product.price_entries.length > 0) {
    for (const entry of product.price_entries) {
      if (entry?.raw_name && typeof entry.raw_name === 'string' && entry.raw_name.trim()) {
        const name = entry.raw_name.trim()
        const brand = product.brand?.trim()
        if (brand) {
          const lowerName = name.toLowerCase()
          const lowerBrand = brand.toLowerCase()
          if (!lowerName.startsWith(lowerBrand)) {
            return `${brand} ${name}`.replace(/\s+/g, ' ').trim()
          }
        }
        return name
      }
    }
  }
  return product.standard_name || 'Unknown Product'
}

function getCategoryColorClass(color: string, type: 'bg' | 'text' = 'text'): string {
  const colorMap: { [key: string]: { bg: string; text: string } } = {
    blue: { bg: 'bg-blue-100', text: 'text-blue-600' },
    purple: { bg: 'bg-purple-100', text: 'text-purple-600' },
    green: { bg: 'bg-green-100', text: 'text-green-600' },
    orange: { bg: 'bg-orange-100', text: 'text-orange-600' },
    red: { bg: 'bg-red-100', text: 'text-red-600' },
    yellow: { bg: 'bg-yellow-100', text: 'text-yellow-600' },
    cyan: { bg: 'bg-cyan-100', text: 'text-cyan-600' }
  }
  return colorMap[color]?.[type] || (type === 'bg' ? 'bg-gray-100' : 'text-gray-600')
}

export default function BuilderPage() {
  const { builderItems, removeFromBuilder, clearBuilder, getTotalPrice, getItemCount } = usePCBuilder()

  const handleRemove = (category: string) => {
    removeFromBuilder(category)
  }

  const isMultiSelectCategory = (categoryId: string) => categoryId === 'ram' || categoryId === 'ssd'

  const toProductArray = (item: any): CPUProduct[] => {
    if (!item) return []
    return Array.isArray(item) ? (item as CPUProduct[]) : ([item] as CPUProduct[])
  }

  // Get the cheapest vendor for a product
  const getCheapestVendor = (product: CPUProduct) => {
    if (!product.price_entries || product.price_entries.length === 0) return null
    const sorted = [...product.price_entries].sort((a, b) => a.price_bdt - b.price_bdt)
    return sorted[0]
  }

  // Calculate savings (difference between max and min price if multiple vendors)
  const calculateSavings = () => {
    let totalMax = 0
    let totalMin = 0
    Object.values(builderItems).forEach((product) => {
      const products = toProductArray(product)
      for (const p of products) {
        if (!p) continue
        totalMin += p.min_price
        totalMax += p.max_price || p.min_price
      }
    })
    return totalMax - totalMin
  }

  const savings = calculateSavings()
  const totalPrice = getTotalPrice()

  const [printMode, setPrintMode] = useState<'list' | 'quotation' | null>(null)
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const handlePrint = (mode: 'list' | 'quotation') => {
    setPrintMode(mode)
    setTimeout(() => {
      const onAfterPrint = () => {
        setPrintMode(null)
        window.removeEventListener('afterprint', onAfterPrint)
      }
      window.addEventListener('afterprint', onAfterPrint)
      window.print()
    }, 150)
  }

  const printItems = CATEGORIES.flatMap((category) => {
    const rawItem = builderItems[category.id] as any
    const products = toProductArray(rawItem)
    if (products.length === 0) return []
    const categoryLabel =
      category.id === 'graphics-card' ? 'GPU' :
      category.id === 'power-supply' ? 'PSU' :
      category.name
    return products.map((p) => {
      const cheapest = getCheapestVendor(p)
      return {
        category: categoryLabel,
        name: getProductDisplayName(p),
        shop: cheapest ? getVendorDisplayName(cheapest.vendor_name) : '--',
        price: p.min_price,
      }
    })
  })

  return (
    <main className="min-h-screen flex flex-col bg-white">
      <Header />
      <div className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Top Header Section */}
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-xl font-semibold text-gray-900">PC Builder</h1>
            {getItemCount() > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => handlePrint('list')}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-sm font-medium"
                >
                  <Printer className="h-4 w-4" />
                  Print List
                </button>
                <button
                  onClick={() => handlePrint('quotation')}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 transition-colors text-sm font-medium"
                >
                  <Printer className="h-4 w-4" />
                  Print Quotation
                </button>
                <button
                  onClick={clearBuilder}
                  className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors text-sm font-medium"
                >
                  Clear All
                </button>
              </div>
            )}
          </div>

          {/* Table Header */}
          <div className="bg-purple-600 text-white rounded-t-lg px-6 py-3">
            <div className="grid grid-cols-12 gap-4 text-sm font-semibold">
              <div className="col-span-3">PC Parts</div>
              <div className="col-span-4">Select</div>
              <div className="col-span-2">Shop</div>
              <div className="col-span-1 text-center">Qty.</div>
              <div className="col-span-2 text-right">Price</div>
            </div>
          </div>

          {/* Table Body */}
          <div className="bg-white border border-t-0 border-gray-200 rounded-b-lg overflow-hidden">
            {CATEGORIES.map((category, index) => {
              const Icon = iconMap[category.icon] || Cpu
              const rawItem = builderItems[category.id] as any
              const products = toProductArray(rawItem)
              const isMulti = isMultiSelectCategory(category.id)
              const primaryProduct = !isMulti ? (products[0] || null) : null
              const cheapestEntry = primaryProduct ? getCheapestVendor(primaryProduct) : null
              const vendorName = cheapestEntry?.vendor_name || '--'
              const vendorLogo = vendorName !== '--' ? getVendorLogo(vendorName) : null
              const categoryTotalPrice = products.reduce((sum, p) => sum + (p?.min_price || 0), 0)

              return (
                <div
                  key={category.id}
                  className={`border-b border-gray-200 last:border-b-0 ${
                    products.length > 0 ? 'bg-white' : 'bg-gray-50'
                  }`}
                >
                  <div className="grid grid-cols-12 gap-4 px-6 py-4 items-center">
                    {/* PC Parts Column */}
                    <div className="col-span-3">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${getCategoryColorClass(category.color, 'bg')}`}>
                          <Icon className={`h-5 w-5 ${getCategoryColorClass(category.color, 'text')}`} />
                        </div>
                        <span className="font-medium text-gray-900 capitalize">
                          {category.id === 'graphics-card' ? 'GPU' : category.id === 'power-supply' ? 'PSU' : category.name}
                        </span>
                      </div>
                    </div>

                    {/* Select Column */}
                    <div className="col-span-4">
                      {products.length > 0 ? (
                        isMulti ? (
                          <div className="space-y-3">
                            {products.map((p, idx) => (
                              <div key={`${p.id}-${idx}`} className="flex items-center gap-3">
                                <Link
                                  href={`/products/${category.id}/${encodeURIComponent(p.standard_name)}`}
                                  className="flex items-center gap-3 hover:opacity-80 transition-opacity flex-1 min-w-0"
                                >
                                  {p.images && p.images.length > 0 ? (
                                    <img
                                      src={p.images[0]}
                                      alt={p.standard_name}
                                      className="w-16 h-16 object-contain bg-gray-100 rounded-lg"
                                    />
                                  ) : (
                                    <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center">
                                      <Icon className="h-8 w-8 text-gray-400" />
                                    </div>
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getBrandColor(p.brand)}`}>
                                        {p.brand}
                                      </span>
                                    </div>
                                    <p className="text-sm font-medium text-gray-900 line-clamp-2">
                                      {getProductDisplayName(p)}
                                    </p>
                                  </div>
                                </Link>
                                <button
                                  onClick={() => removeFromBuilder(category.id, idx)}
                                  className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors flex-shrink-0"
                                  aria-label="Remove from builder"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                            ))}

                            <Link
                              href={`/products/${category.id}`}
                              className="inline-flex items-center gap-2 text-purple-600 hover:text-purple-700 transition-colors text-sm font-medium"
                            >
                              <Plus className="h-4 w-4" />
                              Add another {category.name.toLowerCase()}
                            </Link>
                          </div>
                        ) : (
                        (() => {
                          const product = products[0]
                          if (!product) return null
                          return (
                        <Link
                          href={`/products/${category.id}/${encodeURIComponent(product.standard_name)}`}
                          className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                        >
                          {product.images && product.images.length > 0 ? (
                            <img
                              src={product.images[0]}
                              alt={product.standard_name}
                              className="w-16 h-16 object-contain bg-gray-100 rounded-lg"
                            />
                          ) : (
                            <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center">
                              <Icon className="h-8 w-8 text-gray-400" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getBrandColor(product.brand)}`}>
                                {product.brand}
                              </span>
                            </div>
                            <p className="text-sm font-medium text-gray-900 line-clamp-2">
                              {getProductDisplayName(product)}
                            </p>
                          </div>
                        </Link>
                          )
                        })()
                        )
                      ) : (
                        <Link
                          href={`/products/${category.id}`}
                          className="flex items-center gap-3 text-purple-600 hover:text-purple-700 transition-colors"
                        >
                          <div className="w-16 h-16 border-2 border-dashed border-purple-300 rounded-lg flex items-center justify-center bg-purple-50">
                            <Plus className="h-6 w-6" />
                          </div>
                          <span className="font-medium">Choose a {category.name.toLowerCase()}</span>
                        </Link>
                      )}
                    </div>

                    {/* Shop Column */}
                    <div className="col-span-2">
                      {isMulti && products.length > 0 ? (
                        <span className="text-gray-500 text-sm">
                          Multiple
                        </span>
                      ) : (
                        vendorLogo ? (
                          <div className="flex items-center gap-2">
                            <img
                              src={vendorLogo}
                              alt={vendorName}
                              className="h-8 w-auto object-contain"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement
                                target.style.display = 'none'
                              }}
                            />
                            <span className="text-sm text-gray-700 font-medium">
                              {getVendorDisplayName(vendorName)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-400">--</span>
                        )
                      )}
                    </div>

                    {/* Qty Column */}
                    <div className="col-span-1 text-center">
                      {products.length > 0 ? (
                        <span className="text-gray-700 font-medium">{products.length}</span>
                      ) : (
                        <span className="text-gray-400">--</span>
                      )}
                    </div>

                    {/* Price Column */}
                    <div className="col-span-2 text-right">
                      {products.length > 0 ? (
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-gray-900 font-semibold">
                            {formatPrice(isMulti ? categoryTotalPrice : (products[0]?.min_price || 0))}
                          </span>
                          {!isMulti && (
                            <button
                              onClick={() => handleRemove(category.id)}
                              className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                              aria-label="Remove from builder"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400">--</span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Empty State */}
          {getItemCount() === 0 && (
            <div className="text-center py-12 bg-gray-50 rounded-lg mt-8">
              <div className="text-gray-400 mb-4">
                <Cpu className="h-16 w-16 mx-auto" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Start Building Your PC</h3>
              <p className="text-gray-600 mb-6">
                Browse categories and add components to your build
              </p>
              <Link
                href="/products/processor"
                className="inline-flex items-center px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
              >
                Browse Products
              </Link>
            </div>
          )}

          {/* Bottom Total Cost Summary */}
          {getItemCount() > 0 && (
            <div className="mt-6 flex justify-end">
              <div className="bg-purple-600 text-white px-6 py-4 rounded-lg inline-block">
                <div className="text-sm font-medium mb-1">Total Build Cost</div>
                <div className="text-2xl font-bold">{formatPrice(totalPrice)}</div>
                {savings > 0 && (
                  <div className="text-sm mt-1 opacity-90">
                    You&apos;re saving: {formatPrice(savings)}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      <Footer />

      {/* ── Print Styles ── */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page { size: A4; margin: 12mm; }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            height: auto !important;
            background: #fff !important;
          }
          body > *:not(#pc-print-content) {
            display: none !important;
          }
          #pc-print-content {
            display: block !important;
            position: static !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
            box-sizing: border-box;
          }
        }
      `}} />

      {/* ── Print Content (portaled to body so siblings can be hidden cleanly) ── */}
      {printMode && isMounted && createPortal(
        <div id="pc-print-content" style={{ display: 'none' }}>
          <div style={{ fontFamily: 'Arial, sans-serif', color: '#000' }}>

            {/* Print Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', borderBottom: '2px solid #7c3aed', paddingBottom: '16px' }}>
              <div>
                <h1 style={{ fontSize: '22px', fontWeight: 'bold', margin: '0 0 4px 0', color: '#7c3aed' }}>
                  {printMode === 'list' ? 'PC Build List' : 'PC Build Quotation'}
                </h1>
                <p style={{ fontSize: '12px', color: '#555', margin: 0 }}>
                  {new Date().toLocaleDateString('en-BD', { year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              </div>
              {printMode === 'quotation' && (
                <div style={{ textAlign: 'right', fontSize: '12px', color: '#555', lineHeight: '1.8' }}>
                  <div>Shop Name: ___________________________</div>
                  <div>Date visited: ___________________________</div>
                </div>
              )}
            </div>

            {/* Print Table */}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ backgroundColor: '#7c3aed', color: 'white' }}>
                  <th style={{ padding: '10px 12px', textAlign: 'left', border: '1px solid #6d28d9', width: '32px' }}>#</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', border: '1px solid #6d28d9', width: '120px' }}>Component</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', border: '1px solid #6d28d9' }}>Product Name</th>
                  {printMode === 'list' && (
                    <>
                      <th style={{ padding: '10px 12px', textAlign: 'left', border: '1px solid #6d28d9', width: '140px' }}>Shop</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center', border: '1px solid #6d28d9', width: '48px' }}>Qty</th>
                    </>
                  )}
                  <th style={{ padding: '10px 12px', textAlign: printMode === 'list' ? 'right' : 'center', border: '1px solid #6d28d9', width: printMode === 'quotation' ? '160px' : '140px' }}>
                    Price (BDT)
                  </th>
                </tr>
              </thead>
              <tbody>
                {printItems.map((item, idx) => (
                  <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f9f7ff' }}>
                    <td style={{ padding: '10px 12px', border: '1px solid #e5e7eb', color: '#6b7280', textAlign: 'center' }}>{idx + 1}</td>
                    <td style={{ padding: '10px 12px', border: '1px solid #e5e7eb', fontWeight: '600', color: '#374151' }}>{item.category}</td>
                    <td style={{ padding: '10px 12px', border: '1px solid #e5e7eb', color: '#374151' }}>{item.name}</td>
                    {printMode === 'list' && (
                      <>
                        <td style={{ padding: '10px 12px', border: '1px solid #e5e7eb', color: '#374151' }}>{item.shop}</td>
                        <td style={{ padding: '10px 12px', border: '1px solid #e5e7eb', textAlign: 'center', color: '#374151' }}>1</td>
                      </>
                    )}
                    <td style={{
                      padding: printMode === 'quotation' ? '4px 8px' : '10px 12px',
                      border: '1px solid #e5e7eb',
                      textAlign: printMode === 'list' ? 'right' : 'center',
                      fontWeight: printMode === 'list' ? '600' : 'normal',
                      color: '#374151',
                    }}>
                      {printMode === 'list'
                        ? formatPrice(item.price)
                        : (
                          <div style={{ border: '1px solid #d1d5db', borderRadius: '4px', height: '28px', backgroundColor: '#fff' }} />
                        )
                      }
                    </td>
                  </tr>
                ))}

                {/* Total row */}
                <tr style={{ backgroundColor: '#f3f0ff' }}>
                  <td
                    colSpan={printMode === 'list' ? 5 : 3}
                    style={{ padding: '12px', border: '1px solid #e5e7eb', textAlign: 'right', fontWeight: 'bold', color: '#374151' }}
                  >
                    Total
                  </td>
                  <td style={{
                    padding: printMode === 'quotation' ? '4px 8px' : '12px',
                    border: '1px solid #e5e7eb',
                    textAlign: printMode === 'list' ? 'right' : 'center',
                    fontWeight: 'bold',
                    color: '#7c3aed',
                  }}>
                    {printMode === 'list'
                      ? formatPrice(totalPrice)
                      : (
                        <div style={{ border: '1px solid #d1d5db', borderRadius: '4px', height: '28px', backgroundColor: '#fff' }} />
                      )
                    }
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Quotation footer note */}
            {printMode === 'quotation' && (
              <div style={{ marginTop: '24px', padding: '12px 16px', border: '1px dashed #d1d5db', borderRadius: '6px', backgroundColor: '#f9fafb' }}>
                <p style={{ fontSize: '11px', color: '#6b7280', margin: 0 }}>
                  <strong>Note:</strong> Please ask the shop owner to fill in the current market price for each component. Prices may vary by shop.
                </p>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </main>
  )
}
