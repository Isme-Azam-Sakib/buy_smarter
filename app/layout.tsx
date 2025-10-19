import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'BuySmarter - PC Parts Price Comparison Bangladesh',
  description: 'Find the cheapest PC parts prices across Bangladesh. Compare prices from Star Tech, Ryans, TechLand BD, and more.',
  keywords: 'PC parts, Bangladesh, price comparison, computer hardware, CPU, GPU, RAM, motherboard',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="min-h-screen bg-gray-50">
          {children}
        </div>
      </body>
    </html>
  )
}
