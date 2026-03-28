'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X, ChevronDown, Cpu, Monitor, MemoryStick, HardDrive, CircuitBoard, Zap, Wind } from 'lucide-react'
import { CATEGORIES } from '@/lib/categories'

const iconMap: { [key: string]: any } = {
  Cpu,
  Monitor,
  MemoryStick,
  HardDrive,
  CircuitBoard,
  Zap,
  Wind
}

function getCategoryColorClass(color: string): string {
  const colorMap: { [key: string]: string } = {
    blue: 'text-blue-600',
    purple: 'text-purple-600',
    green: 'text-green-600',
    orange: 'text-orange-600',
    red: 'text-red-600',
    yellow: 'text-yellow-600',
    cyan: 'text-cyan-600'
  }
  return colorMap[color] || 'text-gray-600'
}

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isCategoriesOpen, setIsCategoriesOpen] = useState(false)
  const pathname = usePathname()
  const categoriesRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (categoriesRef.current && !categoriesRef.current.contains(event.target as Node)) {
        setIsCategoriesOpen(false)
      }
    }

    if (isCategoriesOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isCategoriesOpen])

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

          {/* Navigation - anchored right */}
          <div className="ml-auto flex items-center">
          <nav className="hidden md:flex space-x-8">
            <Link href="/" className="text-gray-700 hover:text-primary-600 px-3 py-2 text-sm font-medium">
              Home
            </Link>
            <Link href="/compare" className="text-gray-700 hover:text-primary-600 px-3 py-2 text-sm font-medium">
              Compare
            </Link>
            
            {/* Categories Dropdown */}
            <div className="relative" ref={categoriesRef}>
              <button
                onClick={() => setIsCategoriesOpen(!isCategoriesOpen)}
                className={`flex items-center text-gray-700 hover:text-primary-600 px-3 py-2 text-sm font-medium ${
                  pathname?.startsWith('/products/') ? 'text-primary-600' : ''
                }`}
              >
                Categories
                <ChevronDown className={`ml-1 h-4 w-4 transition-transform ${isCategoriesOpen ? 'rotate-180' : ''}`} />
              </button>
              
              {isCategoriesOpen && (
                <div className="absolute top-full left-0 mt-1 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                  {CATEGORIES.map((category) => {
                    const Icon = iconMap[category.icon] || Cpu
                    return (
                      <Link
                        key={category.id}
                        href={`/products/${category.id}`}
                        onClick={() => setIsCategoriesOpen(false)}
                        className="flex items-center px-4 py-3 hover:bg-gray-50 transition-colors"
                      >
                        <Icon className={`h-5 w-5 mr-3 ${getCategoryColorClass(category.color)}`} />
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900">{category.name}</div>
                          <div className="text-xs text-gray-500">{category.description}</div>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>

            <Link href="/builder" className="text-gray-700 hover:text-primary-600 px-3 py-2 text-sm font-medium">
              PC Builder
            </Link>
          </nav>

          {/* Mobile menu button */}
            <button
              className="md:hidden p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
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
              
              {/* Mobile Categories */}
              <div className="px-3 py-2">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Categories</div>
                <div className="space-y-1">
                  {CATEGORIES.map((category) => {
                    const Icon = iconMap[category.icon] || Cpu
                    return (
                      <Link
                        key={category.id}
                        href={`/products/${category.id}`}
                        onClick={() => setIsMenuOpen(false)}
                        className="flex items-center px-3 py-2 text-gray-700 hover:text-primary-600 hover:bg-gray-100 rounded-md text-sm"
                      >
                        <Icon className={`h-4 w-4 mr-2 ${getCategoryColorClass(category.color)}`} />
                        <span>{category.name}</span>
                      </Link>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
