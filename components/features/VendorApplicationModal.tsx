'use client'

import { useState, useEffect } from 'react'
import { X, Loader2, CheckCircle2 } from 'lucide-react'
import { CustomInput } from '@/components/ui/CustomInput'

interface VendorApplication {
  id: number
  vendor_name: string
  website_url?: string
  email: string
  phone?: string
  contact_person?: string
  additional_details?: string
  status: 'pending' | 'approved' | 'rejected'
  submitted_at: string
}

interface VendorApplicationModalProps {
  isOpen: boolean
  onClose: () => void
  initialData?: Partial<Omit<VendorApplication, 'id' | 'status' | 'submitted_at'>>
  onSubmitted?: (application: VendorApplication) => void
}

export default function VendorApplicationModal({
  isOpen,
  onClose,
  initialData,
  onSubmitted,
}: VendorApplicationModalProps) {
  const [formData, setFormData] = useState({
    vendor_name: '',
    website_url: '',
    email: '',
    phone: '',
    contact_person: '',
    additional_details: '',
  })
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (initialData) {
      setFormData((prev) => ({
        ...prev,
        ...initialData,
      }))
    }
  }, [initialData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch('/api/vendor/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to submit application')
        setLoading(false)
        return
      }

      if (data.application) {
        onSubmitted?.(data.application as VendorApplication)
      }

      setSuccess(true)
      setLoading(false)
      // Reset form
      setFormData({
        vendor_name: '',
        website_url: '',
        email: '',
        phone: '',
        contact_person: '',
        additional_details: '',
      })

      // Close modal after 2 seconds
      setTimeout(() => {
        setSuccess(false)
        onClose()
      }, 2000)
    } catch (err: any) {
      setError('An error occurred. Please try again.')
      setLoading(false)
    }
  }

  const handleFieldChange = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">
            Become a Vendor
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            disabled={loading}
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {success ? (
            <div className="text-center py-8">
              <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Application Submitted!
              </h3>
              <p className="text-gray-600">
                Thank you for your interest. We&apos;ll review your application and
                get back to you soon.
              </p>
            </div>
          ) : (
            <>
              <p className="text-gray-600 mb-6">
                Fill out the form below to apply as a vendor on BuySmarter. Our
                team will review your application and contact you shortly.
              </p>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <CustomInput
                    id="vendor_name"
                    name="vendor_name"
                    type="text"
                    required
                    value={formData.vendor_name}
                    onChange={(value) => handleFieldChange('vendor_name', value)}
                    placeholder="e.g., TechLand, StarTech"
                    label="Website / Store Name"
                  />
                </div>

                <div>
                  <CustomInput
                    id="website_url"
                    name="website_url"
                    type="url"
                    required
                    value={formData.website_url}
                    onChange={(value) => handleFieldChange('website_url', value)}
                    placeholder="https://example.com"
                    label="Website URL"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <CustomInput
                      id="email"
                      name="email"
                      type="email"
                      required
                      value={formData.email}
                      onChange={(value) => handleFieldChange('email', value)}
                      placeholder="contact@example.com"
                      label="Email"
                    />
                  </div>

                  <div>
                    <CustomInput
                      id="phone"
                      name="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(value) => handleFieldChange('phone', value)}
                      placeholder="+880 1234 567890"
                      label="Phone Number"
                    />
                  </div>
                </div>

                <div>
                  <CustomInput
                    id="contact_person"
                    name="contact_person"
                    type="text"
                    value={formData.contact_person}
                    onChange={(value) => handleFieldChange('contact_person', value)}
                    placeholder="John Doe"
                    label="Contact Person Name"
                  />
                </div>

                <div>
                  <label
                    htmlFor="additional_details"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Additional Details
                  </label>
                  <textarea
                    id="additional_details"
                    name="additional_details"
                    rows={4}
                    value={formData.additional_details}
                    onChange={(e) => handleFieldChange('additional_details', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Tell us about your business, product categories, or any other relevant information..."
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={loading}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      'Submit Application'
                    )}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

