'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Search, Menu, X, ShoppingCart, Wrench } from 'lucide-react'

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex-shrink-0">
            <Link href="/" className="flex items-center">
              <div className="h-8 w-8 bg-primary-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">B</span>
              </div>
              <span className="ml-2 text-xl font-bold text-gray-900">BuySmarter</span>
            </Link>
          </div>

          {/* Search Bar */}
          <div className="flex-1 max-w-lg mx-8 hidden md:block">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search for PC parts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>

          {/* Navigation */}
          <nav className="hidden md:flex space-x-8">
            <Link href="/" className="text-gray-700 hover:text-primary-600 px-3 py-2 text-sm font-medium">
              Home
            </Link>
            <Link href="/products" className="text-gray-700 hover:text-primary-600 px-3 py-2 text-sm font-medium">
              Products
            </Link>
            <Link href="/compare" className="text-gray-700 hover:text-primary-600 px-3 py-2 text-sm font-medium">
              Compare
            </Link>
            <Link href="/builder" className="text-gray-700 hover:text-primary-600 px-3 py-2 text-sm font-medium">
              PC Builder
            </Link>
            <Link href="/categories" className="text-gray-700 hover:text-primary-600 px-3 py-2 text-sm font-medium">
              Categories
            </Link>
          </nav>

          {/* Action Buttons */}
          <div className="flex items-center space-x-4">
            <button className="p-2 text-gray-400 hover:text-gray-500">
              <ShoppingCart className="h-6 w-6" />
            </button>
            <button className="p-2 text-gray-400 hover:text-gray-500">
              <Wrench className="h-6 w-6" />
            </button>
            
            {/* Mobile menu button */}
            <button
              className="md:hidden p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Search */}
        <div className="md:hidden pb-4">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search for PC parts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
        </div>

        {/* Mobile menu */}
        {isMenuOpen && (
          <div className="md:hidden">
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 bg-gray-50 rounded-lg mt-2">
              <Link href="/" className="text-gray-700 hover:text-primary-600 block px-3 py-2 text-base font-medium">
                Home
              </Link>
              <Link href="/products" className="text-gray-700 hover:text-primary-600 block px-3 py-2 text-base font-medium">
                Products
              </Link>
              <Link href="/compare" className="text-gray-700 hover:text-primary-600 block px-3 py-2 text-base font-medium">
                Compare
              </Link>
              <Link href="/builder" className="text-gray-700 hover:text-primary-600 block px-3 py-2 text-base font-medium">
                PC Builder
              </Link>
              <Link href="/categories" className="text-gray-700 hover:text-primary-600 block px-3 py-2 text-base font-medium">
                Categories
              </Link>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
