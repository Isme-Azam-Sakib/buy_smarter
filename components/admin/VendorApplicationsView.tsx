'use client'

import { useState, useEffect } from 'react'
import {
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  Mail,
  Phone,
  User,
  FileText,
  Loader2,
} from 'lucide-react'

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
  reviewed_at?: string
  reviewed_by?: number
  notes?: string
}

export default function VendorApplicationsView() {
  const [applications, setApplications] = useState<VendorApplication[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [processingId, setProcessingId] = useState<number | null>(null)
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')

  useEffect(() => {
    fetchApplications()
  }, [])

  const fetchApplications = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/vendor-applications')
      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to fetch applications')
        return
      }

      setApplications(data.applications || [])
    } catch (err: any) {
      setError('Failed to fetch applications')
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (id: number) => {
    if (!confirm('Are you sure you want to approve this vendor application?')) {
      return
    }

    try {
      setProcessingId(id)
      const response = await fetch(`/api/admin/vendor-applications/${id}/approve`, {
        method: 'POST',
      })

      const data = await response.json()

      if (!response.ok) {
        alert(data.error || 'Failed to approve application')
        return
      }

      alert('Application approved successfully!')
      fetchApplications()
    } catch (err: any) {
      alert('Failed to approve application')
    } finally {
      setProcessingId(null)
    }
  }

  const handleReject = async (id: number) => {
    const notes = prompt('Please provide a reason for rejection (optional):')
    if (notes === null) return // User cancelled

    try {
      setProcessingId(id)
      const response = await fetch(`/api/admin/vendor-applications/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      })

      const data = await response.json()

      if (!response.ok) {
        alert(data.error || 'Failed to reject application')
        return
      }

      alert('Application rejected')
      fetchApplications()
    } catch (err: any) {
      alert('Failed to reject application')
    } finally {
      setProcessingId(null)
    }
  }

  const getStatusBadge = (status: string) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      approved: 'bg-green-100 text-green-800 border-green-200',
      rejected: 'bg-red-100 text-red-800 border-red-200',
    }

    const icons = {
      pending: <Clock className="h-4 w-4" />,
      approved: <CheckCircle2 className="h-4 w-4" />,
      rejected: <XCircle className="h-4 w-4" />,
    }

    return (
      <span
        className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium border ${styles[status as keyof typeof styles]}`}
      >
        {icons[status as keyof typeof icons]}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    )
  }

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const filteredApplications = applications.filter((app) => {
    if (filter === 'all') return true
    return app.status === filter
  })

  const pendingCount = applications.filter((app) => app.status === 'pending').length

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 text-red-700 rounded-lg">
        {error}
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Vendor Applications</h1>
        <p className="text-gray-600">
          Review and manage vendor applications. {pendingCount > 0 && (
            <span className="font-semibold text-purple-600">
              {pendingCount} pending application{pendingCount !== 1 ? 's' : ''}
            </span>
          )}
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="mb-6 flex gap-2 border-b border-gray-200">
        {(['all', 'pending', 'approved', 'rejected'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 font-medium text-sm transition-colors ${
              filter === status
                ? 'text-purple-600 border-b-2 border-purple-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
            {status !== 'all' && (
              <span className="ml-2 px-2 py-0.5 bg-gray-100 rounded-full text-xs">
                {applications.filter((app) => app.status === status).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Applications List */}
      {filteredApplications.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">
            No {filter !== 'all' ? filter : ''} applications found.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredApplications.map((app) => (
            <div
              key={app.id}
              className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-semibold text-gray-900">
                      {app.vendor_name}
                    </h3>
                    {getStatusBadge(app.status)}
                  </div>
                  <p className="text-sm text-gray-500">
                    Submitted on {formatDate(app.submitted_at)}
                  </p>
                </div>
                {app.status === 'pending' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApprove(app.id)}
                      disabled={processingId === app.id}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2"
                    >
                      {processingId === app.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                      Approve
                    </button>
                    <button
                      onClick={() => handleReject(app.id)}
                      disabled={processingId === app.id}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2"
                    >
                      {processingId === app.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <XCircle className="h-4 w-4" />
                      )}
                      Reject
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="flex items-center gap-2 text-gray-700">
                  <ExternalLink className="h-4 w-4 text-gray-400" />
                  <a
                    href={app.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    {app.website_url}
                  </a>
                </div>
                <div className="flex items-center gap-2 text-gray-700">
                  <Mail className="h-4 w-4 text-gray-400" />
                  <a href={`mailto:${app.email}`} className="text-blue-600 hover:underline">
                    {app.email}
                  </a>
                </div>
                {app.phone && (
                  <div className="flex items-center gap-2 text-gray-700">
                    <Phone className="h-4 w-4 text-gray-400" />
                    <a href={`tel:${app.phone}`} className="text-blue-600 hover:underline">
                      {app.phone}
                    </a>
                  </div>
                )}
                {app.contact_person && (
                  <div className="flex items-center gap-2 text-gray-700">
                    <User className="h-4 w-4 text-gray-400" />
                    <span>{app.contact_person}</span>
                  </div>
                )}
              </div>

              {app.additional_details && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2">Additional Details</h4>
                  <p className="text-gray-700 whitespace-pre-wrap">{app.additional_details}</p>
                </div>
              )}

              {app.notes && (
                <div className="mt-4 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                  <h4 className="font-medium text-yellow-900 mb-2">Review Notes</h4>
                  <p className="text-yellow-800 whitespace-pre-wrap">{app.notes}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

