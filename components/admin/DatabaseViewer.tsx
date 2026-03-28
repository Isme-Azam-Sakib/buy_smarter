'use client'

import { useEffect, useState } from 'react'
import { Database, Search, ChevronLeft, ChevronRight, RefreshCw, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'
import { CustomInput } from '@/components/ui/CustomInput'

// Helper function to format date values
function formatCellValue(value: any, columnName: string, dataType: string): string {
  if (value === null || value === undefined) {
    return ''
  }

  // Check if this is a date column
  const isDateColumn = 
    columnName.toLowerCase().includes('date') ||
    columnName.toLowerCase().includes('time') ||
    columnName.toLowerCase().endsWith('_at') ||
    dataType.toLowerCase().includes('timestamp') ||
    dataType.toLowerCase().includes('date') ||
    dataType.toLowerCase().includes('time')

  if (isDateColumn) {
    try {
      // Try to parse as date
      const date = new Date(value)
      if (!isNaN(date.getTime())) {
        // Format as YYYY-MM-DD HH:MM:SS
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const day = String(date.getDate()).padStart(2, '0')
        const hours = String(date.getHours()).padStart(2, '0')
        const minutes = String(date.getMinutes()).padStart(2, '0')
        const seconds = String(date.getSeconds()).padStart(2, '0')
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
      }
    } catch (e) {
      // If parsing fails, return as string
    }
  }

  // For non-date values, return as string
  return String(value)
}

interface Table {
  name: string
}

interface Column {
  column_name: string
  data_type: string
  is_nullable: string
  column_default: any
}

interface TableData {
  tableName: string
  columns: Column[]
  data: any[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

type SortOrder = 'asc' | 'desc' | null

export default function DatabaseViewer() {
  const [tables, setTables] = useState<Table[]>([])
  const [selectedTable, setSelectedTable] = useState<string | null>(null)
  const [tableData, setTableData] = useState<TableData | null>(null)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(50)
  const [sortBy, setSortBy] = useState<string | null>(null)
  const [sortOrder, setSortOrder] = useState<SortOrder>(null)

  useEffect(() => {
    fetchTables()
  }, [])

  useEffect(() => {
    if (selectedTable) {
      fetchTableData()
    }
  }, [selectedTable, page, limit, search, sortBy, sortOrder])

  const fetchTables = async () => {
    try {
      const response = await fetch('/api/admin/database/tables')
      const data = await response.json()
      setTables(data.tables || [])
      if (data.tables && data.tables.length > 0 && !selectedTable) {
        setSelectedTable(data.tables[0].name)
      }
    } catch (error) {
      console.error('Failed to fetch tables:', error)
    }
  }

  const fetchTableData = async () => {
    if (!selectedTable) return
    
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      })
      if (search) {
        params.append('search', search)
      }
      if (sortBy && sortOrder) {
        params.append('sortBy', sortBy)
        params.append('sortOrder', sortOrder)
      }
      
      const response = await fetch(
        `/api/admin/database/table/${encodeURIComponent(selectedTable)}?${params}`
      )
      const data = await response.json()
      setTableData(data)
    } catch (error) {
      console.error('Failed to fetch table data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (value: string) => {
    setSearch(value)
    setPage(1) // Reset to first page on search
  }

  const handleSort = (columnName: string) => {
    if (sortBy === columnName) {
      // Cycle through: asc -> desc -> null
      if (sortOrder === 'asc') {
        setSortOrder('desc')
      } else if (sortOrder === 'desc') {
        setSortBy(null)
        setSortOrder(null)
      }
    } else {
      // New column: start with asc
      setSortBy(columnName)
      setSortOrder('asc')
    }
    setPage(1) // Reset to first page on sort
  }

  const getSortIcon = (columnName: string) => {
    if (sortBy !== columnName) {
      return <ArrowUpDown className="h-4 w-4 text-gray-400" />
    }
    if (sortOrder === 'asc') {
      return <ArrowUp className="h-4 w-4 text-purple-600" />
    }
    if (sortOrder === 'desc') {
      return <ArrowDown className="h-4 w-4 text-purple-600" />
    }
    return <ArrowUpDown className="h-4 w-4 text-gray-400" />
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Database Viewer</h1>
        <p className="text-gray-600">Browse and search database tables</p>
      </div>

      {/* Tables Selection - Full Width Horizontal */}
      <div className="mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Tables</h2>
            <button
              onClick={fetchTables}
              className="text-gray-500 hover:text-gray-700 transition-colors"
              title="Refresh tables"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {tables.map((table) => (
              <button
                key={table.name}
                onClick={() => {
                  setSelectedTable(table.name)
                  setPage(1)
                  setSearch('')
                  setSortBy(null)
                  setSortOrder(null)
                }}
                className={`
                  inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm
                  transition-colors border
                  ${
                    selectedTable === table.name
                      ? 'bg-purple-50 text-purple-700 font-medium border-purple-200'
                      : 'text-gray-700 hover:bg-gray-50 border-gray-200'
                  }
                `}
              >
                <Database className="h-4 w-4" />
                <span>{table.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table Content - Full Width */}
      <div className="w-full">
          {selectedTable ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
              {/* Table Header */}
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">{selectedTable}</h2>
                    {tableData && (
                      <p className="text-sm text-gray-600 mt-1">
                        {tableData.pagination.total.toLocaleString()} total rows
                      </p>
                    )}
                  </div>
                </div>

                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <CustomInput
                  placeholder="Search in table..."
                  value={search}
                  onChange={(value) => handleSearch(value)}
                  className="w-full"
                  inputClassName="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  label=""
                />
                </div>
              </div>

              {/* Table Schema */}
              {tableData && tableData.columns.length > 0 && (
                <div className="p-4 bg-gray-50 border-b border-gray-200">
                  <details className="text-sm">
                    <summary className="cursor-pointer text-gray-700 font-medium">
                      Table Schema ({tableData.columns.length} columns)
                    </summary>
                    <div className="mt-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                      {tableData.columns.map((col) => (
                        <div
                          key={col.column_name}
                          className="bg-white p-2 rounded border border-gray-200"
                        >
                          <div className="font-medium text-gray-900">{col.column_name}</div>
                          <div className="text-xs text-gray-600">
                            {col.data_type}
                            {col.is_nullable === 'YES' && ' (nullable)'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </details>
                </div>
              )}

              {/* Table Data */}
              <div className="overflow-x-auto">
                {loading ? (
                  <div className="p-8 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Loading data...</p>
                  </div>
                ) : tableData && tableData.data.length > 0 ? (
                  <>
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          {tableData.columns.map((col) => (
                            <th
                              key={col.column_name}
                              className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors select-none"
                              onClick={() => handleSort(col.column_name)}
                              title={`Click to sort by ${col.column_name}`}
                            >
                              <div className="flex items-center gap-2">
                                <span>{col.column_name}</span>
                                {getSortIcon(col.column_name)}
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {tableData.data.map((row, rowIdx) => (
                          <tr key={rowIdx} className="hover:bg-gray-50 transition-colors">
                            {tableData.columns.map((col) => {
                              const cellValue = row[col.column_name]
                              const cellText = cellValue !== null && cellValue !== undefined
                                ? formatCellValue(cellValue, col.column_name, col.data_type)
                                : null
                              const isLongText = cellText && cellText.length > 50
                              
                              return (
                                <td
                                  key={col.column_name}
                                  className="px-4 py-3 text-sm text-gray-900"
                                  title={cellText || 'null'}
                                >
                                  {cellText ? (
                                    <div className={`${isLongText ? 'max-w-md truncate' : ''}`}>
                                      {cellText}
                                    </div>
                                  ) : (
                                    <span className="text-gray-400 italic">null</span>
                                  )}
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {/* Pagination */}
                    {tableData.pagination.totalPages > 1 && (
                      <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <span className="text-sm text-gray-700">
                            Showing {(page - 1) * limit + 1} to{' '}
                            {Math.min(page * limit, tableData.pagination.total)} of{' '}
                            {tableData.pagination.total.toLocaleString()} results
                          </span>
                          <select
                            value={limit}
                            onChange={(e) => {
                              setLimit(Number(e.target.value))
                              setPage(1)
                            }}
                            className="px-3 py-1 border border-gray-300 rounded-lg text-sm"
                          >
                            <option value={25}>25 per page</option>
                            <option value={50}>50 per page</option>
                            <option value={100}>100 per page</option>
                            <option value={200}>200 per page</option>
                          </select>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="px-3 py-1 border border-gray-300 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </button>
                          <span className="text-sm text-gray-700">
                            Page {page} of {tableData.pagination.totalPages}
                          </span>
                          <button
                            onClick={() =>
                              setPage((p) => Math.min(tableData.pagination.totalPages, p + 1))
                            }
                            disabled={page === tableData.pagination.totalPages}
                            className="px-3 py-1 border border-gray-300 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="p-8 text-center text-gray-500">
                    {search ? 'No results found' : 'No data in this table'}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
              <Database className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">Select a table to view its data</p>
            </div>
          )}
      </div>
    </div>
  )
}

