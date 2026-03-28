export const dynamic = 'force-dynamic'
export const revalidate = 0

import Header from '@/components/ui/Header'
import Footer from '@/components/ui/Footer'
import CategoryProducts from '@/components/features/CategoryProducts'

interface CategoryPageProps {
  params: {
    category: string
  }
}

export default function CategoryPage({ params }: CategoryPageProps) {
  const category = decodeURIComponent(params.category)

  return (
    <main className="min-h-screen flex flex-col">
      <Header />
      <div className="flex-1 bg-white">
        <CategoryProducts initialCategory={category} />
      </div>
      <Footer />
    </main>
  )
}

