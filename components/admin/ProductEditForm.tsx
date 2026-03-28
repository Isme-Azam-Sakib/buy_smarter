'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CustomInput } from '@/components/ui/CustomInput'
import { Camera, X } from 'lucide-react'

interface ProductEditFormProps {
  id: number
  vendor_name: string
  category: string | null
  standard_name: string
  brand: string | null
  price_bdt: number | null
  availability_status: string | null
  product_url: string | null
  image_url: string | null
  description: string | null
}

export default function ProductEditForm({
  id,
  vendor_name,
  category,
  standard_name,
  brand,
  price_bdt,
  availability_status,
  product_url,
  image_url,
  description,
}: ProductEditFormProps) {
  const router = useRouter()
  const [form, setForm] = useState({
    vendor_name,
    category: category || '',
    standard_name,
    brand: brand || '',
    price_bdt: price_bdt ?? 0,
    availability_status: availability_status || 'in_stock',
    product_url: product_url || '',
    image_url: image_url || '',
    description: description || '',
  })
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [imagePreview, setImagePreview] = useState(image_url || '')
  const [showImageModal, setShowImageModal] = useState(false)

  const applyImage = (value: string) => {
    setImagePreview(value)
    setForm((prev) => ({ ...prev, image_url: value }))
    setShowImageModal(false)
  }

  const readFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setMessage('Please select an image file')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const data = reader.result as string
      applyImage(data)
    }
    reader.onerror = () => {
      setMessage('Failed to read image file')
    }
    reader.readAsDataURL(file)
  }

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault()
    if (event.dataTransfer.files.length) {
      readFile(event.dataTransfer.files[0])
    }
  }

  const handlePaste = (event: React.ClipboardEvent) => {
    const items = event.clipboardData.items
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile()
        if (file) {
          readFile(file)
        }
        break
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage('')
    setSaving(true)
    try {
      // Prepare the payload, converting empty strings to null for optional fields
      const payload = {
        vendor_name: form.vendor_name || null,
        category: form.category || null,
        standard_name: form.standard_name || null,
        brand: form.brand || null,
        price_bdt: form.price_bdt ? Number(form.price_bdt) : null,
        availability_status: form.availability_status || null,
        product_url: form.product_url || null,
        image_url: form.image_url || null,
        description: form.description || null,
      }
      
      console.log('Submitting form data:', payload)
      
      const response = await fetch(`/api/admin/products/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      
      const data = await response.json()
      console.log('Response:', data)
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to save changes')
      }
      setMessage('Product updated successfully')
      setTimeout(() => {
        router.refresh()
      }, 500)
    } catch (error: any) {
      console.error('Save error:', error)
      setMessage(error.message || 'An error occurred while saving')
    } finally {
      setSaving(false)
    }
  }

  const ImageUploadArea = ({ onClose }: { onClose?: () => void }) => (
    <div
      className="relative border-2 border-dashed border-gray-300 rounded-xl p-12 text-center cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors"
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      onPaste={handlePaste}
    >
      <input
        type="file"
        accept="image/*"
        className="absolute inset-0 opacity-0 cursor-pointer"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) readFile(file)
        }}
      />
      <div className="space-y-3">
        <div className="flex justify-center">
          <Camera className="w-12 h-12 text-purple-600" />
        </div>
        <p className="text-sm font-medium text-purple-600">Browse or Drop or paste</p>
        <p className="text-xs text-gray-500">Click to browse, drag & drop, or paste from clipboard</p>
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="absolute top-2 right-2 p-1 rounded-full bg-gray-200 hover:bg-gray-300 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Image Upload Section */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6">
        {imagePreview ? (
          <div className="relative group">
            <img
              src={imagePreview}
              alt="Product"
              className="w-full h-64 object-contain rounded-xl bg-gray-50"
            />
            <button
              type="button"
              onClick={() => setShowImageModal(true)}
              className="absolute top-4 right-4 p-2 bg-white rounded-full shadow-lg hover:bg-gray-50 transition-colors opacity-0 group-hover:opacity-100"
            >
              <Camera className="w-5 h-5 text-gray-700" />
            </button>
          </div>
        ) : (
          <ImageUploadArea />
        )}
      </div>

      {/* Edit Form */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-gray-400">Edit mode</p>
            <h2 className="text-2xl font-semibold text-gray-900">Update product details</h2>
          </div>
          <span className="px-3 py-1 text-xs font-semibold text-purple-700 bg-purple-50 rounded-full">
            live edit
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <CustomInput
                placeholder="Vendor"
                value={form.vendor_name}
                onChange={(value) => setForm((prev) => ({ ...prev, vendor_name: value }))}
              />
              <CustomInput
                placeholder="Category"
                value={form.category}
                onChange={(value) => setForm((prev) => ({ ...prev, category: value }))}
              />
              <CustomInput
                placeholder="Brand"
                value={form.brand}
                onChange={(value) => setForm((prev) => ({ ...prev, brand: value }))}
              />
            </div>
            <CustomInput
              placeholder="Standard name"
              value={form.standard_name}
              onChange={(value) => setForm((prev) => ({ ...prev, standard_name: value }))}
            />
          </section>

          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Pricing & stock</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <input
                type="number"
                placeholder="Price (BDT)"
                value={form.price_bdt !== null && form.price_bdt !== 0 ? form.price_bdt : ''}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, price_bdt: e.target.value ? Number(e.target.value) : 0 }))
                }
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <select
                className="px-4 py-3 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                value={form.availability_status}
                onChange={(e) => setForm((prev) => ({ ...prev, availability_status: e.target.value }))}
              >
                <option value="in_stock">In Stock</option>
                <option value="limited">Limited Stock</option>
                <option value="out_of_stock">Out of Stock</option>
                <option value="pre_order">Pre-order</option>
                <option value="upcoming">Upcoming</option>
              </select>
              <CustomInput
                placeholder="Product URL"
                value={form.product_url}
                onChange={(value) => setForm((prev) => ({ ...prev, product_url: value }))}
              />
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Description</h3>
            <textarea
              placeholder="Product description"
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              rows={6}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-y"
            />
          </section>

          <div className="flex justify-end pt-4 border-t border-gray-200">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold"
            >
              {saving ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Saving...
                </>
              ) : (
                <>
                  <svg
                    className="w-4 h-4"
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
                  Save Changes
                </>
              )}
            </button>
          </div>
        </form>

        {message && (
          <div
            className={`mt-4 p-3 rounded-lg text-sm ${
              message.includes('success')
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}
          >
            {message}
          </div>
        )}
      </div>

      {/* Image Edit Modal */}
      {showImageModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowImageModal(false)}
        >
          <div
            className="bg-white rounded-2xl p-6 max-w-2xl w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Edit Product Image</h3>
              <button
                type="button"
                onClick={() => setShowImageModal(false)}
                className="p-1 rounded-full hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <ImageUploadArea onClose={() => setShowImageModal(false)} />
          </div>
        </div>
      )}
    </div>
  )
}
