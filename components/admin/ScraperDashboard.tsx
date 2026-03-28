'use client'

import { useEffect, useState } from 'react'
import { Play, X } from 'lucide-react'

interface Vendor {
  slug: string
  name: string
}

interface LogEntry {
  id: string
  vendor: string
  timestamp: string
  output: string
  status: 'pending' | 'success' | 'error'
  stats?: SyncStatsResponse[]
}

interface SyncEventResponse {
  action: 'insert' | 'update' | 'skip'
  raw_name: string
  category: string
  product_url?: string
  price_bdt?: number
  availability_status: string
  price_changed?: boolean
  availability_changed?: boolean
  skip_reason?: string
}

interface SyncStatsResponse {
  vendor_name: string
  total_scraped: number
  updated: number
  inserted: number
  skipped: number
  events: SyncEventResponse[]
}

export default function ScraperDashboard() {
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [abortController, setAbortController] = useState<AbortController | null>(null)
  const [currentProcessId, setCurrentProcessId] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/scrapers')
      .then((res) => res.json())
      .then((data) => setVendors(data.vendors || []))
      .catch((err) => console.error('Failed to fetch vendors:', err))
  }, [])

  const runScraper = async (vendorSlug: string) => {
    setIsLoading(true)
    const logId = `${vendorSlug}-${Date.now()}`
    
    const newLog: LogEntry = {
      id: logId,
      vendor: vendorSlug,
      timestamp: new Date().toLocaleString(),
      output: '',
      status: 'pending',
    }
    
    setLogs((prev) => [newLog, ...prev])
    
    const controller = new AbortController()
    setAbortController(controller)
    
    try {
      // Use POST with stream=true to enable real-time streaming
      const response = await fetch('/api/scrapers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          vendor: vendorSlug,
          stream: true,
        }),
        signal: controller.signal,
      })

      if (!response.ok) {
        throw new Error('Failed to start scraper')
      }

      // Check if response is SSE (text/event-stream)
      const contentType = response.headers.get('content-type')
      if (!contentType?.includes('text/event-stream')) {
        throw new Error('Expected SSE stream but got: ' + contentType)
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let processId: string | null = null
      let buffer = ''

      if (!reader) {
        throw new Error('No response body')
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || '' // Keep incomplete line in buffer

        for (const line of lines) {
          if (!line.trim()) continue

          // Parse SSE format: "event: <event>\ndata: <json>\n\n"
          if (line.startsWith('event: ')) {
            const eventType = line.substring(7).trim()
            continue
          }
          
          if (line.startsWith('data: ')) {
            try {
              const jsonStr = line.substring(6).trim()
              const data = JSON.parse(jsonStr)
              
              if (data.processId) {
                processId = data.processId
                setCurrentProcessId(processId)
              }
              
              // Handle different event types
              if (data.message) {
                // Output message
                setLogs((prev) =>
                  prev.map((log) =>
                    log.id === logId
                      ? { ...log, output: log.output + data.message }
                      : log
                  )
                )
              }
              
              // Handle stats data (can be in data.stats or directly in data)
              if (data.stats) {
                setLogs((prev) =>
                  prev.map((log) =>
                    log.id === logId
                      ? { ...log, stats: Array.isArray(data.stats) ? data.stats : [data.stats], status: 'success' }
                      : log
                  )
                )
              } else if (data.vendor_name || Array.isArray(data)) {
                // Legacy format - stats directly in data
                setLogs((prev) =>
                  prev.map((log) =>
                    log.id === logId
                      ? { ...log, stats: Array.isArray(data) ? data : [data], status: 'success' }
                      : log
                  )
                )
              }
              
              if (data.success !== undefined) {
                // Complete event
                setLogs((prev) =>
                  prev.map((log) =>
                    log.id === logId
                      ? { ...log, status: data.success ? 'success' : 'error', output: log.output + (data.message ? '\n' + data.message : '') }
                      : log
                  )
                )
                setCurrentProcessId(null)
              }
            } catch (e) {
              // Not valid JSON, treat as plain output
              const text = line.substring(6).trim()
              if (text) {
                setLogs((prev) =>
                  prev.map((log) =>
                    log.id === logId
                      ? { ...log, output: log.output + text + '\n' }
                      : log
                  )
                )
              }
            }
          }
        }
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        setLogs((prev) =>
          prev.map((log) =>
            log.id === logId
              ? { ...log, status: 'error', output: log.output + '\n[CANCELLED]' }
              : log
          )
        )
      } else {
        setLogs((prev) =>
          prev.map((log) =>
            log.id === logId
              ? { ...log, status: 'error', output: log.output + '\n[ERROR] ' + error.message }
              : log
          )
        )
      }
      setCurrentProcessId(null)
    } finally {
      setIsLoading(false)
      setAbortController(null)
    }
  }

  const cancelScraper = async () => {
    if (currentProcessId) {
      try {
        await fetch('/api/scrapers/cancel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ processId: currentProcessId }),
        })
        abortController?.abort()
        setCurrentProcessId(null)
      } catch (error) {
        console.error('Failed to cancel scraper:', error)
      }
    }
  }

  const runAllScrapers = async () => {
    for (const vendor of vendors) {
      await runScraper(vendor.slug)
      // Wait a bit between scrapers to avoid overwhelming the system
      await new Promise((resolve) => setTimeout(resolve, 2000))
    }
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Bulk Scraper</h1>
          <p className="text-gray-600">Manually initialize scraping for vendors</p>
        </div>
        {isLoading && currentProcessId && (
          <button
            onClick={cancelScraper}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
          >
            <X className="h-4 w-4" />
            Cancel
          </button>
        )}
      </div>
        <div className="mb-6">
          <button
            onClick={runAllScrapers}
            disabled={isLoading}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2"
          >
            <Play className="h-5 w-5" />
            Run All Scrapers
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {vendors.map((vendor) => (
            <div
              key={vendor.slug}
              className="bg-white rounded-lg shadow-md p-4 flex items-center justify-between"
            >
              <div>
                <h3 className="font-semibold text-gray-900">{vendor.name}</h3>
                <p className="text-sm text-gray-600">{vendor.slug}</p>
              </div>
              <button
                onClick={() => runScraper(vendor.slug)}
                disabled={isLoading}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2"
              >
                <Play className="h-4 w-4" />
                Run
              </button>
            </div>
          ))}
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">Activity Logs</h2>
          {logs.length === 0 ? (
            <div className="bg-white rounded-lg shadow-md p-8 text-center text-gray-500">
              No scraping activity yet. Click &quot;Run&quot; on a vendor to start.
            </div>
          ) : (
            logs.map((log) => (
              <div
                key={log.id}
                className="bg-white rounded-lg shadow-md p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-gray-900">{log.vendor}</h3>
                    <p className="text-sm text-gray-600">{log.timestamp}</p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-medium ${
                      log.status === 'success'
                        ? 'bg-green-100 text-green-800'
                        : log.status === 'error'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}
                  >
                    {log.status}
                  </span>
                </div>

                {log.output && (
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Output:</h4>
                    <pre className="bg-gray-50 p-4 rounded-lg text-xs overflow-x-auto max-h-64 overflow-y-auto">
                      {log.output}
                    </pre>
                  </div>
                )}

                {log.stats && log.stats.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Statistics:</h4>
                    {log.stats.map((stat, idx) => (
                      <div key={idx} className="bg-gray-50 rounded-lg p-4 mb-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                          <div>
                            <div className="text-sm text-gray-600">Total Scraped</div>
                            <div className="text-lg font-semibold">{stat.total_scraped}</div>
                          </div>
                          <div>
                            <div className="text-sm text-gray-600">Updated</div>
                            <div className="text-lg font-semibold text-blue-600">{stat.updated}</div>
                          </div>
                          <div>
                            <div className="text-sm text-gray-600">Inserted</div>
                            <div className="text-lg font-semibold text-green-600">{stat.inserted}</div>
                          </div>
                          <div>
                            <div className="text-sm text-gray-600">Skipped</div>
                            <div className="text-lg font-semibold text-orange-600">{stat.skipped}</div>
                          </div>
                        </div>

                        {stat.events && stat.events.length > 0 && (
                          <div className="mt-4">
                            <h5 className="text-sm font-medium text-gray-700 mb-2">Recent Events:</h5>
                            <div className="overflow-x-auto">
                              <table className="min-w-full text-xs">
                                <thead className="bg-gray-100">
                                  <tr>
                                    <th className="px-2 py-1 text-left">Action</th>
                                    <th className="px-2 py-1 text-left">Product</th>
                                    <th className="px-2 py-1 text-left">Price</th>
                                    <th className="px-2 py-1 text-left">Status</th>
                                    <th className="px-2 py-1 text-left">Changes</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {stat.events.slice(0, 10).map((event, eventIdx) => (
                                    <tr key={eventIdx} className="border-b">
                                      <td className="px-2 py-1">
                                        <span
                                          className={`px-2 py-0.5 rounded text-xs ${
                                            event.action === 'insert'
                                              ? 'bg-green-100 text-green-800'
                                              : event.action === 'update'
                                              ? 'bg-blue-100 text-blue-800'
                                              : 'bg-gray-100 text-gray-800'
                                          }`}
                                        >
                                          {event.action}
                                        </span>
                                      </td>
                                      <td className="px-2 py-1 truncate max-w-xs" title={event.raw_name}>
                                        {event.raw_name}
                                      </td>
                                      <td className="px-2 py-1">
                                        {event.price_bdt
                                          ? `৳${event.price_bdt.toLocaleString()}${event.price_changed ? ' (price updated)' : ''}`
                                          : '-'}
                                      </td>
                                      <td className="px-2 py-1">
                                        {event.availability_status}
                                        {event.availability_changed ? ' (stock updated)' : ''}
                                      </td>
                                      <td className="px-2 py-1">
                                        {event.skip_reason ? (
                                          <span className="text-orange-600" title={event.skip_reason}>
                                            Skipped
                                          </span>
                                        ) : (
                                          <span className="text-gray-500">-</span>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
    </div>
  )
}

