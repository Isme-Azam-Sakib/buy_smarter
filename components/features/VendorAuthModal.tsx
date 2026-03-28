'use client'

import VendorAuthForm from '@/components/vendor/VendorAuthForm'
import { X } from 'lucide-react'

interface VendorAuthModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function VendorAuthModal({ isOpen, onClose }: VendorAuthModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition"
        >
          <X className="h-6 w-6" />
        </button>
        <div className="grid grid-cols-1 lg:grid-cols-2">
          <div className="hidden lg:block bg-gradient-to-br from-purple-600 via-indigo-600 to-blue-600 text-white p-8">
            <h3 className="text-3xl font-bold mb-4">Sell with BuySmarter</h3>
            <p className="text-white/80 mb-6">
              Step one is setting up your vendor credentials. Once approved you&apos;ll
              unlock tools to publish products and track performance.
            </p>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <span className="mt-1 h-2 w-2 rounded-full bg-white"></span>
                <p>Track your application status in real-time.</p>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1 h-2 w-2 rounded-full bg-white"></span>
                <p>Submit detailed store info from your dashboard after signing in.</p>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1 h-2 w-2 rounded-full bg-white"></span>
                <p>Unlock vendor-only tools once your store is approved.</p>
              </li>
            </ul>
          </div>
          <div className="p-6 flex items-center justify-center">
            <VendorAuthForm onClose={onClose} />
          </div>
        </div>
      </div>
    </div>
  )
}

