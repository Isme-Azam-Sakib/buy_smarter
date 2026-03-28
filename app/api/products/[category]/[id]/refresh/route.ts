import { NextResponse } from 'next/server'
import { spawn } from 'child_process'
import { getDatabase } from '@/lib/database'
import { promisify } from 'util'
import { updateTokenizedNameBulk } from '@/lib/tokenize-name'
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

interface ProductUrl {
  vendor_slug: string
  product_url: string
}

export async function POST(
  request: Request,
  { params }: { params: { category: string; id: string } }
) {
  try {
    const category = decodeURIComponent(params.category)
    const productId = decodeURIComponent(params.id)
    
    const db = await getDatabase()
    const tableName = 'all_products'

    // Get all product URLs for this product from different vendors
    const urlQuery = `
      SELECT DISTINCT vendor_name, product_url
      FROM ${tableName}
      WHERE standard_name = $1
        AND category = $2
        AND product_url IS NOT NULL
        AND product_url != ''
    `
    
    const urlRows = await db.query(urlQuery, [productId, category])
    await db.close()

    console.log(`[Refresh] Looking for product: standard_name="${productId}", category="${category}"`)
    console.log(`[Refresh] Found ${urlRows?.length || 0} product URLs`)

    if (!urlRows || urlRows.length === 0) {
      console.error(`[Refresh] No product URLs found for standard_name="${productId}", category="${category}"`)
      return NextResponse.json(
        { error: 'No product URLs found for this product' },
        { status: 404 }
      )
    }

    // Map vendor names to slugs
    const vendorSlugMap: Record<string, string> = {
      'PC House': 'pchouse',
      'Skyland Computer BD': 'skyland',
      'Star Tech': 'startech',
      'Techland BD': 'techland',
      'Ultratech': 'ultratech',
      'Ultra Technology': 'ultratech',  // Alternative name used in database
    }

    // Build product_urls dict
    const productUrls: Record<string, string> = {}
    for (const row of urlRows as any[]) {
      const vendorName = row.vendor_name
      const slug = vendorSlugMap[vendorName]
      if (slug && row.product_url) {
        productUrls[slug] = row.product_url
        console.log(`[Refresh] Mapped ${vendorName} -> ${slug}: ${row.product_url}`)
      } else {
        console.warn(`[Refresh] Skipping ${vendorName} (slug: ${slug || 'NOT FOUND'}, url: ${row.product_url || 'MISSING'})`)
        console.log(`[Refresh] Available vendor names in map: ${Object.keys(vendorSlugMap).join(', ')}`)
      }
    }

    if (Object.keys(productUrls).length === 0) {
      console.error(`[Refresh] No valid vendor URLs found after mapping`)
      return NextResponse.json(
        { error: 'No valid vendor URLs found' },
        { status: 404 }
      )
    }

    console.log(`[Refresh] Calling Python scraper with ${Object.keys(productUrls).length} vendors`)

    // Always use SQLite - don't pass DATABASE_URL to Python so it uses SQLite too
    const pythonEnv: NodeJS.ProcessEnv = {}
    
    // Copy all environment variables except DATABASE_URL
    for (const key in process.env) {
      if (key !== 'DATABASE_URL') {
        pythonEnv[key] = process.env[key]
      }
    }
    
    pythonEnv.PYTHONUNBUFFERED = '1'
    console.log(`[Refresh] Using SQLite - DATABASE_URL NOT passed to Python environment`)

    // Call Python script to refresh product
    const python = getPythonCommand()
    const args = [
      '-u',
      '-m',
      'scrapers.refresh_product',
      '--category',
      category,
      '--urls',
      JSON.stringify(productUrls),
      '--timeout',
      '10',
      '--json',
    ]

    return new Promise<NextResponse>((resolve) => {
      const child = spawn(python, args, {
        cwd: process.cwd(),
        env: pythonEnv,
      })

      let stdout = ''
      let stderr = ''
      
      // Set a timeout for the scraping process (60 seconds max)
      const timeout = setTimeout(() => {
        child.kill('SIGTERM')
        resolve(
          NextResponse.json(
            {
              success: false,
              error: 'Scraping timed out after 60 seconds. The vendor websites may be slow or unresponsive.',
              stderr: stderr || 'Process killed due to timeout',
              stdout: stdout,
            },
            { status: 500 }
          )
        )
      }, 60000)

      child.stdout.on('data', (data) => {
        const output = data.toString()
        stdout += output
        // Log stdout in real-time for debugging
        console.log(`[Refresh Python stdout]: ${output.trim()}`)
      })

      child.stderr.on('data', (data) => {
        const output = data.toString()
        stderr += output
        // Log stderr in real-time for debugging
        console.error(`[Refresh Python stderr]: ${output.trim()}`)
      })
      
      child.on('error', (error) => {
        clearTimeout(timeout)
        resolve(
          NextResponse.json(
            {
              success: false,
              error: `Failed to start Python scraper: ${error.message}. Make sure Python is installed and accessible.`,
              stderr: stderr || error.message,
              stdout: stdout,
            },
            { status: 500 }
          )
        )
      })

      child.on('close', async (code) => {
        clearTimeout(timeout)
        console.log(`[Refresh] Python process exited with code: ${code}`)
        console.log(`[Refresh] stdout length: ${stdout.length}, stderr length: ${stderr.length}`)
        if (code !== 0) {
          // Extract meaningful error message from stderr
          let errorMessage = 'Scraping failed'
          if (stderr) {
            // Try to extract the last meaningful error line
            const stderrLines = stderr.split('\n').filter(line => line.trim())
            const lastErrorLine = stderrLines[stderrLines.length - 1] || stderrLines[0]
            if (lastErrorLine && lastErrorLine.length < 200) {
              errorMessage = lastErrorLine
            } else if (stderr.length < 300) {
              errorMessage = stderr.trim()
            } else {
              errorMessage = `Scraping failed: ${stderr.substring(0, 200)}...`
            }
          }
          
          resolve(
            NextResponse.json(
              {
                success: false,
                error: errorMessage,
                stderr: stderr,
                stdout: stdout,
                exitCode: code,
              },
              { status: 500 }
            )
          )
          return
        }

        try {
          // Check if stdout is empty or just whitespace
          const stdoutTrimmed = stdout.trim()
          if (!stdoutTrimmed) {
            resolve(
              NextResponse.json(
                {
                  success: false,
                  error: 'Python scraper returned no output. Check if Python dependencies are installed.',
                  stderr: stderr || 'No output from Python script',
                  stdout: stdout,
                },
                { status: 500 }
              )
            )
            return
          }
          
          // Extract JSON from stdout (may have extra output before JSON)
          // Look for the last line that starts with { and ends with }
          let jsonLine = ''
          const lines = stdoutTrimmed.split('\n')
          for (let i = lines.length - 1; i >= 0; i--) {
            const line = lines[i].trim()
            if (line.startsWith('{') && line.endsWith('}')) {
              jsonLine = line
              break
            }
          }
          
          // If no JSON line found, try parsing the whole stdout
          const jsonText = jsonLine || stdoutTrimmed
          const result = JSON.parse(jsonText)
          
          // Check if Python script reported failure
          if (result.success === false) {
            resolve(
              NextResponse.json(
                {
                  success: false,
                  error: result.error || 'Python scraper reported failure',
                  stderr: stderr,
                  stdout: stdout,
                  scraped_count: result.scraped_count || 0,
                },
                { status: 500 }
              )
            )
            return
          }
          
          // Update tokenized_name for all refreshed products
          if (result.success !== false) {
            // Wait a bit for database to commit changes from Python script, then update tokenized_name
            // Do this asynchronously so it doesn't block the response
            ;(async () => {
              await new Promise(resolve => setTimeout(resolve, 500))
              
              const db = await getDatabase()
              try {
                // Get all product entries that were refreshed (matching standard_name and category)
                const refreshedProducts = await db.query(
                  `SELECT id, standard_name, category FROM all_products 
                   WHERE standard_name = $1 AND category = $2`,
                  [productId, category]
                ) as Array<{ id: number; standard_name: string; category: string }>
                
                if (refreshedProducts && refreshedProducts.length > 0) {
                  await updateTokenizedNameBulk(db, refreshedProducts)
                }
              } catch (tokenizeError) {
                console.error('[Refresh] Error updating tokenized_name:', tokenizeError)
                // Don't fail the request if tokenization fails
              } finally {
                await db.close()
              }
            })()
          }
          
          resolve(NextResponse.json(result))
        } catch (e) {
          resolve(
            NextResponse.json(
              {
                success: false,
                error: 'Failed to parse result',
                stdout,
                stderr,
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
  }
}

