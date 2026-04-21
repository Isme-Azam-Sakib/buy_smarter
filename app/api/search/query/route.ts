import { NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'
import { getDatabase } from '@/lib/database'
import { CATEGORIES } from '@/lib/categories'
import { CPUProduct } from '@/lib/types'

// Get API key at runtime - Next.js loads env vars, but we'll check it in the handler
// Initialize Gemini lazily in the handler to ensure env vars are loaded
let genAI: GoogleGenAI | null = null

const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash']
const OPENAI_MODELS = [
  process.env.OPENAI_MODEL || 'gpt-4o-mini',
  'gpt-4.1-mini',
]
const OPENROUTER_MODELS = [
  process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash',
  'google/gemini-2.0-flash-001',
]
const AI_MAX_RETRIES = 2

function getGenAI(): GoogleGenAI | null {
  if (genAI) return genAI
  
  const apiKey = process.env.GEMINI_API_KEY
  console.log('[Search API] Environment check:')
  console.log('[Search API] GEMINI_API_KEY exists:', !!apiKey)
  console.log('[Search API] GEMINI_API_KEY length:', apiKey?.length || 0)
  console.log('[Search API] GEMINI_API_KEY first 10 chars:', apiKey?.substring(0, 10) || 'N/A')
  
  if (!apiKey) {
    console.warn('[Search API] GEMINI_API_KEY is not set in environment variables')
    console.warn('[Search API] NODE_ENV:', process.env.NODE_ENV)
    console.warn('[Search API] DATABASE_URL exists:', !!process.env.DATABASE_URL)
    return null
  }
  
  // New SDK: GoogleGenAI automatically picks up GEMINI_API_KEY from env
  // But we can also pass it explicitly
  genAI = new GoogleGenAI({ apiKey })
  return genAI
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isHighDemandError(error: any): boolean {
  const errorMessage = error?.message || String(error || '')
  const statusCode = typeof error?.status === 'number' ? error.status : 0
  return (
    statusCode === 503 ||
    errorMessage.includes('high demand') ||
    errorMessage.includes('UNAVAILABLE')
  )
}

function isQuotaError(error: any): boolean {
  const errorMessage = error?.message || String(error || '')
  const statusCode = typeof error?.status === 'number' ? error.status : 0
  return (
    statusCode === 429 ||
    errorMessage.includes('RESOURCE_EXHAUSTED') ||
    errorMessage.toLowerCase().includes('quota exceeded')
  )
}

function extractBudgetFromQuery(query: string): { min: number; max: number } | null {
  const q = query.toLowerCase()

  // "under 200k", "within 80k", "below 50000", "under 2 lac"
  const underMatch = q.match(/\b(?:under|within|below|upto|up to|max)\s+(\d+(?:\.\d+)?)\s*(k|m|lac|lakh)?\b/i)
  if (underMatch) {
    const value = parseFloat(underMatch[1])
    const unit = (underMatch[2] || '').toLowerCase()
    let max = value
    if (unit === 'k') max = value * 1000
    if (unit === 'm') max = value * 1000000
    if (unit === 'lac' || unit === 'lakh') max = value * 100000
    return { min: 0, max: Math.round(max) }
  }

  // Any plain 4-6 digit number as budget hint
  const numberMatch = q.match(/\b(\d{4,6})\b/)
  if (numberMatch) {
    const max = parseInt(numberMatch[1], 10)
    if (!Number.isNaN(max)) return { min: 0, max }
  }

  return null
}

function fallbackAnalyzeQuery(query: string) {
  const q = query.toLowerCase()
  const budget = extractBudgetFromQuery(query)

  const useCase = q.includes('editing')
    ? 'editing'
    : q.includes('gaming')
      ? 'gaming'
      : q.includes('stream')
        ? 'streaming'
        : null

  const isBuild = /\b(build|pc build|full pc|complete pc|gaming pc|editing pc)\b/i.test(q)
  if (isBuild || (q.includes('pc') && !!budget)) {
    return {
      type: 'build',
      category: null,
      budget,
      productType: null,
      useCase,
      message: 'Using backup analyzer because AI is temporarily unavailable. Showing a practical build from in-stock products.',
      reasoning: 'Fallback parser detected a PC build request.',
    }
  }

  const categoryKeywords: Array<{ id: string; patterns: RegExp[] }> = [
    { id: 'processor', patterns: [/\bcpu\b/i, /\bprocessor\b/i, /\bryzen\b/i, /\bcore i[3579]\b/i] },
    { id: 'graphics-card', patterns: [/\bgpu\b/i, /\bgraphics\b/i, /\brtx\b/i, /\bgtx\b/i, /\bradeon\b/i] },
    { id: 'ram', patterns: [/\bram\b/i, /\bddr4\b/i, /\bddr5\b/i, /\bmemory\b/i] },
    { id: 'ssd', patterns: [/\bssd\b/i, /\bnvme\b/i, /\bm\.?2\b/i] },
    { id: 'motherboard', patterns: [/\bmotherboard\b/i, /\bmobo\b/i, /\bam4\b/i, /\bam5\b/i, /\blga\b/i] },
    { id: 'power-supply', patterns: [/\bpsu\b/i, /\bpower supply\b/i, /\bsmps\b/i] },
    { id: 'cpu-cooler', patterns: [/\bcooler\b/i, /\bcpu cooler\b/i, /\bair cooler\b/i, /\baio\b/i] },
  ]

  const matched = categoryKeywords.find((entry) => entry.patterns.some((pattern) => pattern.test(q)))
  if (matched) {
    return {
      type: 'single_product',
      category: matched.id,
      budget,
      productType: null,
      useCase,
      message: 'Using backup analyzer because AI is temporarily unavailable. Showing the best in-stock matches.',
      reasoning: 'Fallback parser detected a single-product request.',
    }
  }

  return {
    type: 'general_question',
    category: null,
    budget,
    productType: null,
    useCase,
    message: 'AI is currently unavailable. Try a specific query like "best GPU under 30k" or "gaming PC under 100k".',
    reasoning: 'Fallback parser could not confidently map the request.',
  }
}

async function generateWithRetryAndFallback(ai: GoogleGenAI | null, contents: string) {
  let lastError: any = null

  const openAiKey = process.env.OPENAI_API_KEY
  let skipOpenAi = false
  if (openAiKey) {
    for (const model of OPENAI_MODELS) {
      if (skipOpenAi) break
      for (let attempt = 1; attempt <= AI_MAX_RETRIES; attempt++) {
        try {
          const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${openAiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model,
              messages: [{ role: 'user', content: contents }],
              temperature: 0.2,
            }),
          })

          if (!response.ok) {
            const errText = await response.text()
            const err: any = new Error(errText || `OpenAI error ${response.status}`)
            err.status = response.status
            throw err
          }

          const data: any = await response.json()
          const text = data?.choices?.[0]?.message?.content?.trim() || ''
          if (!text) {
            throw new Error(`AI response is empty for OpenAI model ${model}`)
          }
          return { text, model }
        } catch (error: any) {
          lastError = error
          const errorText = (error?.message || String(error || '')).toLowerCase()
          const isInsufficientQuota =
            errorText.includes('insufficient_quota') || errorText.includes('exceeded your current quota')
          const isAuthError = error?.status === 401 || errorText.includes('invalid_api_key')

          if (isInsufficientQuota || isAuthError) {
            console.warn(
              `[Search API] Skipping OpenAI entirely (model=${model}):`,
              isInsufficientQuota ? 'insufficient quota / no credits' : 'invalid api key'
            )
            skipOpenAi = true
            break
          }

          const retryable = isHighDemandError(error) || isQuotaError(error)
          const isLastAttempt = attempt === AI_MAX_RETRIES

          console.warn(
            `[Search API] OpenAI call failed (model=${model}, attempt=${attempt}/${AI_MAX_RETRIES}):`,
            error?.message || String(error)
          )

          if (!retryable || isLastAttempt) break
          await sleep(attempt * 800)
        }
      }
    }
  }

  const openRouterKey = process.env.OPENROUTER_API_KEY
  if (openRouterKey) {
    for (const model of OPENROUTER_MODELS) {
      for (let attempt = 1; attempt <= AI_MAX_RETRIES; attempt++) {
        try {
          const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${openRouterKey}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
              'X-Title': 'BuySmarter',
            },
            body: JSON.stringify({
              model,
              messages: [{ role: 'user', content: contents }],
              temperature: 0.2,
            }),
          })

          if (!response.ok) {
            const errText = await response.text()
            const err: any = new Error(errText || `OpenRouter error ${response.status}`)
            err.status = response.status
            throw err
          }

          const data: any = await response.json()
          const text = data?.choices?.[0]?.message?.content?.trim() || ''
          if (!text) {
            throw new Error(`AI response is empty for OpenRouter model ${model}`)
          }

          return { text, model }
        } catch (error: any) {
          lastError = error
          const retryable = isHighDemandError(error) || isQuotaError(error)
          const isLastAttempt = attempt === AI_MAX_RETRIES

          console.warn(
            `[Search API] OpenRouter call failed (model=${model}, attempt=${attempt}/${AI_MAX_RETRIES}):`,
            error?.message || String(error)
          )

          if (!retryable || isLastAttempt) break
          await sleep(attempt * 800)
        }
      }
    }
  }

  if (ai) {
    for (const model of GEMINI_MODELS) {
      for (let attempt = 1; attempt <= AI_MAX_RETRIES; attempt++) {
        try {
          const response = await ai.models.generateContent({
            model,
            contents,
          })
          const text = response.text || ''
          if (!text) {
            throw new Error(`AI response is empty for model ${model}`)
          }
          return { text, model }
        } catch (error: any) {
          lastError = error
          const retryable = isHighDemandError(error)
          const isLastAttempt = attempt === AI_MAX_RETRIES

          console.warn(
            `[Search API] Gemini call failed (model=${model}, attempt=${attempt}/${AI_MAX_RETRIES}):`,
            error?.message || String(error)
          )

          if (!retryable || isLastAttempt) {
            break
          }

          await sleep(attempt * 600)
        }
      }
    }
  }

  throw lastError || new Error('All AI models failed')
}

