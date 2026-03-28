'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2, Search, ShieldAlert, ShieldCheck } from 'lucide-react'
import { CustomInput } from '@/components/ui/CustomInput'

type VendorRecord = {
  id: number
  vendor_name: string
  website_url?: string
  email: string
  phone?: string
  contact_person?: string
  status: string
  admin_user_id?: number
  admin_username?: string
  admin_email?: string
  permissions: string[]
  managed_vendor_name?: string
  created_at: string
}

const permissionOptions = [
  { key: 'products', label: 'Products (all product permissions)' },
  { key: 'products.list', label: 'Product List' },
  { key: 'products.manual', label: 'Manual Entry' },
  { key: 'products.edit', label: 'Edit Products' },
  { key: 'products.delete', label: 'Delete Products' },
  { key: 'analytics', label: 'Analytics' },
]

const statusOptions = ['pending', 'approved', 'rejected', 'suspended']

const emptyForm = {
  vendor_name: '',
  website_url: '',
  email: '',
  phone: '',
  contact_person: '',
  status: 'pending',
  adminUsername: '',
  permissions: [] as string[],
  managed_vendor_name: '',
}

export default function VendorManagementPanel() {
  const [vendors, setVendors] = useState<VendorRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [selectedVendor, setSelectedVendor] = useState<VendorRecord | null>(null)
  const [formData, setFormData] = useState(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const [productVendorNames, setProductVendorNames] = useState<string[]>([])

  useEffect(() => {
    fetchVendors()
    fetchProductVendorNames()
  }, [])

  const fetchProductVendorNames = async () => {
    try {
      const response = await fetch('/api/admin/vendors?productVendors=true')
      const data = await response.json()
      if (response.ok) {
        setProductVendorNames(data.vendorNames || [])
      }
    } catch (err) {
      console.error('Failed to fetch product vendor names:', err)
    }
  }

  const fetchVendors = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/vendors')
      const data = await response.json()
      if (!response.ok) {
        setError(data.error || 'Failed to fetch vendors')
        return
      }
      setVendors(data.vendors || [])
      setError('')
    } catch (err: any) {
      setError('Failed to fetch vendors')
    } finally {
      setLoading(false)
    }
  }

  const filteredVendors = useMemo(() => {
    return vendors.filter((vendor) => {
      const matchesSearch =
        vendor.vendor_name.toLowerCase().includes(search.toLowerCase()) ||
        vendor.email.toLowerCase().includes(search.toLowerCase()) ||
        (vendor.admin_username || '').toLowerCase().includes(search.toLowerCase())

      const matchesStatus = statusFilter === 'all' || vendor.status === statusFilter

      return matchesSearch && matchesStatus
    })
  }, [vendors, search, statusFilter])

  const openCreateModal = () => {
    setFormData(emptyForm)
    setIsEditing(false)
    setSelectedVendor(null)
    setModalOpen(true)
  }

  const openEditModal = (vendor: VendorRecord) => {
    setSelectedVendor(vendor)
    setFormData({
      vendor_name: vendor.vendor_name,
      website_url: vendor.website_url || '',
      email: vendor.email,
      phone: vendor.phone || '',
      contact_person: vendor.contact_person || '',
      status: vendor.status,
      adminUsername: vendor.admin_username || '',
      permissions: vendor.permissions || [],
      managed_vendor_name: vendor.managed_vendor_name || '',
    })
    setIsEditing(true)
    setModalOpen(true)
  }

  const handleDelete = async (vendor: VendorRecord) => {
    if (!confirm(`Delete ${vendor.vendor_name}? This cannot be undone.`)) {
      return
    }

    try {
      const response = await fetch(`/api/admin/vendors/${vendor.id}`, {
        method: 'DELETE',
      })
      const data = await response.json()
      if (!response.ok) {
        alert(data.error || 'Failed to delete vendor')
        return
      }
      fetchVendors()
    } catch (err) {
      alert('Failed to delete vendor')
    }
  }

  const handleResetPassword = async (vendor: VendorRecord) => {
    if (!vendor.admin_user_id) {
      alert('This vendor is not linked to an admin user.')
      return
    }

    const password = prompt('Enter a temporary password (min 6 chars):')
    if (!password) return
    if (password.length < 6) {
      alert('Password must be at least 6 characters.')
      return
    }

    try {
      const response = await fetch(`/api/admin/vendors/${vendor.id}/credentials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const data = await response.json()
      if (!response.ok) {
        alert(data.error || 'Failed to reset credentials')
        return
      }
      alert('Password reset successfully.')
    } catch (err) {
      alert('Failed to reset credentials')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      const endpoint = isEditing
        ? `/api/admin/vendors/${selectedVendor?.id}`
        : '/api/admin/vendors'
      const method = isEditing ? 'PATCH' : 'POST'
      const payload = {
        vendor_name: formData.vendor_name,
        website_url: formData.website_url,
        email: formData.email,
        phone: formData.phone,
        contact_person: formData.contact_person,
        status: formData.status,
        permissions: formData.permissions,
        managed_vendor_name: formData.managed_vendor_name || null,
        ...(isEditing ? {} : { adminUsername: formData.adminUsername || undefined }),
      }

      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await response.json()
      if (!response.ok) {
        alert(data.error || 'Failed to save vendor')
        setSubmitting(false)
        return
      }

      setModalOpen(false)
      fetchVendors()
    } catch (err) {
      alert('Failed to save vendor')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Vendor Management</h1>
          <p className="text-gray-600">
            Review, approve, and configure vendor accounts and permissions.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="inline-flex items-center justify-center px-4 py-2 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition"
        >
          Add Vendor
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="h-5 w-5 text-gray-400 absolute left-3 top-3" />
            <CustomInput
              placeholder="Search vendors..."
              value={search}
              onChange={(value) => setSearch(value)}
              className="w-full"
              inputClassName="pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              label=""
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            <option value="all">All statuses</option>
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 text-purple-600 animate-spin" />
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg">
          {error}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200 text-left text-sm font-semibold text-gray-600">
              <tr>
                <th className="px-4 py-3">Vendor</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Permissions</th>
                <th className="px-4 py-3">Vendor Store</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {filteredVendors.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    No vendors found.
                  </td>
                </tr>
              )}
              {filteredVendors.map((vendor) => (
                <tr key={vendor.id}>
                  <td className="px-4 py-4">
                    <p className="font-semibold text-gray-900">{vendor.vendor_name}</p>
                    <p className="text-gray-500 text-sm">{vendor.website_url || '—'}</p>
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${
                        vendor.status === 'approved'
                          ? 'bg-green-50 text-green-700'
                          : vendor.status === 'rejected'
                          ? 'bg-red-50 text-red-700'
                          : 'bg-yellow-50 text-yellow-700'
                      }`}
                    >
                      {vendor.status === 'approved' ? (
                        <ShieldCheck className="h-4 w-4" />
                      ) : (
                        <ShieldAlert className="h-4 w-4" />
                      )}
                      {vendor.status.charAt(0).toUpperCase() + vendor.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <p className="text-gray-900">{vendor.admin_username || '—'}</p>
                    <p className="text-gray-500">{vendor.email}</p>
                  </td>
                  <td className="px-4 py-4">
                    {vendor.permissions?.length ? (
                      <div className="flex flex-wrap gap-1">
                        {vendor.permissions.map((perm) => (
                          <span
                            key={perm}
                            className="px-2 py-0.5 text-xs rounded-full bg-purple-50 text-purple-700"
                          >
                            {perm}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-gray-400 text-sm">None</span>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-sm text-gray-900">
                      {vendor.managed_vendor_name || (
                        <span className="text-gray-400 italic">Not assigned</span>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEditModal(vendor)}
                        className="text-purple-600 hover:text-purple-800 font-semibold text-sm"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleResetPassword(vendor)}
                        className="text-gray-500 hover:text-gray-700 font-semibold text-sm"
                      >
                        Reset Password
                      </button>
                      <button
                        onClick={() => handleDelete(vendor)}
                        className="text-red-600 hover:text-red-800 font-semibold text-sm"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  {isEditing ? 'Edit Vendor' : 'Add Vendor'}
                </h2>
                <p className="text-gray-500 text-sm">
                  {isEditing
                    ? 'Update vendor profile and permissions.'
                    : 'Create a vendor profile manually and optionally link it to an existing vendor user.'}
                </p>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                
                  <CustomInput
                    placeholder="Vendor Name"
                    value={formData.vendor_name}
                    onChange={(value) => setFormData({ ...formData, vendor_name: value })}
                    className="w-full"
                    label=""
                  />
                </div>
                <div>
                  
                  <CustomInput
                    placeholder="Website"
                    value={formData.website_url}
                    onChange={(value) => setFormData({ ...formData, website_url: value })}
                    className="w-full"
                    label=""
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  
                  <CustomInput
                    placeholder="Email"
                    value={formData.email}
                    onChange={(value) => setFormData({ ...formData, email: value })}
                    className="w-full"
                    label=""
                    type="email"
                  />
                </div>
                <div>
                  
                  <CustomInput
                    placeholder="Phone"
                    value={formData.phone}
                    onChange={(value) => setFormData({ ...formData, phone: value })}
                    className="w-full"
                    label=""
                    type="tel"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  
                  <CustomInput
                    placeholder="Contact Person"
                    value={formData.contact_person}
                    onChange={(value) =>
                      setFormData({ ...formData, contact_person: value })
                    }
                    className="w-full"
                    label=""
                  />
                </div>
                <div>
                  
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    {statusOptions.map((status) => (
                      <option key={status} value={status}>
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {!isEditing && (
              <div>
                
                <CustomInput
                  placeholder="Existing vendor username"
                  value={formData.adminUsername}
                  onChange={(value) =>
                    setFormData({ ...formData, adminUsername: value })
                  }
                  className="w-full"
                  label=""
                />
              </div>
              )}

              <div>
                
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-3">
                    {permissionOptions.map((option) => (
                      <label key={option.key} className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={formData.permissions.includes(option.key)}
                          onChange={(e) => {
                            let next: string[]
                            if (e.target.checked) {
                              // If checking 'products', remove granular product permissions
                              if (option.key === 'products') {
                                next = [
                                  ...formData.permissions.filter(
                                    (p) => !p.startsWith('products.')
                                  ),
                                  option.key,
                                ]
                              } else if (option.key.startsWith('products.')) {
                                // If checking granular permission, remove 'products' if present
                                next = [
                                  ...formData.permissions.filter((p) => p !== 'products'),
                                  option.key,
                                ]
                              } else {
                                next = [...formData.permissions, option.key]
                              }
                            } else {
                              next = formData.permissions.filter((perm) => perm !== option.key)
                            }
                            setFormData({ ...formData, permissions: next })
                          }}
                        />
                        <span className="text-sm">{option.label}</span>
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Note: &quot;Products&quot; grants all product permissions. Individual permissions can be granted separately.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Vendor Store (Product Management)
                </label>
                <p className="text-xs text-gray-500 mb-2">
                  Assign this vendor user to manage products from a specific vendor store. They will only see/edit products from the selected vendor.
                </p>
                <select
                  value={formData.managed_vendor_name}
                  onChange={(e) =>
                    setFormData({ ...formData, managed_vendor_name: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="">Not assigned</option>
                  {productVendorNames.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Vendor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

