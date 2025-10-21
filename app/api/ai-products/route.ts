import { NextResponse } from 'next/server'
import { spawn } from 'child_process'
import path from 'path'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '12')
    const search = searchParams.get('search') || ''
    const brand = searchParams.get('brand') || ''

    // Get all products from database first
    const sqlite3 = require('sqlite3')
    const { open } = require('sqlite')
    const dbPath = path.join(process.cwd(), 'cpu_products.db')
    const db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })

    // Get all products with their raw names
    const allProductsQuery = `
      SELECT 
        id,
        vendor_name,
        raw_name,
        price_bdt,
        availability_status,
        product_url,
        image_url,
        description,
        scraped_at
      FROM cpu_products 
      WHERE price_bdt IS NOT NULL AND price_bdt > 0
      ORDER BY price_bdt ASC
    `

    const allProducts = await db.all(allProductsQuery, [])
    await db.close()

    // Use AI model to group products by standard names with fallback
    let aiGroupedProducts
    try {
      aiGroupedProducts = await Promise.race([
        groupProductsWithAI(allProducts as any[]),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('AI processing timeout')), 30000)
        )
      ]) as any[]
    } catch (error) {
      console.error('AI processing failed, using fallback grouping:', error)
      // Fallback: group by first few words of raw_name
      aiGroupedProducts = fallbackGroupProducts(allProducts as any[])
    }

    // Apply search and brand filters
    let filteredProducts = aiGroupedProducts

    if (search) {
      filteredProducts = filteredProducts.filter(product => 
        product.standard_name.toLowerCase().includes(search.toLowerCase()) ||
        product.raw_names.some((name: string) => 
          name.toLowerCase().includes(search.toLowerCase())
        )
      )
    }

    if (brand) {
      filteredProducts = filteredProducts.filter(product => 
        product.brand.toLowerCase() === brand.toLowerCase()
      )
    }

    // Get unique brands for filter
    const uniqueBrands = Array.from(new Set(aiGroupedProducts.map(p => p.brand)))
    const brands = uniqueBrands.map(brand => ({
      brand,
      count: aiGroupedProducts.filter(p => p.brand === brand).length
    }))

    // Apply pagination
    const total = filteredProducts.length
    const totalPages = Math.ceil(total / limit)
    const startIndex = (page - 1) * limit
    const endIndex = startIndex + limit
    const paginatedProducts = filteredProducts.slice(startIndex, endIndex)

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
    console.error('Error in AI products API:', error)
    return NextResponse.json(
      { error: 'Failed to fetch AI-grouped products' },
      { status: 500 }
    )
  }
}

async function groupProductsWithAI(products: any[]) {
  // Group products by AI-predicted standard names
  const groupedProducts: { [key: string]: any } = {}
  
  // Limit processing to first 50 products to prevent timeout
  const limitedProducts = products.slice(0, 50)
  console.log(`Processing ${limitedProducts.length} products with AI model...`)

  for (let i = 0; i < limitedProducts.length; i++) {
    const product = limitedProducts[i]
    try {
      // Use AI model to predict standard name with timeout
      const aiResult = await Promise.race([
        predictWithAI(product.raw_name),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('AI timeout')), 5000)
        )
      ]) as any
      
      const standardName = aiResult.predicted_standard_name

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
          ai_confidence: aiResult.confidence
        }
      }

      // Add to grouped product
      const grouped = groupedProducts[standardName]
      grouped.raw_names.push(product.raw_name)
      grouped.min_price = Math.min(grouped.min_price, product.price_bdt)
      grouped.max_price = Math.max(grouped.max_price, product.price_bdt)
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

    } catch (error) {
      console.error(`Error processing product ${product.raw_name}:`, error)
      // Skip this product if AI prediction fails
    }
  }

  // Calculate average prices and sort
  const result = Object.values(groupedProducts).map((product: any) => {
    product.avg_price = product.price_entries.reduce((sum: number, entry: any) => sum + entry.price_bdt, 0) / product.price_entries.length
    return product
  })

  // Sort by vendor count (descending) then by min price (ascending)
  return result.sort((a: any, b: any) => {
    if (b.vendor_count !== a.vendor_count) {
      return b.vendor_count - a.vendor_count
    }
    return a.min_price - b.min_price
  })
}

async function predictWithAI(rawName: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const pythonScript = path.join(process.cwd(), 'lib', 'ai', 'api_predictor.py')
    const python = spawn('python', [pythonScript, '--query', rawName])
    
    let output = ''
    let errorOutput = ''
    
    python.stdout.on('data', (data) => {
      output += data.toString()
    })
    
    python.stderr.on('data', (data) => {
      errorOutput += data.toString()
    })
    
    python.on('close', (code) => {
      if (code !== 0) {
        console.error(`Python script failed for "${rawName}": ${errorOutput}`)
        // Return a fallback prediction instead of rejecting
        resolve({
          predicted_standard_name: rawName,
          confidence: 0.1,
          raw_name: rawName
        })
        return
      }
      
      try {
        // Extract JSON from output (handle debug messages)
        const lines = output.split('\n')
        let jsonLine = ''
        
        // Find the last line that looks like JSON
        for (let i = lines.length - 1; i >= 0; i--) {
          const line = lines[i].trim()
          if (line.startsWith('{') && line.includes('"type"')) {
            jsonLine = line
            break
          }
        }
        
        if (!jsonLine) {
          console.error(`No JSON found in output for "${rawName}": ${output}`)
          resolve({
            predicted_standard_name: rawName,
            confidence: 0.1,
            raw_name: rawName
          })
          return
        }
        
        const result = JSON.parse(jsonLine)
        if (result.type === 'error') {
          console.error(`AI error for "${rawName}": ${result.error}`)
          resolve({
            predicted_standard_name: rawName,
            confidence: 0.1,
            raw_name: rawName
          })
          return
        }
        resolve(result.result)
      } catch (parseError) {
        console.error(`JSON parse error for "${rawName}": ${parseError}`)
        // Return a fallback prediction instead of rejecting
        resolve({
          predicted_standard_name: rawName,
          confidence: 0.1,
          raw_name: rawName
        })
      }
    })
  })
}

function extractBrand(standardName: string): string {
  if (standardName.toLowerCase().includes('intel')) return 'Intel'
  if (standardName.toLowerCase().includes('amd')) return 'AMD'
  if (standardName.toLowerCase().includes('ryzen')) return 'AMD'
  if (standardName.toLowerCase().includes('core')) return 'Intel'
  return 'Unknown'
}

function fallbackGroupProducts(products: any[]) {
  const groupedProducts: { [key: string]: any } = {}
  
  for (const product of products) {
    // Simple grouping by first 3 words of raw_name
    const words = product.raw_name.split(' ').slice(0, 3).join(' ')
    const standardName = words
    
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
        ai_confidence: 0.5 // Fallback confidence
      }
    }

    // Add to grouped product
    const grouped = groupedProducts[standardName]
    grouped.raw_names.push(product.raw_name)
    grouped.min_price = Math.min(grouped.min_price, product.price_bdt)
    grouped.max_price = Math.max(grouped.max_price, product.price_bdt)
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
  const result = Object.values(groupedProducts).map((product: any) => {
    product.avg_price = product.price_entries.reduce((sum: number, entry: any) => sum + entry.price_bdt, 0) / product.price_entries.length
    return product
  })

  // Sort by vendor count (descending) then by min price (ascending)
  return result.sort((a: any, b: any) => {
    if (b.vendor_count !== a.vendor_count) {
      return b.vendor_count - a.vendor_count
    }
    return a.min_price - b.min_price
  })
}
