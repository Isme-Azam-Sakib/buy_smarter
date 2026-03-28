import { NextResponse } from 'next/server'
import { getDatabase } from '@/lib/database'
import type { CPUProduct } from '@/lib/types'

interface RawProduct {
  id: string
  standard_name: string
  brand: string
  vendor_name: string
  raw_name: string
  price_bdt: number
  availability_status: string
  product_url: string
  image_url: string | null
  scraped_at: string
  description: string | null
}

export async function GET(
  request: Request,
  { params }: { params: { category: string; id: string } }
) {
  const category = decodeURIComponent(params.category)
  const productId = decodeURIComponent(params.id)

  try {
    const db = await getDatabase()
    const likeToken = productId.split(' ').slice(0, 2).join(' ')
    const rows = await db.query(
      `
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
          scraped_at,
          description
        FROM all_products
        WHERE category = $1
          AND price_bdt IS NOT NULL
          AND price_bdt > 0
          AND (
            standard_name = $2
            OR standard_name LIKE $3
            OR raw_name LIKE $3
          )
        ORDER BY price_bdt ASC
        LIMIT 200
      `,
      [category, productId, `%${likeToken}%`]
    )
    await db.close()

    if (!rows.length) {
      return NextResponse.json({ error: 'No data for AI grouping' }, { status: 404 })
    }

    const grouped = groupProductsByAI(rows as RawProduct[], category)
    const aiProduct =
      grouped.find(
        (item) => item.standard_name.toLowerCase() === productId.toLowerCase()
      ) || grouped[0]

    return NextResponse.json({ product: aiProduct })
  } catch (error) {
    console.error('AI regroup error', error)
    return NextResponse.json({ error: 'Failed to run AI grouping' }, { status: 500 })
  }
}

function groupProductsByAI(products: RawProduct[], category: string): CPUProduct[] {
  const grouped: Record<string, CPUProduct> = {}

  for (const product of products) {
    const key = product.standard_name || product.raw_name.split(' ').slice(0, 4).join(' ')
    if (!grouped[key]) {
      grouped[key] = {
        id: key,
        standard_name: key,
        brand: product.brand || extractBrand(key),
        min_price: product.price_bdt,
        max_price: product.price_bdt,
        avg_price: product.price_bdt,
        vendor_count: 0,
        total_listings: 0,
        vendors: [],
        images: [],
        price_entries: [],
      }
    }
    const entry = grouped[key]
    entry.min_price = Math.min(entry.min_price, product.price_bdt)
    entry.max_price = Math.max(entry.max_price, product.price_bdt)
    entry.total_listings += 1
    entry.vendors = Array.from(new Set([...entry.vendors, product.vendor_name]))
    entry.vendor_count = entry.vendors.length
    if (product.image_url) {
      entry.images = Array.from(new Set([...entry.images, product.image_url]))
    }
    entry.price_entries.push({
      id: product.id,
      vendor_name: product.vendor_name,
      raw_name: product.raw_name,
      price_bdt: product.price_bdt,
      availability_status: product.availability_status,
      product_url: product.product_url,
      image_url: product.image_url,
      scraped_at: product.scraped_at,
      description: product.description,
    })
  }

  return Object.values(grouped).map((product) => ({
    ...product,
    avg_price:
      product.price_entries.reduce((sum, entry) => sum + entry.price_bdt, 0) /
      product.price_entries.length,
  }))
}

function extractBrand(name: string) {
  const lower = name.toLowerCase()
  if (lower.includes('intel')) return 'Intel'
  if (lower.includes('amd') || lower.includes('ryzen')) return 'AMD'
  if (lower.includes('sapphire')) return 'Sapphire'
  if (lower.includes('asus')) return 'ASUS'
  if (lower.includes('msi')) return 'MSI'
  if (lower.includes('gigabyte')) return 'Gigabyte'
  if (lower.includes('corsair')) return 'Corsair'
  return 'Unknown'
}

