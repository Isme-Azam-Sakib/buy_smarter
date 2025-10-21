import Header from '@/components/ui/Header'
import Hero from '@/components/ui/Hero'
import CPUProducts from '@/components/features/CPUProducts'
import AIProducts from '@/components/features/AIProducts'
import Footer from '@/components/ui/Footer'

export default function Home() {
  return (
    <main className="min-h-screen">
      <Header />
      <Hero />
      <CPUProducts />
      
      {/* AI-Powered Section Divider */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            AI-Powered Product Discovery
          </h2>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto">
            Experience intelligent product grouping powered by our custom machine learning model. 
            Products are automatically categorized and matched using advanced AI algorithms.
          </p>
        </div>
      </div>
      
      <AIProducts />
      <Footer />
    </main>
  )
}
