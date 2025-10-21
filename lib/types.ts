// Core product types
export interface CPUProduct {
  id: string
  standard_name: string
  brand: string
  min_price: number
  max_price: number
  avg_price: number
  vendor_count: number
  total_listings: number
  vendors: string[]
  images: string[]
  price_entries: PriceEntry[]
}

export interface PriceEntry {
  id: number
  vendor_name: string
  raw_name: string
  price_bdt: number
  availability_status: string
  product_url: string
  image_url: string
  scraped_at: string
  description: string
}

// API response types
export interface CPUProductsResponse {
  products: CPUProduct[]
  pagination: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
  stats: {
    brands: { brand: string; count: number }[]
  }
}

// Component prop types
export interface CPUProductsProps {
  searchQuery?: string
}
