import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="md:col-span-1">
            <div className="flex items-center mb-4">
              <div className="h-8 w-8 bg-primary-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">B</span>
              </div>
              <span className="ml-2 text-xl font-bold">BuySmarter</span>
            </div>
            <p className="text-gray-400 text-sm">
              Find the cheapest PC parts across Bangladesh. Compare prices from major retailers and build your dream PC.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-semibold text-white mb-4">Quick Links</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/" className="text-gray-400 hover:text-white text-sm">
                  Home
                </Link>
              </li>
              <li>
                <Link href="/compare" className="text-gray-400 hover:text-white text-sm">
                  Price Comparison
                </Link>
              </li>
              <li>
                <Link href="/builder" className="text-gray-400 hover:text-white text-sm">
                  PC Builder
                </Link>
              </li>
              <li>
                <Link href="/categories" className="text-gray-400 hover:text-white text-sm">
                  Categories
                </Link>
              </li>
            </ul>
          </div>

          {/* Categories */}
          <div>
            <h3 className="font-semibold text-white mb-4">Categories</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/categories/cpu" className="text-gray-400 hover:text-white text-sm">
                  CPU
                </Link>
              </li>
              <li>
                <Link href="/categories/gpu" className="text-gray-400 hover:text-white text-sm">
                  GPU
                </Link>
              </li>
              <li>
                <Link href="/categories/ram" className="text-gray-400 hover:text-white text-sm">
                  RAM
                </Link>
              </li>
              <li>
                <Link href="/categories/motherboard" className="text-gray-400 hover:text-white text-sm">
                  Motherboard
                </Link>
              </li>
              <li>
                <Link href="/categories/storage" className="text-gray-400 hover:text-white text-sm">
                  Storage
                </Link>
              </li>
            </ul>
          </div>

          {/* Vendors */}
          <div>
            <h3 className="font-semibold text-white mb-4">Our Partners</h3>
            <ul className="space-y-2">
              <li>
                <a href="https://www.startech.com.bd/" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white text-sm">
                  Star Tech
                </a>
              </li>
              <li>
                <a href="https://www.ryans.com/" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white text-sm">
                  Ryans
                </a>
              </li>
              <li>
                <a href="https://www.techlandbd.com/" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white text-sm">
                  TechLand BD
                </a>
              </li>
              <li>
                <a href="https://www.skyland.com.bd/" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white text-sm">
                  Skyland
                </a>
              </li>
              <li>
                <a href="https://www.pchouse.com.bd/" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white text-sm">
                  PC House
                </a>
              </li>
              <li>
                <a href="https://www.ultratech.com.bd/" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white text-sm">
                  Ultra Tech
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-8 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-gray-400 text-sm">
              © 2024 BuySmarter. All rights reserved.
            </p>
            <div className="flex space-x-6 mt-4 md:mt-0">
              <Link href="/privacy" className="text-gray-400 hover:text-white text-sm">
                Privacy Policy
              </Link>
              <Link href="/terms" className="text-gray-400 hover:text-white text-sm">
                Terms of Service
              </Link>
              <Link href="/contact" className="text-gray-400 hover:text-white text-sm">
                Contact
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
