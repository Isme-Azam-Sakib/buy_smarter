'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface RefreshButtonProps {
  productId: string
}

export default function RefreshButton({ productId }: RefreshButtonProps) {
  const router = useRouter()
  const [refreshing, setRefreshing] = useState(false)

  const handleRefresh = async () => {
    if (!productId) {
      alert('Cannot refresh: Missing product ID')
      return
    }

    setRefreshing(true)
    try {
      const response = await fetch(
        `/api/admin/products/${productId}/refresh`,
        { method: 'POST' }
      )
      const data = await response.json()
      
      if (!response.ok) {
        const errorMsg = data.error || data.details || 'Refresh failed'
        throw new Error(errorMsg)
      }
      
      // Show success message
      const message = data.success 
        ? `Product refreshed successfully! Updated ${data.scraped_count || 1} vendor(s).`
        : 'Product refresh completed.'
      alert(message)
      
      // Refresh the page to show updated data
      router.refresh()
    } catch (error: any) {
      console.error('Refresh error:', error)
      alert(error.message || 'Failed to refresh product. Please try again.')
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <button
      onClick={handleRefresh}
      disabled={refreshing || !productId}
      className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm text-gray-700 transition-colors w-full disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <svg
        className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
        />
      </svg>
      {refreshing ? 'Refreshing...' : 'Refresh Item'}
    </button>
  )
}

