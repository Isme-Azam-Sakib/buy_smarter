'use client'

import { useState } from 'react'
import { X, Zap, RefreshCw, Clock, Info } from 'lucide-react'

export type PriceRefreshPreference = 'fast' | 'manual' | 'always'

interface PriceRefreshPreferenceModalProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (preference: PriceRefreshPreference) => void
}

export default function PriceRefreshPreferenceModal({
  isOpen,
  onClose,
  onSelect,
}: PriceRefreshPreferenceModalProps) {
  const [selectedPreference, setSelectedPreference] = useState<PriceRefreshPreference | null>(null)

  if (!isOpen) return null

  const preferences = [
    {
      id: 'fast' as PriceRefreshPreference,
      title: 'Fast Load (Cached Prices)',
      description: 'Load product instantly using cached price data. Prices may be slightly outdated but pages load quickly.',
      icon: Zap,
      pros: ['⚡ Instant page load', '🚀 Smooth browsing experience', '📊 Good for comparison shopping'],
      cons: ['⚠️ Prices may be outdated']
    },
    {
      id: 'manual' as PriceRefreshPreference,
      title: 'Manual Refresh (Recommended)',
      description: 'Load cached prices instantly, then refresh prices manually when you need the latest data.',
      icon: RefreshCw,
      pros: ['⚡ Fast initial load', '🔄 Refresh when you need it', '🎯 Best of both worlds'],
      cons: ['👆 Requires clicking refresh button']
    },
    {
      id: 'always' as PriceRefreshPreference,
      title: 'Always Fresh (Slower)',
      description: 'Always fetch the latest prices from all vendor websites. This takes longer but ensures you always see current prices.',
      icon: Clock,
      pros: ['✅ Always up-to-date prices', '🔄 Automatic refresh'],
      cons: ['⏳ Slower page loading (30-60s)', '🕐 Wait time per product page']
    },
  ]

  const handleSelect = (preference: PriceRefreshPreference) => {
    setSelectedPreference(preference)
  }

  const handleConfirm = () => {
    if (selectedPreference) {
      onSelect(selectedPreference)
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-60 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                Choose Your Price Refresh Preference
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Select how you want product prices to be updated during your browsing session
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">How it works:</p>
              <p>
                When you visit a product page, we can scrape prices from 5 different vendor websites. 
                This process can take 30-60 seconds. Choose your preferred balance between speed and data freshness.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {preferences.map((pref) => {
              const Icon = pref.icon
              const isSelected = selectedPreference === pref.id
              
              return (
                <button
                  key={pref.id}
                  onClick={() => handleSelect(pref.id)}
                  className={`text-left p-5 rounded-lg border-2 transition-all ${
                    isSelected
                      ? 'border-purple-600 bg-purple-50 shadow-lg'
                      : 'border-gray-200 hover:border-purple-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div className={`p-2 rounded-lg ${
                      isSelected ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600'
                    }`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 mb-1">{pref.title}</h3>
                      <p className="text-sm text-gray-600">{pref.description}</p>
                    </div>
                    {isSelected && (
                      <div className="w-5 h-5 rounded-full bg-purple-600 flex items-center justify-center flex-shrink-0">
                        <div className="w-2 h-2 rounded-full bg-white"></div>
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-2 mt-3">
                    {pref.pros.map((pro, idx) => (
                      <div key={idx} className="text-xs text-gray-700 flex items-start gap-1">
                        <span className="text-green-600 mt-0.5">•</span>
                        <span>{pro}</span>
                      </div>
                    ))}
                    {pref.cons.map((con, idx) => (
                      <div key={idx} className="text-xs text-gray-600 flex items-start gap-1">
                        <span className="text-orange-500 mt-0.5">•</span>
                        <span>{con}</span>
                      </div>
                    ))}
                  </div>
                </button>
              )
            })}
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              onClick={() => onSelect('fast')}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
            >
              Skip (Use Fast Mode)
            </button>
            <button
              onClick={handleConfirm}
              disabled={!selectedPreference}
              className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              Confirm Selection
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
