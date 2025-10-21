import { NextResponse } from 'next/server'
import { getDatabase } from '@/lib/database'

// Type for raw database product
interface RawProduct {
  id: string
  standard_name: string
  brand: string
  vendor_name: string
  raw_name: string
  price_bdt: number
  availability_status: string
  product_url: string
  image_url: string
  description: string
  scraped_at: string
}

// Type for grouped product
interface GroupedProduct {
  id: string
  standard_name: string
  brand: string
  raw_names: string[]
  min_price: number
  max_price: number
  avg_price: number
  vendor_count: number
  total_listings: number
  vendors: string[]
  images: string[]
  price_entries: PriceEntry[]
  ai_confidence: number
}

interface PriceEntry {
  id: string
  vendor_name: string
  raw_name: string
  price_bdt: number
  availability_status: string
  product_url: string
  image_url: string
  scraped_at: string
  description: string
}

export async function GET(request: Request) {
  try {
    console.log('AI Products PG API called')
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const brand = searchParams.get('brand')
    const limit = parseInt(searchParams.get('limit') || '12')
    const page = parseInt(searchParams.get('page') || '1')
    const skip = (page - 1) * limit

    console.log('Connecting to database...')
    const db = await getDatabase()
    console.log('Database connected successfully')

    // Build WHERE clause
    let whereClause = 'WHERE 1=1'
    const params: any[] = []

    if (search) {
      // Always use ILIKE for PostgreSQL
      whereClause += ` AND (standard_name ILIKE $${params.length + 1} OR raw_name ILIKE $${params.length + 2} OR brand ILIKE $${params.length + 3})`
      const searchTerm = `%${search}%`
      params.push(searchTerm, searchTerm, searchTerm)
    }
    
    if (brand) {
      whereClause += ` AND brand = $${params.length + 1}`
      params.push(brand)
    }

    // Get all products first (for AI grouping simulation)
    const allProductsQuery = `
      SELECT 
        id,
        standard_name,
        brand,
        vendor_name,
        raw_name,
        price_bdt,
        availability_status,
        product_url,
        image_url,
        description,
        scraped_at
      FROM cpu_products 
      ${whereClause}
      AND price_bdt IS NOT NULL 
      AND price_bdt > 0
      ORDER BY raw_name ASC
    `

    console.log('Fetching products with query:', allProductsQuery)
    console.log('Query params:', params)
    const allProducts = await db.query(allProductsQuery, params)
    console.log('Fetched products count:', allProducts.length)
    
    // Debug: Show sample products and prices
    if (allProducts.length > 0) {
      console.log('Sample product prices:', allProducts.slice(0, 3).map((p: RawProduct) => ({ 
        name: p.raw_name, 
        price: p.price_bdt, 
        standard_name: p.standard_name 
      })))
    }

    // Simulate AI grouping by grouping similar products
    const groupedProducts = groupProductsByAI(allProducts)
    console.log('Grouped products count:', groupedProducts.length)

    // Apply search and brand filters to grouped products
    let filteredProducts = groupedProducts

    if (search) {
      filteredProducts = filteredProducts.filter(product => 
        product.standard_name.toLowerCase().includes(search.toLowerCase()) ||
        product.raw_names.some((name: string) => name.toLowerCase().includes(search.toLowerCase())) ||
        product.brand.toLowerCase().includes(search.toLowerCase())
      )
    }

    if (brand) {
      filteredProducts = filteredProducts.filter(product => 
        product.brand.toLowerCase() === brand.toLowerCase()
      )
    }

    // Get unique brands for filter
    const uniqueBrands = Array.from(new Set(groupedProducts.map(p => p.brand)))
    const brands = uniqueBrands.map(brand => ({
      brand,
      count: groupedProducts.filter(p => p.brand === brand).length
    }))

    // Apply pagination
    const total = filteredProducts.length
    const totalPages = Math.ceil(total / limit)
    const startIndex = (page - 1) * limit
    const paginatedProducts = filteredProducts.slice(startIndex, startIndex + limit)

    await db.close()

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
    console.error('Error fetching AI products:', error)
    return NextResponse.json(
      { error: 'Failed to fetch AI products' },
      { status: 500 }
    )
  }
}

// Simulate AI grouping by grouping products with similar names
function groupProductsByAI(products: RawProduct[]): GroupedProduct[] {
  const groupedProducts: { [key: string]: GroupedProduct } = {}
  
  for (const product of products) {
    // Better AI-like grouping: use standard_name if available, otherwise use first 4 words
    let standardName = product.standard_name
    if (!standardName || standardName.trim() === '') {
      const words = product.raw_name.split(' ').slice(0, 4).join(' ')
      standardName = words
    }
    
    if (!groupedProducts[standardName]) {
      groupedProducts[standardName] = {
        id: standardName,
        standard_name: standardName,
        brand: extractBrand(standardName),
        raw_names: [],
        min_price: product.price_bdt,
        max_price: product.price_bdt,
        avg_price: product.price_bdt,
        vendor_count: 0,
        total_listings: 0,
        vendors: [],
        images: [],
        price_entries: [],
        ai_confidence: 0.85 // Simulate AI confidence
      }
    }

    // Add to grouped product
    const grouped = groupedProducts[standardName]
    grouped.raw_names.push(product.raw_name)
    
    // Debug price calculation
    if (product.price_bdt && product.price_bdt > 0) {
      grouped.min_price = Math.min(grouped.min_price, product.price_bdt)
      grouped.max_price = Math.max(grouped.max_price, product.price_bdt)
    }
    
    grouped.vendor_count = new Set([...grouped.vendors, product.vendor_name]).size
    grouped.total_listings += 1
    grouped.vendors = Array.from(new Set([...grouped.vendors, product.vendor_name]))
    if (product.image_url) {
      grouped.images.push(product.image_url)
    }
    grouped.images = Array.from(new Set(grouped.images))
    grouped.price_entries.push({
      id: product.id,
      vendor_name: product.vendor_name,
      raw_name: product.raw_name,
      price_bdt: product.price_bdt,
      availability_status: product.availability_status,
      product_url: product.product_url,
      image_url: product.image_url,
      scraped_at: product.scraped_at,
      description: product.description
    })
  }

  // Calculate average prices and sort
  const result = Object.values(groupedProducts).map((product: GroupedProduct) => {
    product.avg_price = product.price_entries.reduce((sum: number, entry: PriceEntry) => sum + entry.price_bdt, 0) / product.price_entries.length
    
    // Debug: Log price information
    console.log(`Product: ${product.standard_name}, Min: ${product.min_price}, Max: ${product.max_price}, Avg: ${product.avg_price}, Entries: ${product.price_entries.length}`)
    
    return product
  })

  // Sort by vendor count (descending) then by min price (ascending)
  return result.sort((a: GroupedProduct, b: GroupedProduct) => {
    if (b.vendor_count !== a.vendor_count) {
      return b.vendor_count - a.vendor_count
    }
    return a.min_price - b.min_price
  })
}

function extractBrand(standardName: string): string {
  if (standardName.toLowerCase().includes('intel')) return 'Intel'
  if (standardName.toLowerCase().includes('amd')) return 'AMD'
  if (standardName.toLowerCase().includes('ryzen')) return 'AMD'
  if (standardName.toLowerCase().includes('core')) return 'Intel'
  return 'Unknown'
}
