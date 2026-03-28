const { Client } = require('pg')
const sqlite3 = require('sqlite3')
const { open } = require('sqlite')
const path = require('path')

/**
 * Migrate all_products table from SQLite (final_products.db) to PostgreSQL (Vercel)
 * This script:
 * 1. Reads from final_products.db (local SQLite) - all_products table
 * 2. Creates all_products table in PostgreSQL if it doesn't exist
 * 3. Migrates all data to PostgreSQL
 * 4. Does NOT affect local SQLite database
 */
async function migrateAllProductsToPostgres() {
  console.log('🚀 Migrating all_products from SQLite to PostgreSQL...')
  
  // Check if DATABASE_URL is set
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable not set!')
    console.log('Please set your Vercel Postgres connection string:')
    console.log('export DATABASE_URL="postgres://username:password@host:port/database?sslmode=require"')
    process.exit(1)
  }

  // Connect to PostgreSQL
  const pgClient = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  })

  let sqliteDb
  try {
    await pgClient.connect()
    console.log('✅ Connected to PostgreSQL')

    // Connect to local SQLite
    const sqlitePath = path.join(__dirname, '..', 'final_products.db')
    sqliteDb = await open({
      filename: sqlitePath,
      driver: sqlite3.Database,
    })
    console.log('✅ Connected to SQLite:', sqlitePath)

    // Check if all_products table exists in SQLite
    const tableCheck = await sqliteDb.get(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='all_products'"
    )
    
    if (!tableCheck) {
      console.error('❌ all_products table not found in SQLite database!')
      console.log('Make sure final_products.db exists and contains all_products table.')
      process.exit(1)
    }

    // Get schema from SQLite to create matching PostgreSQL table
    const schema = await sqliteDb.all('PRAGMA table_info(all_products)')
    console.log(`📋 Found ${schema.length} columns in all_products table`)

    // Create table in PostgreSQL with matching schema
    // Convert SQLite types to PostgreSQL types
    const pgColumns = []
    let hasIdColumn = false
    
    for (const col of schema) {
      const name = col.name
      let pgType = 'TEXT' // Default
      let isPrimaryKey = false
      
      if (name === 'id') {
        hasIdColumn = true
        // Use SERIAL for auto-increment, but we'll insert explicit IDs
        pgType = 'INTEGER'
        isPrimaryKey = true
      } else if (col.type.toUpperCase().includes('INTEGER')) {
        pgType = 'INTEGER'
      } else if (col.type.toUpperCase().includes('REAL') || col.type.toUpperCase().includes('DECIMAL')) {
        pgType = 'DECIMAL(10,2)'
      } else if (col.type.toUpperCase().includes('TEXT')) {
        pgType = 'TEXT'
      } else if (col.type.toUpperCase().includes('VARCHAR')) {
        const match = col.type.match(/VARCHAR\((\d+)\)/i)
        pgType = match ? `VARCHAR(${match[1]})` : 'VARCHAR(255)'
      }
      
      if (isPrimaryKey) {
        pgColumns.push(`${name} ${pgType} PRIMARY KEY`)
      } else {
        pgColumns.push(`${name} ${pgType}`)
      }
    }
    
    const pgSchema = pgColumns.join(',\n        ')

    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS all_products (
        ${pgSchema}
      )
    `

    console.log('📝 Creating all_products table in PostgreSQL...')
    await pgClient.query(createTableSQL)
    console.log('✅ Created all_products table in PostgreSQL')

    // Check if table already has data
    const existingCount = await pgClient.query('SELECT COUNT(*) as count FROM all_products')
    const existingRows = parseInt(existingCount.rows[0].count)
    
    if (existingRows > 0) {
      console.log(`⚠️  Table already has ${existingRows} rows.`)
      console.log('Options:')
      console.log('  1. Clear existing data and re-migrate (recommended for first migration)')
      console.log('  2. Skip migration')
      console.log('  3. Append new data (may create duplicates)')
      
      // For automated runs, clear and re-migrate
      console.log('🗑️  Clearing existing data...')
      // Use DELETE instead of TRUNCATE to avoid issues with foreign keys
      await pgClient.query('DELETE FROM all_products')
      // Reset sequence if using SERIAL
      try {
        await pgClient.query('ALTER SEQUENCE all_products_id_seq RESTART WITH 1')
      } catch (e) {
        // Sequence might not exist if id is INTEGER, not SERIAL
      }
      console.log('✅ Cleared existing data')
    }

    // Get all data from SQLite
    const rows = await sqliteDb.all('SELECT * FROM all_products')
    console.log(`📊 Found ${rows.length} products in SQLite all_products table`)

    if (rows.length === 0) {
      console.log('⚠️  No products to migrate!')
      return
    }

    // Get column names
    const columnNames = schema.map(col => col.name)
    const columnList = columnNames.join(', ')
    const placeholders = columnNames.map((_, i) => `$${i + 1}`).join(', ')

    // Insert data into PostgreSQL in batches
    const batchSize = 100
    let inserted = 0
    let errors = 0

    console.log('📤 Migrating products...')
    
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize)
      
      for (const row of batch) {
        try {
          // Build values array in the same order as columns
          const values = columnNames.map(colName => {
            const value = row[colName]
            // Handle null values and convert types
            if (value === null || value === undefined) {
              return null
            }
            // Convert SQLite REAL to number for PostgreSQL
            const colInfo = schema.find(c => c.name === colName)
            if (colInfo?.type.toUpperCase().includes('REAL') || colName === 'price_bdt' || colName === 'ml_confidence') {
              return parseFloat(value) || null
            }
            // Convert INTEGER to number (but preserve id as-is)
            if (colInfo?.type.toUpperCase().includes('INTEGER') && colName !== 'id') {
              return parseInt(value) || null
            }
            return value
          })

          await pgClient.query(
            `INSERT INTO all_products (${columnList}) VALUES (${placeholders})`,
            values
          )
          inserted++
        } catch (error) {
          errors++
          if (errors <= 5) {
            console.error(`❌ Error inserting row ${row.id || 'unknown'}:`, error.message)
          }
          if (errors === 6) {
            console.error('❌ More errors occurred, but suppressing further error messages...')
          }
        }
      }

      if ((i + batchSize) % 500 === 0 || (i + batchSize) >= rows.length) {
        console.log(`📤 Migrated ${Math.min(i + batchSize, rows.length)}/${rows.length} products...`)
      }
    }

    console.log(`\n✅ Migration complete!`)
    console.log(`   ✅ Successfully migrated: ${inserted} products`)
    if (errors > 0) {
      console.log(`   ⚠️  Errors: ${errors} products`)
    }

    // Verify migration
    const pgCount = await pgClient.query('SELECT COUNT(*) as count FROM all_products')
    const pgRows = parseInt(pgCount.rows[0].count)
    console.log(`\n📊 Verification:`)
    console.log(`   SQLite: ${rows.length} products`)
    console.log(`   PostgreSQL: ${pgRows} products`)
    
    if (pgRows === rows.length) {
      console.log('✅ Migration verified successfully!')
    } else {
      console.log(`⚠️  Row count mismatch. Expected ${rows.length}, got ${pgRows}`)
    }

    console.log('\n🎉 Your all_products table is now in PostgreSQL!')
    console.log('💡 You can now use it in Vercel by setting PRODUCTS_TABLE_NAME=all_products (or leave it as default)')

  } catch (error) {
    console.error('❌ Migration error:', error)
    process.exit(1)
  } finally {
    if (sqliteDb) {
      await sqliteDb.close()
    }
    await pgClient.end()
  }
}

// Run migration
if (require.main === module) {
  migrateAllProductsToPostgres()
    .then(() => {
      console.log('\n✅ Migration script completed')
      process.exit(0)
    })
    .catch((error) => {
      console.error('\n❌ Migration failed:', error)
      process.exit(1)
    })
}

module.exports = { migrateAllProductsToPostgres }

