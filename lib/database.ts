import { Client } from 'pg'
import sqlite3 from 'sqlite3'
import { open } from 'sqlite'
import path from 'path'

// Database adapter that works with both SQLite (local) and PostgreSQL (production)
export class DatabaseAdapter {
  private client: any
  private isPostgres: boolean

  constructor() {
    // Always use PostgreSQL (Neon) for both development and production
    this.isPostgres = true
  }

  async connect() {
    if (this.isPostgres) {
      // Use PostgreSQL (Neon) - hardcoded for now
      const connectionString = process.env.DATABASE_URL || "postgresql://neondb_owner:npg_qF5HuDTGX6LI@ep-icy-frost-ad6vx0uq-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require"
      
      console.log('Connecting to PostgreSQL with URL:', connectionString.substring(0, 50) + '...')
      this.client = new Client({
        connectionString: connectionString,
        ssl: { rejectUnauthorized: false }
      })
      await this.client.connect()
      console.log('Connected to PostgreSQL successfully')
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
