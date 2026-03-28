'use client'

import { useMemo, useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { CustomInput } from '@/components/ui/CustomInput'
import { MoreVertical, Edit, Trash2, RefreshCw } from 'lucide-react'

export const dynamic = 'force-dynamic'

interface AdminProduct {
  id: number
  standard_name: string
  vendor_name: string
  brand: string
  price_bdt: number
  category: string
  availability_status: string
  updated_at: string
  image_url?: string | null
}

interface Filters {
  vendor?: string
  category?: string
  brand?: string
  availability?: string
  minPrice?: number
  maxPrice?: number
}

interface ApiResponse {
  data: AdminProduct[]
  pagination: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
  filters?: {
    sortBy: string
    sortOrder: string
  }
  filterOptions?: {
    vendors: string[]
    categories: string[]
    brands: string[]
    availability: string[]
  }
}

const sortOptions = [
  { label: 'Updated At', value: 'updated_at' },
  { label: 'Price', value: 'price_bdt' },
  { label: 'Vendor', value: 'vendor_name' },
]

export default function AdminProductListPage() {
  const router = useRouter()
  const [products, setProducts] = useState<AdminProduct[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [limit] = useState(25)
  const [filters, setFilters] = useState<Filters>({})
  const [search, setSearch] = useState('')
  const [pagination, setPagination] = useState<ApiResponse['pagination'] | null>(null)
  const [sortBy, setSortBy] = useState('updated_at')
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC')
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [selectAll, setSelectAll] = useState(false)
  const [bulkMessage, setBulkMessage] = useState('')
  const [bulkMenuOpen, setBulkMenuOpen] = useState(false)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const menuRefs = useRef<{ [key: string]: HTMLDivElement | null }>({})

  const [columnFilters, setColumnFilters] = useState({
    product: '',
    vendor: '',
    category: '',
    price: '',
    status: '',
    updated: '',
  })
  const [filterOptions, setFilterOptions] = useState<{
    vendors: string[]
    categories: string[]
    brands: string[]
    availability: string[]
  }>({
    vendors: [],
    categories: [],
    brands: [],
    availability: ['in_stock', 'limited', 'out_of_stock', 'pre_order', 'upcoming'],
  })
  const [permissions, setPermissions] = useState<string[]>([])
  const [userRole, setUserRole] = useState<'superadmin' | 'vendor'>('superadmin')

  // Helper function to check permissions
  const hasPermission = (permission: string): boolean => {
    if (userRole === 'superadmin') return true
    if (permissions.includes(permission)) return true
    // If checking a granular product permission, check if 'products' is granted
    if (permission.startsWith('products.') && permissions.includes('products')) {
      return true
    }
    return false
  }

  // Fetch user permissions on mount
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch('/api/admin/auth/me')
        if (response.ok) {
          const data = await response.json()
          setPermissions(data.user?.permissions || [])
          setUserRole(data.user?.role || 'superadmin')
        }
      } catch (error) {
        console.error('Failed to fetch user permissions:', error)
      }
    }
    fetchUser()
  }, [])

  const queryKey = useMemo(
    () => ({
      page,
      limit,
      search,
      sortBy,
      sortOrder,
      ...filters,
    }),
    [page, limit, search, sortBy, sortOrder, filters]
  )

  // Close menu when clicking outside
  useEffect(() => {
    if (openMenuId === null) return

    const handleClickOutside = (event: MouseEvent) => {
      const menuElement = menuRefs.current[openMenuId]
      if (menuElement && !menuElement.contains(event.target as Node)) {
        setOpenMenuId(null)
      }
    }

    // Add listener after a small delay to prevent immediate closing
    const timeoutId = setTimeout(() => {
      document.addEventListener('click', handleClickOutside)
    }, 0)

    return () => {
      clearTimeout(timeoutId)
      document.removeEventListener('click', handleClickOutside)
    }
  }, [openMenuId])

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams({
          page: page.toString(),
          limit: limit.toString(),
          sortBy,
          sortOrder,
          ...(search && { search }),
          // Column-specific filters
          ...(columnFilters.product && { productFilter: columnFilters.product }),
          ...(columnFilters.vendor && { vendorColumnFilter: columnFilters.vendor }),
          ...(columnFilters.category && { categoryColumnFilter: columnFilters.category }),
          ...(columnFilters.price && { priceColumnFilter: columnFilters.price }),
          ...(columnFilters.status && { statusColumnFilter: columnFilters.status }),
          ...(columnFilters.updated && { updatedColumnFilter: columnFilters.updated }),
          // Legacy dropdown filters
          ...(filters.vendor && { vendor: filters.vendor }),
          ...(filters.category && { category: filters.category }),
          ...(filters.brand && { brand: filters.brand }),
          ...(filters.availability && { availability: filters.availability }),
          ...(filters.minPrice && { minPrice: filters.minPrice.toString() }),
          ...(filters.maxPrice && { maxPrice: filters.maxPrice.toString() }),
        })
        const response = await fetch(`/api/admin/products?${params.toString()}`, {
          cache: 'no-store',
        })
        if (!response.ok) throw new Error('Failed to load products')
      const data = (await response.json()) as ApiResponse
        // Filter out any products with null/undefined IDs and log a warning
        const validProducts = (data.data || []).filter((p: AdminProduct) => {
          if (p.id === null || p.id === undefined) {
            console.warn('Product with missing ID found:', p.standard_name, p.vendor_name)
            return false
          }
          return true
        })
        setProducts(validProducts)
        setPagination(data.pagination)
        setSelectedIds(new Set())
        setSelectAll(false)
      if (data.filterOptions) {
        setFilterOptions((prev) => ({
          vendors: data.filterOptions?.vendors || prev.vendors,
          categories: data.filterOptions?.categories || prev.categories,
          brands: data.filterOptions?.brands || prev.brands,
          availability:
            data.filterOptions?.availability.length
              ? data.filterOptions.availability
              : prev.availability,
        }))
      }
      } catch (error) {
        console.error(error)
      } finally {
        setLoading(false)
      }
    }
    fetchProducts()
  }, [page, limit, search, sortBy, sortOrder, JSON.stringify(filters), JSON.stringify(columnFilters)])

  const toggleSelectAll = () => {
    setSelectAll(!selectAll)
    setSelectedIds((prev) => {
      if (selectAll) return new Set()
      return new Set(products.map((p) => p.id))
    })
  }

  const toggleRow = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSortChange = (column: string) => {
    if (sortBy === column) {
      setSortOrder((prev) => (prev === 'ASC' ? 'DESC' : 'ASC'))
    } else {
      setSortBy(column)
      setSortOrder('ASC')
    }
  }

  const handleBulkAction = async (action: 'delete') => {
    if (!selectedIds.size) return
    setBulkMessage('')
    try {
      const response = await fetch('/api/admin/products/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ids: Array.from(selectedIds) }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Bulk action failed')
      }
      setBulkMessage(`Bulk action "${data.action}" applied to ${data.count} products`)
      window.location.reload()
    } catch (error: any) {
      setBulkMessage(error.message)
    }
  }

  const handleRefreshSelected = async () => {
    if (!selectedIds.size) return
    setBulkMenuOpen(false)
    setBulkMessage('')
    const selectedProducts = products.filter((product) => selectedIds.has(product.id))
    try {
      for (const product of selectedProducts) {
        const response = await fetch(
          `/api/products/${encodeURIComponent(product.category)}/${encodeURIComponent(
            product.standard_name
          )}/refresh`,
          { method: 'POST' }
        )
        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'Refresh failed')
        }
      }
      setBulkMessage(`Refresh triggered for ${selectedProducts.length} products`)
    } catch (error: any) {
      setBulkMessage(error.message)
    }
  }

  const handleProductAction = async (productId: number | null | undefined, action: 'edit' | 'update' | 'delete') => {
    setOpenMenuId(null)
    
    // Defensive check for invalid product ID
    if (productId === null || productId === undefined) {
      setBulkMessage('Error: Product ID is missing. Please refresh the page and try again.')
      return
    }
    
    const product = products.find((p) => p.id === productId)
    if (!product) {
      setBulkMessage('Error: Product not found in the list.')
      return
    }

    if (action === 'edit') {
      router.push(`/admin/products/${productId}`)
    } else if (action === 'update') {
      try {
        const response = await fetch(
          `/api/admin/products/${productId}/refresh`,
          { method: 'POST' }
        )
        const data = await response.json()
        if (!response.ok) {
          throw new Error(data.error || data.details || 'Update failed')
        }
        setBulkMessage(`Product "${product.standard_name}" from ${product.vendor_name} refreshed successfully`)
        // Refresh the list to show updated data
        setTimeout(() => {
          window.location.reload()
        }, 1000)
      } catch (error: any) {
        setBulkMessage(error.message || 'Failed to refresh product')
      }
    } else if (action === 'delete') {
      if (!confirm(`Are you sure you want to delete "${product.standard_name}"?`)) {
        return
      }
      try {
        const response = await fetch(`/api/admin/products/${productId}`, {
          method: 'DELETE',
        })
        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'Delete failed')
        }
        setBulkMessage(`Product "${product.standard_name}" deleted successfully`)
        // Refresh the list
        window.location.reload()
      } catch (error: any) {
        setBulkMessage(error.message)
      }
    }
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-1">Product List</h1>
        <p className="text-gray-600">Browse, filter, and act on catalog entries.</p>
      </div>

      <div className="bg-white shadow rounded-xl border border-gray-200 p-6 space-y-6">
        <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2 flex gap-3">
            <CustomInput
              placeholder="Search by name, brand or vendor"
              value={search}
              onChange={(value) => {
                setSearch(value)
                setPage(1)
              }}
              className="flex-1"
            />
            <button
              onClick={() => setPage(1)}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              Apply
            </button>
          </div>
          <select
            value={filters.vendor || ''}
            onChange={(e) => setFilters((prev) => ({ ...prev, vendor: e.target.value || undefined }))}
            className="px-4 py-2 border border-gray-300 rounded-lg"
          >
            <option value="">All Vendors</option>
            {filterOptions.vendors.map((vendor) => (
              <option key={vendor} value={vendor}>
                {vendor}
              </option>
            ))}
          </select>
          <select
            value={filters.category || ''}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, category: e.target.value || undefined }))
            }
            className="px-4 py-2 border border-gray-300 rounded-lg"
          >
            <option value="">All Categories</option>
            {filterOptions.categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <select
            value={filters.brand || ''}
            onChange={(e) => setFilters((prev) => ({ ...prev, brand: e.target.value || undefined }))}
            className="px-4 py-2 border border-gray-300 rounded-lg"
          >
            <option value="">All Brands</option>
            {filterOptions.brands.map((brand) => (
              <option key={brand} value={brand}>
                {brand}
              </option>
            ))}
          </select>
          <select
            value={filters.availability || ''}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, availability: e.target.value || undefined }))
            }
            className="px-4 py-2 border border-gray-300 rounded-lg"
          >
            <option value="">Any Availability</option>
            {filterOptions.availability.map((status) => (
              <option key={status} value={status}>
                {status.replace('_', ' ')}
              </option>
            ))}
          </select>
          <div className="flex gap-3">
            <input
              type="number"
              placeholder="Min Price"
              value={filters.minPrice ?? ''}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  minPrice: e.target.value ? Number(e.target.value) : undefined,
                }))
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <input
              type="number"
              placeholder="Max Price"
              value={filters.maxPrice ?? ''}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  maxPrice: e.target.value ? Number(e.target.value) : undefined,
                }))
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setFilters({})}
              className="px-4 py-2 bg-gray-100 rounded-lg border border-gray-300"
            >
              Reset Filters
            </button>
            <button
              onClick={() => setPage(1)}
              className="px-4 py-2 bg-purple-50 text-purple-600 rounded-lg border border-purple-200"
            >
              Apply Filters
            </button>
          </div>
        </section>

        <div className="flex flex-col gap-4">
          {selectedIds.size > 0 && (
            <div className="flex flex-col gap-2 bg-purple-50 border border-purple-100 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-purple-700">{selectedIds.size} selected</p>
                <div className="relative">
                  <button
                    onClick={() => setBulkMenuOpen((prev) => !prev)}
                    className="px-3 py-1 text-sm text-gray-700 border border-gray-300 rounded-lg bg-white shadow-sm"
                  >
                    Bulk actions ▾
                  </button>
                  {bulkMenuOpen && (
                    <div className="absolute right-0 mt-2 w-40 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                      {hasPermission('products.delete') && (
                        <button
                          className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-50"
                          onClick={() => {
                            handleBulkAction('delete')
                            setBulkMenuOpen(false)
                          }}
                        >
                          Delete selected
                        </button>
                      )}
                      <button
                        className="w-full text-left px-4 py-2 text-sm text-purple-700 hover:bg-gray-50"
                        onClick={() => {
                          handleRefreshSelected()
                          setBulkMenuOpen(false)
                        }}
                      >
                        Refresh selected
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          {bulkMessage && (
            <p className="text-sm text-gray-600 px-2">{bulkMessage}</p>
          )}
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full bg-white divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3">
                    <input type="checkbox" checked={selectAll} onChange={toggleSelectAll} />
                  </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Thumbnail
                </th>
                  <SortableHeader
                    label="Product"
                    sortKey="standard_name"
                    currentSort={sortBy}
                    currentOrder={sortOrder}
                    onSort={handleSortChange}
                  />
                  <SortableHeader
                    label="Vendor"
                    sortKey="vendor_name"
                    currentSort={sortBy}
                    currentOrder={sortOrder}
                    onSort={handleSortChange}
                  />
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Category
                  </th>
                  <SortableHeader
                    label="Price"
                    sortKey="price_bdt"
                    currentSort={sortBy}
                    currentOrder={sortOrder}
                    onSort={handleSortChange}
                  />
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <SortableHeader
                    label="Updated"
                    sortKey="updated_at"
                    currentSort={sortBy}
                    currentOrder={sortOrder}
                    onSort={handleSortChange}
                  />
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    More
                  </th>
                </tr>
                {/* Filter Row */}
                <tr className="bg-gray-100">
                  <td className="px-4 py-2"></td>
                  <td className="px-4 py-2"></td>
                  <td className="px-4 py-2">
                    <input
                      type="text"
                      placeholder="Filter product..."
                      value={columnFilters.product}
                      onChange={(e) => setColumnFilters((prev) => ({ ...prev, product: e.target.value }))}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-purple-500"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="text"
                      placeholder="Filter vendor..."
                      value={columnFilters.vendor}
                      onChange={(e) => setColumnFilters((prev) => ({ ...prev, vendor: e.target.value }))}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-purple-500"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="text"
                      placeholder="Filter category..."
                      value={columnFilters.category}
                      onChange={(e) => setColumnFilters((prev) => ({ ...prev, category: e.target.value }))}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-purple-500"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="text"
                      placeholder="Filter price..."
                      value={columnFilters.price}
                      onChange={(e) => setColumnFilters((prev) => ({ ...prev, price: e.target.value }))}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-purple-500"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="text"
                      placeholder="Filter status..."
                      value={columnFilters.status}
                      onChange={(e) => setColumnFilters((prev) => ({ ...prev, status: e.target.value }))}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-purple-500"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="text"
                      placeholder="Filter updated..."
                      value={columnFilters.updated}
                      onChange={(e) => setColumnFilters((prev) => ({ ...prev, updated: e.target.value }))}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-purple-500"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </td>
                  <td className="px-4 py-2"></td>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-6 text-center text-gray-500">
                      Loading...
                    </td>
                  </tr>
                ) : products.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-6 text-center text-gray-500">
                      No products found.
                    </td>
                  </tr>
                ) : (
                  products.map((product, index) => {
                    // Use a unique key combining index and id to handle potential duplicates
                    const menuKey = `${index}-${product.id}`
                    return (
                  <tr
                    key={menuKey}
                    className={`hover:bg-purple-50 transition-colors ${
                      selectedIds.has(product.id) ? 'bg-purple-100' : ''
                    }`}
                    onClick={(e) => {
                      // Close any open menu when clicking on a row (but not on the menu button)
                      const target = e.target as Element
                      const isMenuButton = target.closest('button') || target.closest('.relative')
                      if (openMenuId !== null && !isMenuButton) {
                        setOpenMenuId(null)
                      }
                    }}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(product.id)}
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleRow(product.id)
                        }}
                        onChange={() => {}}
                      />
                    </td>
                    <td className="px-4 py-3">
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.standard_name}
                          className="h-10 w-10 object-cover rounded"
                        />
                      ) : (
                        <div className="h-10 w-10 bg-gray-100 rounded flex items-center justify-center text-xs text-gray-500">
                          N/A
                        </div>
                      )}
                    </td>
                    <td 
                      className="px-4 py-3 text-sm text-gray-900 cursor-pointer"
                      onClick={() => router.push(`/admin/products/${product.id}`)}
                    >
                      {product.standard_name}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{product.vendor_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{product.category}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-green-600">
                      {new Intl.NumberFormat('en-BD', { style: 'decimal' }).format(
                        product.price_bdt
                      )}{' '}
                      BDT
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className="text-xs uppercase tracking-wide text-gray-500">
                        {product.availability_status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{product.updated_at}</td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="relative" ref={(el) => { menuRefs.current[menuKey] = el }}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setOpenMenuId(openMenuId === menuKey ? null : menuKey)
                          }}
                          className="p-1 hover:bg-gray-200 rounded transition-colors"
                        >
                          <MoreVertical className="w-5 h-5 text-gray-600" />
                        </button>
                        {openMenuId === menuKey ? (
                          <div 
                            className="absolute right-0 mt-1 w-40 bg-white border border-gray-200 rounded-lg shadow-lg z-50"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {hasPermission('products.edit') && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setOpenMenuId(null)
                                  handleProductAction(product.id, 'edit')
                                }}
                                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 transition-colors"
                              >
                                <Edit className="w-4 h-4" />
                                Edit
                              </button>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setOpenMenuId(null)
                                handleProductAction(product.id, 'update')
                              }}
                              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-purple-600 hover:bg-purple-50 transition-colors"
                            >
                              <RefreshCw className="w-4 h-4" />
                              Update
                            </button>
                            {hasPermission('products.delete') && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setOpenMenuId(null)
                                  handleProductAction(product.id, 'delete')
                                }}
                                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                                Delete
                              </button>
                            )}
                          </div>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {pagination && (
          <div className="flex items-center justify-between text-sm text-gray-600">
            <div>
              Page {pagination.page} of {pagination.totalPages} ({pagination.total} products)
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={pagination.page <= 1}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                className="px-3 py-1 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <input
                type="number"
                min={1}
                max={pagination.totalPages}
                value={page}
                onChange={(e) => {
                  const value = Number(e.target.value)
                  if (value >= 1 && value <= pagination.totalPages) setPage(value)
                }}
                className="w-16 px-3 py-1 border rounded-lg text-center"
              />
              <button
                disabled={pagination.page >= pagination.totalPages}
                onClick={() =>
                  setPage((prev) => Math.min(pagination.totalPages, prev + 1))
                }
                className="px-3 py-1 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function SortableHeader({
  label,
  sortKey,
  currentSort,
  currentOrder,
  onSort,
}: {
  label: string
  sortKey: string
  currentSort: string
  currentOrder: 'ASC' | 'DESC'
  onSort: (column: string) => void
}) {
  const isActive = currentSort === sortKey
  return (
    <th
      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
      onClick={() => onSort(sortKey)}
    >
      <div className="flex items-center gap-1">
        <span>{label}</span>
        <span className="text-xs">
          {isActive ? (currentOrder === 'ASC' ? '↑' : '↓') : '↕'}
        </span>
      </div>
    </th>
  )
}

