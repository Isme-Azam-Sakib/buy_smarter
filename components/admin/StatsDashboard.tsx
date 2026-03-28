'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Package, DollarSign, TrendingUp, Image, Database } from 'lucide-react'

interface Stats {
  totalProducts: number
  byVendor: Array<{ vendor_name: string; count: number }>
  byCategory: Array<{ category: string; count: number }>
  byBrand: Array<{ brand: string; count: number }>
  priceStats: {
    min_price: number
    max_price: number
    avg_price: number
    total_value: number
  }
  availabilityStats: Array<{ availability_status: string; count: number }>
  recentlyUpdated: Array<{
    id: number
    raw_name: string
    vendor_name: string
    price_bdt: number
    updated_at: string
  }>
  imageStats: {
    withImages: number
    withoutImages: number
  }
}

export default function StatsDashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/stats')
      .then((res) => res.json())
      .then((data) => {
        setStats(data)
        setLoading(false)
      })
      .catch((err) => {
        console.error('Failed to fetch stats:', err)
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <div className="p-6 lg:p-8">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading statistics...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="p-6 lg:p-8">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <p className="text-red-600">Failed to load statistics</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Database Statistics</h1>
        <p className="text-gray-600">Analytics and insights</p>
      </div>
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Products</p>
                <p className="text-3xl font-bold text-gray-900">{stats.totalProducts.toLocaleString()}</p>
              </div>
              <Package className="h-12 w-12 text-blue-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Avg Price</p>
                <p className="text-3xl font-bold text-gray-900">
                  ৳{Math.round(stats.priceStats.avg_price).toLocaleString()}
                </p>
              </div>
              <DollarSign className="h-12 w-12 text-green-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Vendors</p>
                <p className="text-3xl font-bold text-gray-900">{stats.byVendor.length}</p>
              </div>
              <TrendingUp className="h-12 w-12 text-purple-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">With Images</p>
                <p className="text-3xl font-bold text-gray-900">
                  {stats.imageStats.withImages.toLocaleString()}
                </p>
              </div>
              <Image className="h-12 w-12 text-orange-500" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* By Vendor */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Products by Vendor</h2>
            <div className="space-y-2">
              {stats.byVendor.map((item) => (
                <div key={item.vendor_name} className="flex items-center justify-between">
                  <span className="text-gray-700">{item.vendor_name}</span>
                  <span className="font-semibold text-gray-900">{item.count.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>

          {/* By Category */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Products by Category</h2>
            <div className="space-y-2">
              {stats.byCategory.map((item) => (
                <div key={item.category} className="flex items-center justify-between">
                  <span className="text-gray-700">{item.category}</span>
                  <span className="font-semibold text-gray-900">{item.count.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>

          {/* By Brand */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Top Brands</h2>
            <div className="space-y-2">
              {stats.byBrand.map((item) => (
                <div key={item.brand} className="flex items-center justify-between">
                  <span className="text-gray-700">{item.brand}</span>
                  <span className="font-semibold text-gray-900">{item.count.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Availability */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Availability Status</h2>
            <div className="space-y-2">
              {stats.availabilityStats.map((item) => (
                <div key={item.availability_status} className="flex items-center justify-between">
                  <span className="text-gray-700">{item.availability_status}</span>
                  <span className="font-semibold text-gray-900">{item.count.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Price Statistics */}
        <div className="mt-6 bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Price Statistics</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-600">Minimum</p>
              <p className="text-2xl font-bold text-gray-900">
                ৳{Math.round(stats.priceStats.min_price).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Maximum</p>
              <p className="text-2xl font-bold text-gray-900">
                ৳{Math.round(stats.priceStats.max_price).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Average</p>
              <p className="text-2xl font-bold text-gray-900">
                ৳{Math.round(stats.priceStats.avg_price).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Value</p>
              <p className="text-2xl font-bold text-gray-900">
                ৳{Math.round(stats.priceStats.total_value).toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {/* Recently Updated */}
        <div className="mt-6 bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Recently Updated Products</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Product</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Vendor</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Price</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {stats.recentlyUpdated.map((product) => (
                  <tr key={product.id}>
                    <td className="px-4 py-2 text-sm text-gray-900">{product.raw_name}</td>
                    <td className="px-4 py-2 text-sm text-gray-600">{product.vendor_name}</td>
                    <td className="px-4 py-2 text-sm text-gray-900">
                      ৳{product.price_bdt.toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-600">
                      {new Date(product.updated_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
    </div>
  )
}

