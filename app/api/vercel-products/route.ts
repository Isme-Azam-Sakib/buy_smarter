import { NextResponse } from 'next/server'

// Mock data for Vercel deployment (replace with external API)
const mockProducts = [
  {
    id: "Core i5 12400F",
    standard_name: "Core i5 12400F",
    brand: "Intel",
    min_price: 18500,
    max_price: 19500,
    avg_price: 19000,
    vendor_count: 3,
    total_listings: 5,
    vendors: ["Star Tech", "Techland BD", "PC House"],
    images: ["/assets/images.jpg"],
    price_entries: [
      {
        id: 1,
        vendor_name: "Star Tech",
        raw_name: "Intel Core i5 12400F Processor",
        price_bdt: 18500,
        availability_status: "in_stock",
        product_url: "https://www.startech.com.bd",
        image_url: "/assets/images.jpg",
        scraped_at: "2024-01-01",
        description: "Intel Core i5 12400F 6-Core 12-Thread Processor"
      }
    ]
  },
  {
    id: "Ryzen 5 5600",
    standard_name: "Ryzen 5 5600",
    brand: "AMD",
    min_price: 11200,
    max_price: 11500,
    avg_price: 11350,
    vendor_count: 4,
    total_listings: 6,
    vendors: ["Star Tech", "Techland BD", "PC House", "Ultra Technology"],
    images: ["/assets/images.jpg"],
    price_entries: [
      {
        id: 2,
        vendor_name: "Star Tech",
        raw_name: "AMD Ryzen 5 5600 Processor",
        price_bdt: 11200,
        availability_status: "in_stock",
        product_url: "https://www.startech.com.bd",
        image_url: "/assets/images.jpg",
        scraped_at: "2024-01-01",
        description: "AMD Ryzen 5 5600 6-Core 12-Thread Processor"
      }
    ]
  }
]

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '12')
    const search = searchParams.get('search') || ''
    const brand = searchParams.get('brand') || ''

    // Filter products
    let filteredProducts = mockProducts

    if (search) {
      filteredProducts = filteredProducts.filter(product => 
        product.standard_name.toLowerCase().includes(search.toLowerCase()) ||
        product.brand.toLowerCase().includes(search.toLowerCase())
      )
    }

    if (brand) {
      filteredProducts = filteredProducts.filter(product => 
        product.brand.toLowerCase() === brand.toLowerCase()
      )
    }

    // Pagination
    const total = filteredProducts.length
    const totalPages = Math.ceil(total / limit)
    const startIndex = (page - 1) * limit
    const endIndex = startIndex + limit
    const paginatedProducts = filteredProducts.slice(startIndex, endIndex)

    // Get brands
    const brands = [
      { brand: "Intel", count: 1 },
      { brand: "AMD", count: 1 }
    ]

    return NextResponse.json({
      products: paginatedProducts,
      pagination: {
        total,
        page,
        limit,
        totalPages
      },
      stats: {
        brands
      }
    })

  } catch (error) {
    console.error('Error in Vercel products API:', error)
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    )
  }
}
