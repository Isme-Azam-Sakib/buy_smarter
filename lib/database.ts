import { Client } from 'pg'
import sqlite3 from 'sqlite3'
import { open } from 'sqlite'
import path from 'path'

// Database adapter that works with both SQLite (local) and PostgreSQL (production)
export class DatabaseAdapter {
  private client: any
  private isPostgres: boolean

  constructor() {
    this.isPostgres = process.env.NODE_ENV === 'production' && !!process.env.DATABASE_URL
  }

  async connect() {
    if (this.isPostgres) {
      // Use PostgreSQL in production
      this.client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
      })
      await this.client.connect()
      console.log('Connected to PostgreSQL')
    } else {
      // Use SQLite in development
      const dbPath = path.join(process.cwd(), 'cpu_products.db')
      this.client = await open({
        filename: dbPath,
        driver: sqlite3.Database,
      })
      console.log('Connected to SQLite')
    }
  }

  async query(sql: string, params: any[] = []) {
    if (this.isPostgres) {
      // PostgreSQL query
      const result = await this.client.query(sql, params)
      return result.rows
    } else {
      // SQLite query
      return new Promise((resolve, reject) => {
        this.client.all(sql, params, (err: any, rows: any) => {
          if (err) reject(err)
          else resolve(rows)
        })
      })
    }
  }

  async get(sql: string, params: any[] = []) {
    if (this.isPostgres) {
      // PostgreSQL query
      const result = await this.client.query(sql, params)
      return result.rows[0]
    } else {
      // SQLite query
      return new Promise((resolve, reject) => {
        this.client.get(sql, params, (err: any, row: any) => {
          if (err) reject(err)
          else resolve(row)
        })
      })
    }
  }

  async close() {
    if (this.isPostgres) {
      await this.client.end()
    } else {
      await this.client.close()
    }
  }
}

// Helper function to get database instance
export async function getDatabase() {
  const db = new DatabaseAdapter()
  await db.connect()
  return db
}
