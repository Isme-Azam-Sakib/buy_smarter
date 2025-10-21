'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Search, TrendingDown, Wrench, BarChart3, Package } from 'lucide-react'

export default function Hero() {
  const [searchQuery, setSearchQuery] = useState('')

  const features = [
    {
      icon: TrendingDown,
      title: 'AI-Powered Search',
      description: 'Find CPUs using natural language with our trained AI model'
    },
    {
      icon: Wrench,
      title: 'Price Comparison',
      description: 'Compare prices across multiple vendors in Bangladesh'
    },
    {
      icon: BarChart3,
      title: 'Smart Recognition',
      description: 'Automatically identify and standardize CPU product names'
    }
  ]

  return (
    <section className="bg-gradient-to-br from-primary-50 to-primary-100 py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
            Find the <span className="text-primary-600">Best CPU Deals</span>
            <br />
            with AI-Powered Search
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Compare CPU prices from Star Tech, Ryans, TechLand BD, and more. 
            Use our advanced AI model to identify and find the perfect processor for your build.
          </p>

          {/* Search Bar */}
          <div className="max-w-2xl mx-auto mb-8">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className="h-6 w-6 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search for Intel Core i5, AMD Ryzen 7, etc..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block w-full pl-12 pr-4 py-4 text-lg border border-gray-300 rounded-xl leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 shadow-lg"
              />
              <button className="absolute inset-y-0 right-0 px-6 py-2 bg-primary-600 text-white font-medium rounded-r-xl hover:bg-primary-700 transition-colors">
                Search
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Link 
              href="/products"
              className="inline-flex items-center px-8 py-4 bg-primary-600 text-white font-semibold rounded-xl hover:bg-primary-700 transition-colors shadow-lg"
            >
              <Package className="h-5 w-5 mr-2" />
              Browse All Products
            </Link>
            <Link 
              href="/builder"
              className="inline-flex items-center px-8 py-4 bg-white text-primary-600 font-semibold rounded-xl border-2 border-primary-600 hover:bg-primary-50 transition-colors shadow-lg"
            >
              <Wrench className="h-5 w-5 mr-2" />
              Build Your PC
            </Link>
          </div>

          {/* Features */}
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {features.map((feature, index) => (
              <div key={index} className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-600 text-white rounded-xl mb-4">
                  <feature.icon className="h-8 w-8" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {feature.title}
                </h3>
                <p className="text-gray-600">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
