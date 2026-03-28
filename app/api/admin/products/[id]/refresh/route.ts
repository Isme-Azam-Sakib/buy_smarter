import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getDatabase } from '@/lib/database'
import { hasPermission } from '@/lib/admin-permissions'
import { spawn } from 'child_process'
import { updateTokenizedName } from '@/lib/tokenize-name'
import fs from 'fs'
import path from 'path'

function getPythonCommand() {
  // 1) Respect explicit override
  if (process.env.PYTHON_PATH && process.env.PYTHON_PATH.trim()) {
    return process.env.PYTHON_PATH.trim()
  }

  // 2) Prefer project-local virtualenv if present
  const cwd = process.cwd()
  const venvWin = path.join(cwd, '.venv', 'Scripts', 'python.exe')
  const venvUnix = path.join(cwd, '.venv', 'bin', 'python')

  if (fs.existsSync(venvWin)) {
    return venvWin
  }
  if (fs.existsSync(venvUnix)) {
    return venvUnix
  }

  // 3) Fallbacks: Windows launcher, then system python
  if (process.platform === 'win32') {
    return 'py'
  }

  return 'python3'
}

// Map vendor names to slugs
const vendorSlugMap: Record<string, string> = {
  'PC House': 'pchouse',
  'Skyland Computer BD': 'skyland',
  'Star Tech': 'startech',
  'Techland BD': 'techland',
  'Ultratech': 'ultratech',
  'Ultra Technology': 'ultratech',
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  const session = await requireAdmin()
  if (!hasPermission(session, 'products.edit')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  // Handle both Promise and direct params (Next.js 13+ compatibility)
  const resolvedParams = 'then' in params ? await params : params
  const productId = resolvedParams.id

  if (!productId) {
    return NextResponse.json({ error: 'Product ID is required' }, { status: 400 })
  }

  let db = await getDatabase()
  try {
    // Get the specific product entry
    const product = (await db.get(
      `
        SELECT 
          id,
          vendor_name,
          product_url,
          category,
          standard_name
        FROM all_products
        WHERE id = ?
        LIMIT 1
      `,
      [productId]
    )) as {
      id: number
      vendor_name: string
      product_url: string | null
      category: string | null
      standard_name: string
    } | undefined

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    if (!product.product_url) {
      return NextResponse.json(
        { error: 'Product URL not found. Cannot refresh this product.' },
        { status: 400 }
      )
    }

    if (!product.category) {
      return NextResponse.json(
        { error: 'Product category not found. Cannot refresh this product.' },
        { status: 400 }
      )
    }

    // Get vendor slug
    const vendorSlug = vendorSlugMap[product.vendor_name]
    if (!vendorSlug) {
      return NextResponse.json(
        { error: `Unknown vendor: ${product.vendor_name}. Cannot refresh.` },
        { status: 400 }
      )
    }

    console.log(`[Refresh] Refreshing product ID ${productId} from ${product.vendor_name}`)
    console.log(`[Refresh] URL: ${product.product_url}`)
    console.log(`[Refresh] Category: ${product.category}`)

    // Build product_urls dict with only this vendor
    const productUrls: Record<string, string> = {
      [vendorSlug]: product.product_url,
    }

    // Call Python script to refresh product
    const python = getPythonCommand()
    const urlsJson = JSON.stringify(productUrls)
    const args = [
      '-u',
      '-m',
      'scrapers.refresh_product',
      '--category',
      product.category,
      '--urls',
      urlsJson,
      '--timeout',
      '10',
      '--json',
    ]

    console.log(`[Refresh] Executing: ${python} ${args.join(' ')}`)
    console.log(`[Refresh] Product URLs:`, urlsJson)

    return new Promise<NextResponse>((resolve) => {
      const child = spawn(python, args, {
        cwd: process.cwd(),
        env: { ...process.env, PYTHONUNBUFFERED: '1' },
      })

      let stdout = ''
      let stderr = ''

      child.stdout.on('data', (data) => {
        stdout += data.toString()
      })

      child.stderr.on('data', (data) => {
        stderr += data.toString()
      })

      child.on('close', (code) => {
        if (code !== 0) {
          console.error(`[Refresh] Python script exited with code ${code}`)
          console.error(`[Refresh] stderr:`, stderr)
          console.error(`[Refresh] stdout:`, stdout)
          resolve(
            NextResponse.json(
              {
                success: false,
                error: 'Scraping failed',
                details: stderr || 'Unknown error',
              },
              { status: 500 }
            )
          )
          return
        }

        // Try to extract JSON from stdout (might have extra print statements)
        const trimmed = stdout.trim()
        if (!trimmed) {
          console.error('[Refresh] Empty stdout from Python script')
          resolve(
            NextResponse.json(
              {
                success: false,
                error: 'No output from scraper',
                details: 'The Python scraper did not return any data',
              },
              { status: 500 }
            )
          )
          return
        }

        try {
          // Try to find JSON in the output (might have debug prints before/after)
          let jsonStr = trimmed
          
          // Look for JSON object in the output (handle case where there are print statements)
          // Try to find the last JSON object in the output
          const jsonMatches = trimmed.match(/\{[\s\S]*\}/g)
          if (jsonMatches && jsonMatches.length > 0) {
            // Use the last match (should be the final JSON output)
            jsonStr = jsonMatches[jsonMatches.length - 1]
          }
          
          const result = JSON.parse(jsonStr)
          console.log('[Refresh] Successfully parsed result:', result)
          
          // Check if scraping was successful
          if (result.success === false) {
            resolve(
              NextResponse.json(
                {
                  success: false,
                  error: result.error || 'Scraping failed',
                  details: result.details || 'Unknown error occurred during scraping',
                },
                { status: 500 }
              )
            )
            return
          }
          
          // Update tokenized_name after successful refresh
          // Wait a bit for database to commit changes from Python script, then update tokenized_name
          // Do this asynchronously so it doesn't block the response
          ;(async () => {
            await new Promise(resolve => setTimeout(resolve, 500))
            try {
              const tokenizeDb = await getDatabase()
              try {
                // Re-fetch the product to get updated standard_name
                const updatedProduct = await tokenizeDb.get(
                  `SELECT id, standard_name, category FROM all_products WHERE id = ?`,
                  [productId]
                ) as { id: number; standard_name: string; category: string } | undefined
                
                if (updatedProduct && updatedProduct.standard_name && updatedProduct.category) {
                  await updateTokenizedName(
                    tokenizeDb,
                    updatedProduct.id,
                    updatedProduct.standard_name,
                    updatedProduct.category
                  )
                }
              } catch (tokenizeError) {
                console.error('[Refresh] Error updating tokenized_name:', tokenizeError)
                // Don't fail the request if tokenization fails
              } finally {
                await tokenizeDb.close()
              }
            } catch (dbError) {
              console.error('[Refresh] Error getting database for tokenization:', dbError)
            }
          })()
          
          resolve(NextResponse.json(result))
        } catch (e: any) {
          console.error('[Refresh] Failed to parse JSON:', e.message)
          console.error('[Refresh] stdout:', stdout)
          console.error('[Refresh] stderr:', stderr)
          resolve(
            NextResponse.json(
              {
                success: false,
                error: 'Failed to parse result',
                details: e.message || 'Invalid JSON response from scraper',
                stdout: stdout.substring(0, 500), // Limit output length
                stderr: stderr.substring(0, 500),
              },
              { status: 500 }
            )
          )
        }
      })
    })
  } catch (error: any) {
    console.error('Error refreshing product:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to refresh product' },
      { status: 500 }
    )
  } finally {
    await db.close()
  }
}