// Available categories for AI context
const availableCategories = CATEGORIES.map(cat => ({
  id: cat.id,
  name: cat.name,
  description: cat.description
}))

const SYSTEM_PROMPT = `You are a helpful assistant for a PC parts price comparison website in Bangladesh. 

Available product categories in the database:
${availableCategories.map(cat => `- ${cat.name} (${cat.id}): ${cat.description}`).join('\n')}

Your tasks:
1. Understand the user's query (supports English and Bengali)
2. Determine if they're asking for:
   - A single product (e.g., "best GPU under 30k")
   - A complete PC build (e.g., "gaming PC under 50k")
   - Information about unavailable categories (e.g., "gaming laptop", "monitor")
3. Extract relevant information:
   - Product category (must match one of the available categories above)
   - Budget range (in BDT/taka)
   - Product type/brand if mentioned
   - Use case (gaming, editing, etc.)
4. When the user wants a full PC build:
   - Think like a professional PC builder in Bangladesh using your most up-to-date knowledge of current-generation parts.
   - Strongly prefer a modern platform (recent Intel Core or AMD Ryzen) rather than very old or obsolete CPUs just to cut cost.
   - Ensure CPU and motherboard are on a compatible platform (do NOT mix Intel CPUs with AMD-only chipsets and vice versa).
   - Aim for a balanced build: avoid pairing a very weak CPU with a very strong GPU (or the opposite) if the budget allows better balance.
   - Favor reliable power supplies (80+ rated, sufficient wattage for the parts) instead of unrealistically cheap, underpowered units.

If the user asks for categories NOT in the list (like laptops, monitors, keyboards, etc.), politely inform them that these categories are not available on this site.

Respond in JSON format:
{
  "type": "single_product" | "build" | "unavailable_category" | "general_question",
  "category": "category_id" | null,
  "budget": { "min": number, "max": number } | null,
  "productType": "string" | null,
  "useCase": "string" | null,
  "message": "user-friendly response message",
  "reasoning": "brief explanation of your analysis"
}`

