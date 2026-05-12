import { NextResponse } from 'next/server'
import { spawn, ChildProcess } from 'child_process'
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

// Store active scraper processes for cancellation
const activeProcesses = new Map<string, ChildProcess>()

function generateProcessId(): string {
  return `scraper-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

const VENDORS = [
  { slug: 'pchouse', name: 'PC House' },
  { slug: 'skyland', name: 'Skyland Computer BD' },
  { slug: 'startech', name: 'Star Tech' },
  { slug: 'techland', name: 'Techland BD' },
  { slug: 'ultratech', name: 'Ultratech' },
]

export async function GET(request: Request) {
  const url = new URL(request.url)
  const stream = url.searchParams.get('stream') === 'true'

  if (stream) {
    // Return SSE stream - this will be handled by a separate endpoint
    return NextResponse.json({ vendors: VENDORS })
  }

  return NextResponse.json({ vendors: VENDORS })
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const vendor = body?.vendor as string | undefined
  const stream = body?.stream === true
  const action = body?.action as string | undefined

  // Handle cancellation
  if (action === 'cancel' && body?.processId) {
    const processId = body.processId as string
    const child = activeProcesses.get(processId)
    if (child) {
      try {
        child.kill('SIGTERM')
        setTimeout(() => {
          try {
            child.kill('SIGKILL')
          } catch {}
        }, 2000)
        activeProcesses.delete(processId)
        return NextResponse.json({ success: true, message: 'Scraper cancelled' })
      } catch (e) {
        return NextResponse.json({ success: false, error: 'Failed to cancel' }, { status: 500 })
      }
    }
    return NextResponse.json({ success: false, error: 'Process not found' }, { status: 404 })
  }

  if (stream) {
    // Stream mode - use SSE
    return streamScraperOutput(vendor)
  }

  // Legacy mode - wait for completion
  const args = ['-m', 'scrapers.run', '--json']
  if (vendor) {
    const exists = VENDORS.find((v) => v.slug === vendor)
    if (!exists) {
      return NextResponse.json(
        { success: false, error: `Unknown vendor: ${vendor}` },
        { status: 400 }
      )
    }
    args.push('--vendor', vendor)
  }

  const cwd = process.cwd()
  const python = getPythonCommand()
  
  // Build environment without DATABASE_URL to force SQLite usage
  const pythonEnv = { ...process.env }
  delete pythonEnv.DATABASE_URL
  pythonEnv.PYTHONUNBUFFERED = '1'

  const result = await new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve) => {
    const child = spawn(python, ['-u', ...args], {
      cwd,
      env: pythonEnv,
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
      resolve({ code, stdout, stderr })
    })
  })

  if (result.code !== 0) {
    return NextResponse.json(
      {
        success: false,
        error: 'Scraper process failed',
        output: result.stdout + result.stderr,
      },
      { status: 500 }
    )
  }

  let stats: any = null
  const trimmed = result.stdout.trim()
  if (trimmed) {
    try {
      stats = JSON.parse(trimmed)
    } catch (error) {
      // Leave stats null, return raw output for debugging
    }
  }

  return NextResponse.json({
    success: true,
    stats,
    output: trimmed || result.stderr,
  })
}

function streamScraperOutput(vendor?: string) {
  const args = ['-u', '-m', 'scrapers.run', '--json'] // -u for unbuffered output
  if (vendor) {
    args.push('--vendor', vendor)
  }

  const cwd = process.cwd()
  const python = getPythonCommand()
  const processId = generateProcessId()

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      let isCancelled = false
      
      const sendEvent = (event: string, data: any) => {
        if (isCancelled) return
        const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
        try {
          controller.enqueue(encoder.encode(message))
        } catch (e) {
          // Stream might be closed
        }
      }

      sendEvent('start', { message: 'Starting scraper...', processId, type: 'start' })

      // Build environment without DATABASE_URL to force SQLite usage
      const pythonEnv = { ...process.env }
      delete pythonEnv.DATABASE_URL
      pythonEnv.PYTHONUNBUFFERED = '1'
      
      const child = spawn(python, args, {
        cwd,
        env: pythonEnv,
      })
      
      // Store process for cancellation
      activeProcesses.set(processId, child)
      
      // Clean up on process end
      const cleanup = () => {
        activeProcesses.delete(processId)
      }

      let stdoutBuffer = ''
      let stderrBuffer = ''

      child.stdout.on('data', (data: Buffer) => {
        const text = data.toString()
        stdoutBuffer += text
        
        // Process complete lines
        const lines = stdoutBuffer.split('\n')
        // Keep the last incomplete line in buffer
        stdoutBuffer = lines.pop() || ''
        
        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed) continue
          
          // Check if this line is JSON (stats output)
          if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
            try {
              const parsed = JSON.parse(trimmed)
              if (parsed.vendor_name || Array.isArray(parsed)) {
                // This is a stats JSON, send as stats event
                sendEvent('stats', { stats: parsed })
                continue // Don't send as output
              }
            } catch {
              // Not valid JSON, treat as regular output
            }
          }
          
          // Send all non-JSON lines as output
          sendEvent('output', { type: 'output', message: line + '\n' })
        }
      })

      child.stderr.on('data', (data: Buffer) => {
        const text = data.toString()
        stderrBuffer += text
        sendEvent('output', { type: 'output', message: text })
      })

      child.on('close', (code) => {
        cleanup()
        if (isCancelled) return
        
        // Try to parse final JSON output
        const allOutput = stdoutBuffer.trim()
        if (allOutput) {
          try {
            const stats = JSON.parse(allOutput)
            if (stats.vendor_name || Array.isArray(stats)) {
              sendEvent('stats', { stats })
            } else {
              // Not stats JSON, send as output
              sendEvent('output', { type: 'output', message: allOutput + '\n' })
            }
          } catch {
            // If not JSON, send as output
            if (allOutput) {
              sendEvent('output', { type: 'output', message: allOutput + '\n' })
            }
          }
        }

        if (stderrBuffer) {
          sendEvent('output', { type: 'output', message: stderrBuffer })
        }

        sendEvent('complete', { 
          type: 'complete',
          success: code === 0 && !isCancelled, 
          code,
          message: isCancelled ? 'Scraping cancelled' : (code === 0 ? 'Scraper completed successfully' : 'Scraper failed')
        })
        try {
          controller.close()
        } catch {}
      })

      child.on('error', (error) => {
        cleanup()
        if (!isCancelled) {
          sendEvent('error', { message: error.message })
          try {
            controller.close()
          } catch {}
        }
      })
    },
    cancel() {
      // Clean up when stream is cancelled
      const child = activeProcesses.get(processId)
      if (child) {
        try {
          child.kill('SIGTERM')
          setTimeout(() => {
            try {
              child.kill('SIGKILL')
            } catch {}
          }, 2000)
        } catch {}
        activeProcesses.delete(processId)
      }
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}


