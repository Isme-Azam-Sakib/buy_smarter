'use client'

import { useState, useEffect } from 'react'
import VendorAuthModal from './VendorAuthModal'
import VendorApplicationModal from './VendorApplicationModal'
import { Store, TrendingUp, Users, ArrowRight, FileText } from 'lucide-react'

export default function VendorApplicationSection() {
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [showApplicationModal, setShowApplicationModal] = useState(false)
  const [isVendorLoggedIn, setIsVendorLoggedIn] = useState(false)
  const [vendorStatus, setVendorStatus] = useState<string | null>(null)
  const [currentApplication, setCurrentApplication] = useState<any>(null)

  useEffect(() => {
    // Check if user is logged in as vendor
    const checkVendorSession = async () => {
      try {
        const response = await fetch('/api/admin/auth/me')
        if (response.ok) {
          const data = await response.json()
          if (data.user && data.user.role === 'vendor') {
            setIsVendorLoggedIn(true)
            setVendorStatus(data.user.vendorStatus || null)
            
            // Fetch current application if logged in
            try {
              const appResponse = await fetch('/api/vendor/applications')
              if (appResponse.ok) {
                const appData = await appResponse.json()
                if (appData.application) {
                  setCurrentApplication(appData.application)
                }
              }
            } catch (error) {
              // No application yet or error fetching
            }
          }
        }
      } catch (error) {
        // Not logged in or error
        setIsVendorLoggedIn(false)
      }
    }
    checkVendorSession()
  }, [])

  return (
    <>
      <section className="bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Become a Vendor Partner
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Create your vendor account, submit an onboarding application, and unlock
              access to our comparison platform once approved.
            </p>
          </div>

          {/* Benefits Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
            <div className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="bg-purple-100 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                <Store className="h-6 w-6 text-purple-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Reach More Customers
              </h3>
              <p className="text-gray-600">
                Get your products in front of thousands of potential customers
                searching for the best deals.
              </p>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="bg-blue-100 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                <TrendingUp className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Boost Your Sales
              </h3>
              <p className="text-gray-600">
                Increase visibility and sales with our intelligent product
                matching and comparison features.
              </p>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="bg-indigo-100 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                <Users className="h-6 w-6 text-indigo-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Easy Management
              </h3>
              <p className="text-gray-600">
                Manage your products effortlessly with our intuitive vendor
                dashboard and tools.
              </p>
            </div>
          </div>

          {/* CTA Button */}
          <div className="text-center">
            {isVendorLoggedIn ? (
              <>
                <button
                  onClick={() => setShowApplicationModal(true)}
                  className="inline-flex items-center gap-2 px-8 py-4 bg-purple-600 text-white text-lg font-semibold rounded-lg hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
                >
                  <FileText className="h-5 w-5" />
                  Apply For Listing
                </button>
                {vendorStatus && (
                  <p className="mt-4 text-sm text-gray-500">
                    Application Status: <span className="font-semibold capitalize">{vendorStatus}</span>
                  </p>
                )}
              </>
            ) : (
              <>
                <button
                  onClick={() => setShowAuthModal(true)}
                  className="inline-flex items-center gap-2 px-8 py-4 bg-purple-600 text-white text-lg font-semibold rounded-lg hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
                >
                  Register / Sign In
                  <ArrowRight className="h-5 w-5" />
                </button>
                <p className="mt-4 text-sm text-gray-500">
                  Step 1: Create an account • Step 2: Submit your vendor application
                </p>
              </>
            )}
          </div>
        </div>
      </section>

      <VendorAuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onAuthSuccess={() => {
          setIsVendorLoggedIn(true)
          setShowApplicationModal(true)
        }}
        redirectPath="/"
      />
      
      <VendorApplicationModal
        isOpen={showApplicationModal}
        onClose={() => setShowApplicationModal(false)}
        initialData={currentApplication ? {
          vendor_name: currentApplication.vendor_name,
          website_url: currentApplication.website_url,
          email: currentApplication.email,
          phone: currentApplication.phone,
          contact_person: currentApplication.contact_person,
          additional_details: currentApplication.additional_details,
        } : undefined}
        onSubmitted={(app) => {
          setCurrentApplication(app)
          setShowApplicationModal(false)
          // Refresh to update status
          window.location.reload()
        }}
      />
    </>
  )
}

