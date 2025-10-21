import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'BuySmarter - AI-Powered CPU Price Comparison Bangladesh',
  description: 'Compare CPU prices across multiple vendors in Bangladesh with our AI-powered product matching system. Find the best deals on Intel and AMD processors.',
  keywords: ['CPU', 'price comparison', 'Bangladesh', 'AI', 'computer hardware', 'Intel', 'AMD', 'processors'],
  authors: [{ name: 'BuySmarter Team' }],
  robots: 'index, follow',
  metadataBase: new URL('https://buysmarter.vercel.app'),
  openGraph: {
    title: 'BuySmarter - AI-Powered CPU Price Comparison',
    description: 'Compare CPU prices across multiple vendors in Bangladesh with our AI-powered product matching system.',
    type: 'website',
    locale: 'en_US',
  },
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
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