export async function POST(request: Request) {
  try {
    console.log('[Search API] Request received')
    
    const openAiKey = process.env.OPENAI_API_KEY
    const openRouterKey = process.env.OPENROUTER_API_KEY
    const ai = getGenAI()
    if (!openAiKey && !openRouterKey && !ai) {
      console.error('[Search API] AI not initialized - OPENAI_API_KEY/OPENROUTER_API_KEY/GEMINI_API_KEY missing')
      return NextResponse.json(
        { 
          error: 'AI service is not configured. Please set OPENAI_API_KEY.',
          message: 'The AI search feature requires an OpenAI API key (primary), with optional OpenRouter/Gemini fallbacks.',
          details: 'OPENAI_API_KEY is missing. Optional fallbacks: OPENROUTER_API_KEY, GEMINI_API_KEY.'
        },
        { status: 500 }
      )
    }

    const { query } = await request.json()
    console.log('[Search API] Query:', query)

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      )
    }

    // Get AI analysis using Gemini, with fallback to local parser when Gemini is busy/quota-limited.
    console.log('[Search API] Calling Gemini AI...')
    let text: string | null = null
    let aiAnalysis: any = null
    
    try {
      const prompt = `${SYSTEM_PROMPT}\n\nUser query: "${query}"\n\nAnalyze this query and respond with JSON only.`
      
      const result = await generateWithRetryAndFallback(ai, prompt)
      text = result.text
      console.log('[Search API] AI raw response:', text.substring(0, 200))
    } catch (aiError: any) {
      console.error('[Search API] Gemini API error:', aiError)
      console.error('[Search API] Error details:', JSON.stringify(aiError, null, 2))
      
      const errorMessage = aiError.message || String(aiError)
      const isHighDemand = isHighDemandError(aiError)
      const quotaExceeded = isQuotaError(aiError)

      if (isHighDemand || quotaExceeded) {
        aiAnalysis = fallbackAnalyzeQuery(query)
        aiAnalysis.aiUnavailable = true
        aiAnalysis.aiUnavailableReason = quotaExceeded ? 'quota_exceeded' : 'high_demand'
        console.warn('[Search API] Using fallback analyzer due to temporary AI issue:', aiAnalysis.aiUnavailableReason)
      } else {
        // Provide helpful error message (differentiate config vs high-demand issues)
        const basePayload: any = {
          error: 'AI service error',
          details: `AI provider error: ${errorMessage.substring(0, 300)}. Please verify OPENAI_API_KEY first, then OPENROUTER_API_KEY, then GEMINI_API_KEY.`,
          message: 'AI service is not available. Please check your API key configuration.',
          rawError: errorMessage,
          troubleshooting: {
            step1: 'Ensure OPENAI_API_KEY is present and active in .env.local',
            step2: 'If OpenAI fails, ensure OPENROUTER_API_KEY is present and active',
            step3: 'Optional final fallback: set GEMINI_API_KEY for direct Google calls',
            step4: 'Check model access/quota for each provider in order',
            step5: 'Restart your development server after env changes'
          }
        }
      
        return NextResponse.json(
          basePayload,
          { status: 500 }
        )
      }
    }

    if (!aiAnalysis) {
      // Parse AI response (handle markdown code blocks if present)
      try {
        const jsonMatch = text?.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          aiAnalysis = JSON.parse(jsonMatch[0])
          console.log('[Search API] Parsed AI analysis:', aiAnalysis)
        } else {
          throw new Error('No JSON found in response')
        }
      } catch (parseError) {
        console.error('[Search API] Failed to parse AI response:', text)
        console.error('[Search API] Parse error:', parseError)
        aiAnalysis = fallbackAnalyzeQuery(query)
        aiAnalysis.aiUnavailable = true
        aiAnalysis.aiUnavailableReason = 'parse_error'
        console.warn('[Search API] Falling back to local parser after AI parse failure')
      }
    }

    // Handle unavailable categories
    if (aiAnalysis.type === 'unavailable_category') {
      return NextResponse.json({
        type: 'unavailable_category',
        message: aiAnalysis.message || 'This category is not available on our site.',
        availableCategories: availableCategories.map(cat => cat.name)
      })
    }

    // Handle general questions
    if (aiAnalysis.type === 'general_question') {
      return NextResponse.json({
        type: 'general_question',
        message: aiAnalysis.message || 'I can help you find PC parts. Try asking for specific products or builds!',
        availableCategories: availableCategories.map(cat => cat.name)
      })
    }

    // Handle single product requests
    if (aiAnalysis.type === 'single_product' && aiAnalysis.category) {
      const db = await getDatabase()
      const category = aiAnalysis.category

      // Build query with budget filter
      const filters: string[] = [
        'category = $1',
        'price_bdt IS NOT NULL',
        'price_bdt > 0'
      ]
      const params: any[] = [category]

      // Only consider products that are currently in stock
      filters.push(`availability_status = $${params.length + 1}`)
      params.push('in_stock')

      // Add budget filter if provided
      if (aiAnalysis.budget) {
        if (aiAnalysis.budget.max) {
          filters.push(`price_bdt <= $${params.length + 1}`)
          params.push(aiAnalysis.budget.max)
        }
        if (aiAnalysis.budget.min) {
          filters.push(`price_bdt >= $${params.length + 1}`)
          params.push(aiAnalysis.budget.min)
        }
      }

      // Add product type filter if mentioned
      if (aiAnalysis.productType) {
        const searchTerm = `%${aiAnalysis.productType}%`
        filters.push(`(standard_name ILIKE $${params.length + 1} OR brand ILIKE $${params.length + 2})`)
        params.push(searchTerm, searchTerm)
      }

      const whereClause = `WHERE ${filters.join(' AND ')}`

      // Get aggregated products
      const sql = `
        WITH aggregated AS (
          SELECT
            standard_name,
            brand,
            MIN(price_bdt) AS min_price,
            MAX(price_bdt) AS max_price,
            AVG(price_bdt) AS avg_price,
            COUNT(DISTINCT vendor_name) AS vendor_count,
            COUNT(*) AS total_listings
          FROM all_products
          ${whereClause}
          GROUP BY standard_name, brand
          ORDER BY min_price ASC
          LIMIT 10
        )
        SELECT *
        FROM aggregated
      `

      let productRows = await db.query(sql, params)

      // Fallback: if AI-based filters return no products, try a simpler text search
      // using the raw user query against product names and brands to improve recall.
      if (!productRows || productRows.length === 0) {
        console.log('[Search API] No products found with AI filters, running fallback text search using raw query')

        const fallbackFilters = [
          'category = $1',
          'price_bdt IS NOT NULL',
          'price_bdt > 0',
          'availability_status = $2',
          '(standard_name ILIKE $3 OR raw_name ILIKE $3 OR brand ILIKE $3)'
        ]
        const fallbackParams: any[] = [
          category,
          'in_stock',
          `%${query}%`
        ]
        const fallbackWhereClause = `WHERE ${fallbackFilters.join(' AND ')}`

        const fallbackSql = `
          WITH aggregated AS (
            SELECT
              standard_name,
              brand,
              MIN(price_bdt) AS min_price,
              MAX(price_bdt) AS max_price,
              AVG(price_bdt) AS avg_price,
              COUNT(DISTINCT vendor_name) AS vendor_count,
              COUNT(*) AS total_listings
            FROM all_products
            ${fallbackWhereClause}
            GROUP BY standard_name, brand
            ORDER BY min_price ASC
            LIMIT 10
          )
          SELECT *
          FROM aggregated
        `

        productRows = await db.query(fallbackSql, fallbackParams)
      }

      // Fetch price entries and images for these products
      const standardNames = productRows.map((row: any) => row.standard_name)
      const formattedProducts: CPUProduct[] = []

      if (standardNames.length > 0) {
        // Fetch price entries
        const namePlaceholders = standardNames
          .map((_: any, i: number) => `$${i + 1}`)
          .join(', ')
        const priceQuery = `
          SELECT
            standard_name,
            id,
            vendor_name,
            raw_name,
            price_bdt,
            availability_status,
            product_url,
            image_url,
            scraped_at,
            description
          FROM all_products
          WHERE category = $${standardNames.length + 1}
            AND standard_name IN (${namePlaceholders})
          ORDER BY
            standard_name,
            CASE 
              WHEN price_bdt IS NOT NULL AND price_bdt > 0 THEN 0 
              ELSE 1 
            END,
            price_bdt ASC
        `
        const priceRows = await db.query(priceQuery, [...standardNames, category])

        // Group price entries and images by product
        const priceEntriesMap = new Map<string, any[]>()
        const imagesMap = new Map<string, Set<string>>()

        for (const row of priceRows) {
          const entries = priceEntriesMap.get(row.standard_name) || []
          entries.push({
            id: row.id,
            vendor_name: row.vendor_name,
            raw_name: row.raw_name,
            price_bdt: Number(row.price_bdt),
            availability_status: row.availability_status,
            product_url: row.product_url,
            image_url: row.image_url,
            scraped_at: row.scraped_at,
            description: row.description,
          })
          priceEntriesMap.set(row.standard_name, entries)

          if (row.image_url) {
            const images = imagesMap.get(row.standard_name) || new Set()
            images.add(row.image_url)
            imagesMap.set(row.standard_name, images)
          }
        }

        // Format products
        for (const row of productRows) {
          formattedProducts.push({
            id: row.standard_name,
            standard_name: row.standard_name,
            brand: row.brand,
            min_price: row.min_price,
            max_price: row.max_price || row.min_price,
            avg_price: row.avg_price,
            vendor_count: row.vendor_count,
            total_listings: row.total_listings,
            vendors: [],
            images: Array.from(imagesMap.get(row.standard_name) || []),
            price_entries: priceEntriesMap.get(row.standard_name) || []
          })
        }
      }

      await db.close()

      // Get final AI response with product context
      const productContext = formattedProducts.slice(0, 5).map(p => 
        `${p.standard_name} (${p.brand}) - ${p.min_price} BDT`
      ).join('\n')

      const finalPrompt = `Based on the user's query "${query}" and the following products found in the database:

${productContext}

${formattedProducts.length === 0 ? 'No products found matching the criteria.' : `Found ${formattedProducts.length} products.`}

Provide a helpful, conversational response in the same language as the user's query. If products were found, mention the best/cheapest option. If no products found, suggest alternatives or explain why.`

      let finalText = 'Here are the best matches currently available on our site.'
      try {
        const finalResult = await generateWithRetryAndFallback(ai, finalPrompt)
        finalText = finalResult.text
      } catch (finalAiError) {
        console.warn('[Search API] Final summary generation failed, using fallback message:', finalAiError)
      }

      return NextResponse.json({
        type: 'single_product',
        message: finalText,
        products: formattedProducts,
        category: category,
        budget: aiAnalysis.budget,
        aiAnalysis: aiAnalysis
      })
    }

    // Handle build requests
    if (aiAnalysis.type === 'build' && aiAnalysis.budget) {
      // Generate build spec using AI (JSON-only, using our exact category IDs)
      const budgetLimit = aiAnalysis.budget.max || aiAnalysis.budget.min || 0
      const categoryLines = availableCategories
        .map(cat => `- ${cat.id}: ${cat.name} - ${cat.description}`)
        .join('\n')

      const buildPrompt = `The user wants a ${aiAnalysis.useCase || 'PC'} build under ${budgetLimit} BDT.

You are an expert PC builder in Bangladesh. Use your latest knowledge of the current market when deciding what is "old" or "current" generation.

Earlier you wrote this natural-language recommendation (this is only for your context, do NOT repeat it verbatim):
${aiAnalysis.message || ''}

Available product categories (use these exact IDs in the "category" field):
${categoryLines}

Strict build rules:
- Choose a single platform (Intel or AMD) and keep the CPU and motherboard compatible for that platform. Do NOT suggest combinations that would not work in real life (for example, an Intel CPU with an AM4/AM5-only motherboard).
- Strongly prefer reasonably modern CPUs and GPUs. Do NOT pick very old or entry-level parts just to cut cost if the budget allows a better, more realistic choice.
- Aim for a well-balanced build: CPU and GPU performance should be in the same class for the intended use (gaming, editing, etc.).
- Make sure the PSU has enough wattage and is a reputable 80+ rated unit for the selected CPU and GPU.
- Favor components that represent good value in the current market, not extreme corner cases.

Respond in JSON ONLY (no markdown, no prose) with this shape:
{
  "components": [
    { 
      "category": "processor|graphics-card|ram|ssd|motherboard|power-supply|cpu-cooler",
      "description": "human-readable explanation of what this part should be",
      "modelHint": "very short model or capacity hint to target in the store database, for example: 'Ryzen 5 5600', 'RX 6600 XT', '16GB DDR4 3200', '650W 80+ Bronze'",
      "priority": "high|medium|low"
    }
  ],
  "totalBudget": number,
  "reasoning": "1-2 short sentences about why this build fits the budget and use case"
}`

      let buildText = '{}'
      try {
        const buildResult = await generateWithRetryAndFallback(ai, buildPrompt)
        buildText = buildResult.text
      } catch (buildAiError) {
        console.warn('[Search API] Build spec generation failed:', buildAiError)
      }

      let buildSpec: any
      try {
        const jsonMatch = buildText.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          buildSpec = JSON.parse(jsonMatch[0])
        }
      } catch (e) {
        console.error('Failed to parse build spec:', buildText)
      }

      // Query database for each component
      const db = await getDatabase()
      const buildProducts: Record<string, CPUProduct[]> = {}

      // Ensure we always have a component list to query, even when AI is unavailable.
      if (!buildSpec?.components || !Array.isArray(buildSpec.components) || buildSpec.components.length === 0) {
        const defaultCategories = ['processor', 'motherboard', 'ram', 'ssd', 'graphics-card', 'power-supply', 'cpu-cooler']
        buildSpec = buildSpec || {}
        buildSpec.components = defaultCategories
          .filter(id => availableCategories.find(c => c.id === id))
          .map(id => ({
            category: id,
            description: 'Auto-selected from in-stock products.',
            modelHint: '',
            priority: 'medium',
          }))
        buildSpec.reasoning = buildSpec.reasoning || 'Fallback build generated from in-stock products because AI planner was unavailable.'
      }

      if (buildSpec?.components) {
        for (const component of buildSpec.components) {
          const category = component.category
          if (!availableCategories.find(c => c.id === category)) continue

          const modelHint: string | undefined = typeof component.modelHint === 'string'
            ? component.modelHint.trim()
            : undefined

          const filters = [
            'category = $1',
            'price_bdt IS NOT NULL',
            'price_bdt > 0'
          ]
          const params: any[] = [category]

          // Only consider products that are currently in stock
          filters.push(`availability_status = $${params.length + 1}`)
          params.push('in_stock')

          // Allocate budget by category weight so high-impact parts (GPU/CPU) can use more budget.
          const categoryWeights: Record<string, number> = {
            'graphics-card': 0.35,
            'processor': 0.20,
            'motherboard': 0.12,
            'ram': 0.10,
            'ssd': 0.08,
            'power-supply': 0.08,
            'cpu-cooler': 0.07,
          }
          const defaultWeight = 1 / Math.max(buildSpec.components.length, 1)
          const weight = categoryWeights[category] ?? defaultWeight
          const componentBudget = Math.floor(budgetLimit * weight)
          const componentCeiling = Math.max(1, Math.floor(componentBudget * 1.5))

          // Keep category-level ceiling, but much less restrictive than equal split.
          filters.push(`price_bdt <= $${params.length + 1}`)
          params.push(componentCeiling)

          // NOTE: modelHint is intentionally NOT used as a hard SQL filter.
          // Hard filtering often forces cheap/limited matches and drags a high-budget build far below target.
          // We keep broad in-stock candidates and let budget/selection logic choose stronger parts.

          const whereClause = `WHERE ${filters.join(' AND ')}`

          const sql = `
            WITH aggregated AS (
              SELECT
                standard_name,
                brand,
                MIN(price_bdt) AS min_price,
                MAX(price_bdt) AS max_price,
                AVG(price_bdt) AS avg_price,
                COUNT(DISTINCT vendor_name) AS vendor_count,
                COUNT(*) AS total_listings,
                (
                  SELECT ap2.raw_name
                  FROM all_products ap2
                  WHERE ap2.category = $1
                    AND ap2.standard_name = all_products.standard_name
                    AND ap2.brand = all_products.brand
                    AND ap2.price_bdt IS NOT NULL
                    AND ap2.price_bdt > 0
                    AND ap2.availability_status = 'in_stock'
                  ORDER BY ap2.price_bdt ASC
                  LIMIT 1
                ) AS sample_raw_name,
                (
                  SELECT ap2.vendor_name
                  FROM all_products ap2
                  WHERE ap2.category = $1
                    AND ap2.standard_name = all_products.standard_name
                    AND ap2.brand = all_products.brand
                    AND ap2.price_bdt IS NOT NULL
                    AND ap2.price_bdt > 0
                    AND ap2.availability_status = 'in_stock'
                  ORDER BY ap2.price_bdt ASC
                  LIMIT 1
                ) AS sample_vendor_name
              FROM all_products
              ${whereClause}
              GROUP BY standard_name, brand
            ),
            top_picks AS (
              SELECT * FROM aggregated ORDER BY min_price DESC LIMIT 150
            ),
            bottom_picks AS (
              SELECT * FROM aggregated ORDER BY min_price ASC LIMIT 150
            )
            -- Combine both ends of the price spectrum so the selector can start high
            -- (pick most expensive under ceiling) and step down to genuinely cheap parts.
            SELECT * FROM top_picks
            UNION
            SELECT * FROM bottom_picks
          `

          const products = await db.query(sql, params)

          // Map raw rows into CPUProduct objects
          let mappedProducts: CPUProduct[] = products.map((p: any) => ({
            id: p.standard_name,
            standard_name: p.standard_name,
            brand: p.brand,
            min_price: p.min_price,
            max_price: p.max_price || p.min_price,
            avg_price: p.avg_price,
            vendor_count: p.vendor_count,
            total_listings: p.total_listings,
            vendors: [],
            images: [],
            price_entries: p.sample_raw_name
              ? [
                  {
                    id: `${p.standard_name}-${p.sample_vendor_name || 'unknown'}`,
                    vendor_name: p.sample_vendor_name || 'unknown',
                    raw_name: p.sample_raw_name,
                    price_bdt: p.min_price,
                    availability_status: 'in_stock',
                    product_url: '',
                    image_url: null,
                    scraped_at: '',
                    description: null,
                  },
                ]
              : []
          }))

          // Prefer products that have prices from multiple vendors (more trustworthy / popular),
          // but only as a soft preference: if there are any 3+ vendor items, use just those,
          // otherwise fall back to all candidates.
          const withEnoughVendors = mappedProducts.filter(p => p.vendor_count >= 3)
          mappedProducts = withEnoughVendors.length > 0 ? withEnoughVendors : mappedProducts

          // For processors only, try to avoid obviously old / legacy CPUs when there are modern options.
          if (category === 'processor') {
            const modern = mappedProducts.filter(p => !isLegacyCpu(p.standard_name))
            if (modern.length > 0) {
              mappedProducts = modern
            }
          }

          // Sort ascending so index 0 is cheapest and last index is most expensive under the ceiling.
          mappedProducts.sort((a, b) => (a.min_price || 0) - (b.min_price || 0))

          buildProducts[category] = mappedProducts
        }
      }

      await db.close()

      // Choose specific products per category so that the total falls within a target budget window.
      const categoryIds = Object.keys(buildProducts)
      const choices: Record<string, number> = {}
      const targetMin = budgetLimit > 0 ? Math.floor(budgetLimit * 0.9) : 0
      const targetMax = budgetLimit > 0 ? Math.ceil(budgetLimit * 1.1) : Number.POSITIVE_INFINITY

      // Start by picking the most expensive option under the ceiling for each category
      for (const categoryId of categoryIds) {
        const list = buildProducts[categoryId] as CPUProduct[]
        if (!list.length) {
          choices[categoryId] = -1
          continue
        }
        const idx = list.length - 1
        choices[categoryId] = idx
      }

      // Enforce basic CPU / motherboard platform compatibility on the chosen items
      enforceCpuMotherboardCompatibility(buildProducts, choices)

      const computeTotalFromChoices = () =>
        categoryIds.reduce((sum, categoryId) => {
          const list = buildProducts[categoryId] as CPUProduct[]
          const idx = choices[categoryId]
          if (!list.length || idx == null || idx < 0 || idx >= list.length) return sum
          return sum + (list[idx].min_price || 0)
        }, 0)

      // If we exceed the allowed max window, step down parts greedily until we're inside it.
      let total = computeTotalFromChoices()
      if (Number.isFinite(targetMax) && total > targetMax) {
        let safety = 0
        while (total > targetMax && safety < 500) {
          safety += 1
          let bestCategory: string | null = null
          let bestSaving = -1

          for (const categoryId of categoryIds) {
            const list = buildProducts[categoryId] as CPUProduct[]
            const idx = choices[categoryId]
            if (!list.length || idx == null || idx <= 0 || idx >= list.length) continue
            const currentPrice = list[idx].min_price || 0
            const cheaperPrice = list[idx - 1].min_price || 0
            const saving = currentPrice - cheaperPrice
            if (saving > bestSaving) {
              bestSaving = saving
              bestCategory = categoryId
            }
          }

          if (!bestCategory) break
          choices[bestCategory] = (choices[bestCategory] || 0) - 1

          // Only re-run CPU/motherboard compatibility if the processor was changed,
          // otherwise compatibility keeps pushing the motherboard back up and undoing savings.
          if (bestCategory === 'processor') {
            enforceCpuMotherboardCompatibility(buildProducts, choices)
          }

          total = computeTotalFromChoices()
        }
      }

      // If we're below the lower target window, upgrade parts greedily until we're inside it
      // (without overshooting targetMax). This handles cases where the initial "most expensive
      // under ceiling" was mid-range because the category has limited high-end stock.
      if (total < targetMin) {
        let safety = 0
        while (total < targetMin && safety < 500) {
          safety += 1
          let bestCategory: string | null = null
          let bestCost = Number.POSITIVE_INFINITY

          for (const categoryId of categoryIds) {
            const list = buildProducts[categoryId] as CPUProduct[]
            const idx = choices[categoryId]
            if (!list.length || idx == null || idx < 0 || idx >= list.length - 1) continue
            const currentPrice = list[idx].min_price || 0
            const nextPrice = list[idx + 1].min_price || 0
            const extraCost = nextPrice - currentPrice
            if (extraCost <= 0) continue
            // Prefer the cheapest upgrade step that keeps us under targetMax.
            if (total + extraCost <= targetMax && extraCost < bestCost) {
              bestCost = extraCost
              bestCategory = categoryId
            }
          }

          if (!bestCategory) break
          choices[bestCategory] = (choices[bestCategory] || 0) + 1

          if (bestCategory === 'processor') {
            enforceCpuMotherboardCompatibility(buildProducts, choices)
          }

          total = computeTotalFromChoices()
        }
      }

      // Reorder each category's list so the chosen item is first
      for (const categoryId of categoryIds) {
        const idx = choices[categoryId]
        const list = buildProducts[categoryId] as CPUProduct[]
        if (!list.length || idx < 0 || idx >= list.length) continue

        const chosen = list[idx]
        buildProducts[categoryId] = [
          chosen,
          ...list.filter((_, i) => i !== idx),
        ]
      }

      // Calculate an estimated build cost from the chosen option in each category
      const totalBuildCost = Object.values(buildProducts).reduce((sum, products) => {
        const list = products as CPUProduct[]
        const chosen = list[0]
        if (!chosen) return sum
        return sum + (chosen.min_price || 0)
      }, 0)

      return NextResponse.json({
        type: 'build',
        message: aiAnalysis.message || buildSpec?.reasoning || 'AI-selected PC build using products available on this site.',
        buildProducts,
        buildSpec,
        budget: aiAnalysis.budget,
        totalBuildCost,
        targetBudgetRange: budgetLimit > 0 ? { min: targetMin, max: targetMax } : null,
        aiAnalysis
      })
    }

    // Fallback
    return NextResponse.json({
      type: 'general_question',
      message: aiAnalysis.message || 'I can help you find PC parts. Try asking for specific products or builds!',
      aiAnalysis: aiAnalysis
    })

  } catch (error) {
    console.error('Search API error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to process search query',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

type Platform = 'intel' | 'amd' | 'unknown'

function isLegacyCpu(name: string): boolean {
  const n = (name || '').toLowerCase()
  if (!n) return false

  // Explicitly filter out very old known architectures if possible
  if (n.includes('kaby lake') || n.includes('skylake') || n.includes('haswell') || n.includes('ivy bridge') || n.includes('sandy bridge')) {
    return true
  }

  // Intel Core iX-7xxx and earlier (rough heuristic)
  const intelMatch = n.match(/core\s+i[3579]\s*-\s*(\d{4,5})/)
  if (intelMatch) {
    const genDigit = parseInt(intelMatch[1][0], 10)
    if (!Number.isNaN(genDigit) && genDigit <= 7) {
      return true
    }
  }

  // Older Ryzen 1xxx / 2xxx series
  const ryzenMatch = n.match(/ryzen\s+[3579]\s*(\d{4})/)
  if (ryzenMatch) {
    const seriesDigit = parseInt(ryzenMatch[1][0], 10)
    if (!Number.isNaN(seriesDigit) && seriesDigit <= 2) {
      return true
    }
  }

  return false
}

function detectCpuPlatform(cpu: CPUProduct): Platform {
  const brand = (cpu.brand || '').toLowerCase()
  const name = (cpu.standard_name || '').toLowerCase()

  if (brand.includes('intel')) return 'intel'
  if (brand.includes('amd')) return 'amd'

  if (/ryzen|athlon|threadripper/.test(name)) return 'amd'
  if (/core\s+i[3579]|pentium|celeron|xeon|lga/.test(name)) return 'intel'

  return 'unknown'
}

function detectMotherboardPlatform(mobo: CPUProduct): Platform {
  const name = (mobo.standard_name || '').toLowerCase()

  // AMD chipsets / sockets
  if (/(am2|am3|am4|am5|fm2|b350|b450|b550|b650|x370|x470|x570|x670|a320|a520|a620|trx40|x399|ryzen)/.test(name)) {
    return 'amd'
  }

  // Intel sockets / chipsets
  if (/(lga\s*1150|lga\s*1151|lga\s*1155|lga\s*1156|lga\s*1200|lga\s*1700|z[0-9]{3}|b[0-9]{3}|h[0-9]{2,3}|intel)/.test(name)) {
    return 'intel'
  }

  return 'unknown'
}

function enforceCpuMotherboardCompatibility(
  buildProducts: Record<string, CPUProduct[]>,
  choices: Record<string, number>
) {
  const cpuList = buildProducts['processor']
  const moboList = buildProducts['motherboard']
  if (!cpuList || !cpuList.length || !moboList || !moboList.length) return

  const cpuIdx = choices['processor']
  if (cpuIdx == null || cpuIdx < 0 || cpuIdx >= cpuList.length) return

  const cpu = cpuList[cpuIdx]
  const cpuPlatform = detectCpuPlatform(cpu)
  if (cpuPlatform === 'unknown') return

  const classifiedMobos = moboList.map((mobo, idx) => ({
    idx,
    platform: detectMotherboardPlatform(mobo),
    price: mobo.min_price || 0,
  }))

  let compatible = classifiedMobos.filter((m) => m.platform === cpuPlatform)

  // If we didn't find explicit matches, allow "unknown" but avoid clearly opposite platform
  if (!compatible.length) {
    compatible = classifiedMobos.filter((m) => m.platform === 'unknown')
  }

  if (!compatible.length) return

  const currentMoboIdx = choices['motherboard']
  const currentMoboPrice =
    currentMoboIdx != null &&
    currentMoboIdx >= 0 &&
    currentMoboIdx < moboList.length
      ? moboList[currentMoboIdx].min_price || 0
      : null

  let chosen = compatible[0]

  if (currentMoboPrice != null) {
    let bestDiff = Number.POSITIVE_INFINITY
    for (const candidate of compatible) {
      const diff = Math.abs((candidate.price || 0) - currentMoboPrice)
      if (diff < bestDiff) {
        bestDiff = diff
        chosen = candidate
      }
    }
  } else {
    // Otherwise pick the cheapest compatible motherboard
    chosen = compatible.slice().sort((a, b) => a.price - b.price)[0]
  }

  if (chosen) {
    choices['motherboard'] = chosen.idx
  }
}


