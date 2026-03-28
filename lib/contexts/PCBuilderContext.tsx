'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { CPUProduct } from '@/lib/types'

type BuilderItem = CPUProduct | CPUProduct[]
type BuilderItems = Record<string, BuilderItem | null | undefined>

const MULTI_SELECT_CATEGORIES = new Set(['ram', 'ssd'])

interface PCBuilderContextType {
  builderItems: BuilderItems
  addToBuilder: (category: string, product: CPUProduct) => void
  /**
   * For single-select categories, omit `index` to remove the selection.
   * For multi-select categories (RAM/SSD), pass `index` to remove one instance,
   * or omit `index` to clear the whole category.
   */
  removeFromBuilder: (category: string, index?: number) => void
  clearBuilder: () => void
  getTotalPrice: () => number
  getItemCount: () => number
}

const PCBuilderContext = createContext<PCBuilderContextType | undefined>(undefined)

const BUILDER_STORAGE_KEY = 'pc-builder-items'

function normalizeBuilderItems(raw: any): BuilderItems {
  if (!raw || typeof raw !== 'object') return {}

  const normalized: BuilderItems = {}
  for (const [category, value] of Object.entries(raw)) {
    if (!value) continue

    // Ensure RAM/SSD are arrays
    if (MULTI_SELECT_CATEGORIES.has(category)) {
      if (Array.isArray(value)) {
        normalized[category] = value.filter(Boolean) as CPUProduct[]
      } else {
        normalized[category] = [value as CPUProduct]
      }
      continue
    }

    // Ensure single-select categories are single items
    if (Array.isArray(value)) {
      normalized[category] = (value[0] as CPUProduct) || null
    } else {
      normalized[category] = value as CPUProduct
    }
  }

  return normalized
}

export function PCBuilderProvider({ children }: { children: ReactNode }) {
  const [builderItems, setBuilderItems] = useState<BuilderItems>({})

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(BUILDER_STORAGE_KEY)
      if (stored) {
        setBuilderItems(normalizeBuilderItems(JSON.parse(stored)))
      }
    } catch (error) {
      console.error('Failed to load builder items from localStorage:', error)
    }
  }, [])

  // Save to localStorage whenever builderItems changes
  useEffect(() => {
    try {
      localStorage.setItem(BUILDER_STORAGE_KEY, JSON.stringify(builderItems))
    } catch (error) {
      console.error('Failed to save builder items to localStorage:', error)
    }
  }, [builderItems])

  const addToBuilder = (category: string, product: CPUProduct) => {
    setBuilderItems((prev) => {
      if (MULTI_SELECT_CATEGORIES.has(category)) {
        const existing = prev[category]
        const next = Array.isArray(existing) ? existing : existing ? [existing] : []
        return {
          ...prev,
          [category]: [...next, product],
        }
      }

      return {
        ...prev,
        [category]: product,
      }
    })
  }

  const removeFromBuilder = (category: string, index?: number) => {
    setBuilderItems((prev) => {
      const updated: BuilderItems = { ...prev }

      if (MULTI_SELECT_CATEGORIES.has(category)) {
        const existing = updated[category]
        const arr = Array.isArray(existing) ? [...existing] : existing ? [existing] : []

        if (typeof index === 'number') {
          if (index >= 0 && index < arr.length) arr.splice(index, 1)
          if (arr.length > 0) updated[category] = arr
          else delete updated[category]
          return updated
        }

        // No index provided -> clear whole category
        delete updated[category]
        return updated
      }

      delete updated[category]
      return updated
    })
  }

  const clearBuilder = () => {
    setBuilderItems({})
  }

  const getTotalPrice = () => {
    return Object.values(builderItems).reduce((total, item) => {
      if (!item) return total
      if (Array.isArray(item)) {
        return total + item.reduce((sum, p) => sum + (p?.min_price || 0), 0)
      }
      return total + (item.min_price || 0)
    }, 0)
  }

  const getItemCount = () => {
    return Object.values(builderItems).reduce((count, item) => {
      if (!item) return count
      if (Array.isArray(item)) return count + item.length
      return count + 1
    }, 0)
  }

  return (
    <PCBuilderContext.Provider
      value={{
        builderItems,
        addToBuilder,
        removeFromBuilder,
        clearBuilder,
        getTotalPrice,
        getItemCount,
      }}
    >
      {children}
    </PCBuilderContext.Provider>
  )
}

export function usePCBuilder() {
  const context = useContext(PCBuilderContext)
  if (context === undefined) {
    throw new Error('usePCBuilder must be used within a PCBuilderProvider')
  }
  return context
}

