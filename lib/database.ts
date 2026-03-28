import sqlite3 from 'sqlite3'
import { open } from 'sqlite'
import path from 'path'

// Database adapter - SQLite only
export class DatabaseAdapter {
  private client: any

  constructor() {
    // Always use SQLite
  }

  async connect() {
    // Use SQLite - try final_products.db first, fallback to cpu_products.db
    const finalDbPath = path.join(process.cwd(), 'final_products.db')
    const cpuDbPath = path.join(process.cwd(), 'cpu_products.db')
    const fs = require('fs')
    
    let dbPath = finalDbPath
    if (!fs.existsSync(finalDbPath) && fs.existsSync(cpuDbPath)) {
      dbPath = cpuDbPath
      console.log('Using cpu_products.db (final_products.db not found)')
    } else {
      console.log('Using final_products.db')
    }
    
    this.client = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })
    console.log('Connected to SQLite:', dbPath)
  }

  // Convert PostgreSQL syntax to SQLite
  private convertSQL(sql: string): string {
    // Convert PostgreSQL syntax to SQLite
    // Replace $1, $2, etc. with ? placeholders
    let converted = sql.replace(/\$(\d+)/g, '?')
    // Replace STRING_AGG(DISTINCT col, ',') with GROUP_CONCAT(DISTINCT col, ',')
    converted = converted.replace(/STRING_AGG\s*\(\s*DISTINCT\s+([^,]+),\s*'([^']+)'\s*\)/gi, "GROUP_CONCAT(DISTINCT $1, '$2')")
    // Replace STRING_AGG(col, ',') with GROUP_CONCAT(col, ',')
    converted = converted.replace(/STRING_AGG\s*\(([^,]+),\s*'([^']+)'\s*\)/gi, "GROUP_CONCAT($1, '$2')")
    // Replace ILIKE with LIKE (case-insensitive in SQLite needs different approach)
    converted = converted.replace(/ILIKE/gi, 'LIKE')
    return converted
  }

  async query(sql: string, params: any[] = []) {
    const convertedSQL = this.convertSQL(sql)
    try {
      return await this.client.all(convertedSQL, params)
    } catch (err) {
      console.error('SQLite query error:', err)
      console.error('SQL:', convertedSQL)
      console.error('Params:', params)
      throw err
    }
  }

  async get(sql: string, params: any[] = []) {
    const convertedSQL = this.convertSQL(sql)
    try {
      return await this.client.get(convertedSQL, params)
    } catch (err) {
      console.error('SQLite get error:', err)
      console.error('SQL:', convertedSQL)
      console.error('Params:', params)
      throw err
    }
  }

  async exec(sql: string) {
    const convertedSQL = this.convertSQL(sql)
    await this.client.exec(convertedSQL)
  }

  async run(sql: string, params: any[] = []) {
    const convertedSQL = this.convertSQL(sql)
    const result = await this.client.run(convertedSQL, params)
    return {
      lastID: result.lastID || null,
      changes: result.changes || 0,
    }
  }

  async all<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    return this.query(sql, params) as Promise<T[]>
  }

  async close() {
    await this.client.close()
  }
}

// Helper function to get database instance
export async function getDatabase() {
  const db = new DatabaseAdapter()
  await db.connect()
  return db
}
