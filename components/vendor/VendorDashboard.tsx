'use client'

import { useState, useEffect } from 'react'
import type { AdminSession } from '@/lib/admin-auth'
import VendorApplicationModal from '@/components/features/VendorApplicationModal'
import { CheckCircle2, Clock, FileText, Sparkles } from 'lucide-react'

type VendorApplication = {
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

interface VendorDashboardProps {
  session: AdminSession
  initialApplication: VendorApplication | null
  variant?: 'dashboard' | 'application'
}

const statusCopy: Record<
  string,
  { label: string; description: string; color: string; icon: JSX.Element }
> = {
  approved: {
    label: 'Approved',
    description: 'Your store is approved. Additional features will unlock soon.',
    color: 'text-green-600 bg-green-50 border-green-200',
    icon: <CheckCircle2 className="h-5 w-5" />,
  },
  rejected: {
    label: 'Rejected',
    description: 'Please review the feedback sent to your email and re-apply.',
    color: 'text-red-600 bg-red-50 border-red-200',
    icon: <FileText className="h-5 w-5" />,
  },
  pending: {
    label: 'Pending Review',
    description: 'Our team is reviewing your submission. You will be notified soon.',
    color: 'text-amber-600 bg-amber-50 border-amber-200',
    icon: <Clock className="h-5 w-5" />,
  },
  not_submitted: {
    label: 'No Application Yet',
    description: 'Submit your store information to start the approval process.',
    color: 'text-slate-600 bg-slate-50 border-slate-200',
    icon: <Sparkles className="h-5 w-5" />,
  },
}

export default function VendorDashboard({
  session,
  initialApplication,
  variant = 'dashboard',
}: VendorDashboardProps) {
  const [modalOpen, setModalOpen] = useState(false)
  const [application, setApplication] = useState(initialApplication)
  const [currentSession, setCurrentSession] = useState(session)

  // Refresh session status on mount to get latest vendor status
  useEffect(() => {
    const refreshSession = async () => {
      try {
        const response = await fetch('/api/admin/auth/me')
        if (response.ok) {
          const data = await response.json()
          if (data.user) {
            setCurrentSession(data.user)
          }
        }
      } catch (error) {
        console.error('Error refreshing session:', error)
      }
    }
    refreshSession()
  }, [])

  // Use refreshed session if available, otherwise use prop
  const activeSession = currentSession || session

  const currentStatus =
    statusCopy[activeSession.vendorStatus || application?.status || 'not_submitted']
  const isDashboard = variant === 'dashboard'

  return (
    <div className="max-w-5xl mx-auto py-10 px-4 lg:px-0">
      <div className="mb-8">
        <p className="text-sm font-semibold text-purple-600 uppercase tracking-wide">
          {isDashboard ? 'Vendor Portal' : 'Application Center'}
        </p>
        <h1 className="text-4xl font-bold text-gray-900 mt-2">
          {isDashboard ? `Welcome back, ${activeSession.username}` : 'Manage Your Vendor Application'}
        </h1>
        <p className="text-gray-500 mt-2">
          {isDashboard
            ? 'Track your application status and manage your vendor onboarding steps.'
            : 'Review your latest submission, update your details, and monitor approval progress.'}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <div
            className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-semibold border ${currentStatus.color}`}
          >
            {currentStatus.icon}
            {currentStatus.label}
          </div>
          <h2 className="text-2xl font-semibold text-gray-900 mt-4 mb-2">
            Application Status
          </h2>
          <p className="text-gray-600">{currentStatus.description}</p>
          <div className="mt-6 flex flex-wrap gap-4">
            {(activeSession.vendorStatus !== 'approved' || !application) && (
              <button
                onClick={() => setModalOpen(true)}
                className="px-6 py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition"
              >
                {application ? 'Update Application' : 'Submit Application'}
              </button>
            )}
            {activeSession.vendorStatus === 'approved' && application && (
              <div className="w-full p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-green-800 font-medium">
                  ✓ Your application has been approved! You now have access to vendor features.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Latest Submission
          </h3>
          {application ? (
            <div className="space-y-2 text-sm text-gray-600">
              <p>
                <span className="font-semibold text-gray-800">Submitted:</span>{' '}
                {new Date(application.submitted_at).toLocaleString()}
              </p>
              <p>
                <span className="font-semibold text-gray-800">Store:</span>{' '}
                {application.vendor_name}
              </p>
              <p>
                <span className="font-semibold text-gray-800">Website:</span>{' '}
                {application.website_url}
              </p>
              <p>
                <span className="font-semibold text-gray-800">Email:</span>{' '}
                {application.email}
              </p>
            </div>
          ) : (
            <p className="text-gray-500">
              You have not submitted any applications yet.
            </p>
          )}
        </div>
      </div>

      <VendorApplicationModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        initialData={
          application
            ? {
                vendor_name: application.vendor_name,
                website_url: application.website_url,
                email: application.email,
                phone: application.phone,
                contact_person: application.contact_person,
                additional_details: application.additional_details,
              }
            : undefined
        }
        onSubmitted={(app) => {
          setApplication({
            id: app.id,
            vendor_name: app.vendor_name,
            website_url: app.website_url,
            email: app.email,
            phone: app.phone,
            contact_person: app.contact_person,
            additional_details: app.additional_details,
            status: app.status,
            submitted_at: app.submitted_at,
          })
          setModalOpen(false)
          // Refresh the page to get updated status
          if (typeof window !== 'undefined') {
            window.location.reload()
          }
        }}
      />
    </div>
  )
}

