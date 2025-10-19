import Header from '@/components/Header'
import Hero from '@/components/Hero'
import PriceComparison from '@/components/PriceComparison'
import PCBuilder from '@/components/PCBuilder'
import Footer from '@/components/Footer'

export default function Home() {
  return (
    <main className="min-h-screen">
      <Header />
      <Hero />
      <PriceComparison />
      <PCBuilder />
      <Footer />
    </main>
  )
}
