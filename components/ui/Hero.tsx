'use client'

import { useState, FormEvent } from 'react'
import Link from 'next/link'
import { Search, Wrench, Package, Sparkles, Loader2 } from 'lucide-react'
import AnimatedPlaceholder from './AnimatedPlaceholder'
import SearchResults from './SearchResults'

const PLACEHOLDER_QUESTIONS = [
  'gaming PC under 50k taka',
  'best GPU under 30k',
  'editing PC under 200k',
  '30k er ashe pashe best processor',
  'cheapest graphics card available',
  'best RAM for gaming',
  'SSD under 10k',
  'gaming PC build 100k'
]

const PREDEFINED_QUESTIONS = [
  'Best gaming PC under 50k',
  'Best editing PC under 200k',
  'Cheapest GPU available',
  'Best processor under 30k'
]

export default function Hero() {
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<any>(null)
  const [executedQuery, setExecutedQuery] = useState('')

  const handleSearch = async (e?: FormEvent, customQuery?: string) => {
    e?.preventDefault()

    const queryToUse = (customQuery ?? searchQuery).trim()
    if (!queryToUse || isSearching) return

    setIsSearching(true)
    setSearchResults(null)
    setExecutedQuery(queryToUse)

    try {
      console.log('Searching for:', queryToUse)
      const response = await fetch('/api/search/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: queryToUse }),
      })

      console.log('Response status:', response.status)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('Search failed:', errorData)
        throw new Error(errorData.error || 'Search failed')
      }

      const data = await response.json()
      console.log('Search results:', data)
      setSearchResults(data)
    } catch (error) {
      console.error('Search error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Sorry, something went wrong. Please try again.'
      setSearchResults({
        type: 'error',
        error: errorMessage,
        message: errorMessage,
        details: 'Please check the console for more details or try again later.'
      })
    } finally {
      setIsSearching(false)
    }
  }

  const handlePredefinedQuestion = (question: string) => {
    setSearchQuery(question)
    // Trigger search immediately using the clicked question text
    handleSearch(undefined, question)
  }

  return (
    <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
      {/* Background with gradient overlay */}
      <div 
        className="absolute inset-0 bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900"
        style={{
          // Uncomment and add your background image URL here:
          // backgroundImage: 'url(/images/hero-bg.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      >
        {/* Dark overlay for better text readability */}
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/80 via-blue-900/80 to-indigo-900/80"></div>
        
        {/* Animated gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-purple-600/20 via-blue-600/20 to-indigo-600/20 animate-pulse"></div>
        
        {/* Geometric pattern overlay */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.1),transparent_50%)]"></div>
          <div className="absolute top-20 right-20 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 left-20 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"></div>
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 w-full">
        <div className="text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full text-white/90 text-sm font-medium mb-6">
            <Sparkles className="h-4 w-4" />
            Smart Price Comparison for Tech Products
          </div>

          {/* Main Heading */}
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold text-white mb-6 leading-tight">
            Find the{' '}
            <span className="bg-gradient-to-r from-yellow-300 via-pink-300 to-purple-300 bg-clip-text text-transparent">
              Best Deals
            </span>
            <br />
            on PC Parts
          </h1>

          {/* Subtitle */}
          <p className="text-xl md:text-2xl text-white/90 mb-12 max-w-3xl mx-auto leading-relaxed">
            Find the best deals on CPUs, GPUs, RAM, SSDs, and more from Star Tech, TechLand BD, and other trusted vendors.{' '}
            <span className="text-white font-semibold">
              Our AI-powered platform helps you compare prices and make informed purchasing decisions.
            </span>
          </p>

          {/* Search Bar with Glassmorphism - commented out */}
          <div className="max-w-3xl mx-auto mb-6">
            <form onSubmit={handleSearch}>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none z-10">
                  <Search className="h-6 w-6 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSearch(e)
                    }
                  }}
                  className="block w-full pl-14 pr-32 py-5 text-lg border border-white/20 rounded-2xl leading-5 bg-white/10 backdrop-blur-md placeholder-white/60 text-white focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-white/30 shadow-2xl transition-all"
                  disabled={isSearching}
                />
                {!searchQuery && (
                  <div className="absolute inset-y-0 left-14 right-32 flex items-center pointer-events-none">
                    <AnimatedPlaceholder
                      questions={PLACEHOLDER_QUESTIONS}
                      className="text-white/60"
                    />
                  </div>
                )}
                <button
                  type="submit"
                  disabled={isSearching || !searchQuery.trim()}
                  className="absolute inset-y-2 right-2 px-8 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold rounded-xl hover:from-purple-700 hover:to-blue-700 transition-all shadow-lg hover:shadow-xl transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center gap-2"
                >
                  {isSearching ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Searching...
                    </>
                  ) : (
                    'Search'
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Predefined Questions - commented out */}
          <div className="max-w-3xl mx-auto mb-10">
            <p className="text-white/80 text-sm mb-3 text-center">Try asking:</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {PREDEFINED_QUESTIONS.map((question, index) => (
                <button
                  key={index}
                  onClick={() => handlePredefinedQuestion(question)}
                  disabled={isSearching}
                  className="px-4 py-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full text-white/90 text-sm font-medium hover:bg-white/20 hover:border-white/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {question}
                </button>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Link 
              href="/products/processor"
              className="group inline-flex items-center px-8 py-4 bg-white text-purple-900 font-semibold rounded-xl hover:bg-gray-100 transition-all shadow-2xl hover:shadow-3xl transform hover:scale-105"
            >
              <Package className="h-5 w-5 mr-2 group-hover:rotate-12 transition-transform" />
              View All Products
            </Link>
            <Link 
              href="/builder"
              className="group inline-flex items-center px-8 py-4 bg-white/10 backdrop-blur-md text-white font-semibold rounded-xl border-2 border-white/30 hover:bg-white/20 transition-all shadow-2xl hover:shadow-3xl transform hover:scale-105"
            >
              <Wrench className="h-5 w-5 mr-2 group-hover:rotate-12 transition-transform" />
              Build Your PC
            </Link>
          </div>
        </div>
      </div>

      {/* Bottom wave separator */}
      <div className="absolute bottom-0 left-0 right-0">
        <svg
          className="w-full h-20 text-white"
          viewBox="0 0 1440 120"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="none"
        >
          <path
            d="M0 120L60 105C120 90 240 60 360 45C480 30 600 30 720 37.5C840 45 960 60 1080 67.5C1200 75 1320 75 1380 75L1440 75V120H1380C1320 120 1200 120 1080 120C960 120 840 120 720 120C600 120 480 120 360 120C240 120 120 120 60 120H0Z"
            fill="currentColor"
          />
        </svg>
      </div>

      {/* Search Results Modal */}
      {searchResults && (
        <SearchResults
          query={executedQuery}
          response={searchResults}
          onClose={() => setSearchResults(null)}
        />
      )}
    </section>
  )
}
