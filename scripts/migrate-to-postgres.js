const { Client } = require('pg')
const sqlite3 = require('sqlite3')
const { open } = require('sqlite')
const path = require('path')

async function migrateToPostgres() {
  // SQLite connection
  const sqliteDb = await open({
    filename: path.join(__dirname, '..', 'cpu_products.db'),
    driver: sqlite3.Database,
  })

  // PostgreSQL connection (replace with your Vercel Postgres URL)
  const pgClient = new Client({
    connectionString: process.env.DATABASE_URL, // Set this in Vercel
    ssl: { rejectUnauthorized: false }
  })

  try {
    await pgClient.connect()
    console.log('Connected to PostgreSQL')

    // Create table in PostgreSQL
    await pgClient.query(`
      CREATE TABLE IF NOT EXISTS cpu_products (
        id SERIAL PRIMARY KEY,
        standard_name VARCHAR(255),
        brand VARCHAR(100),
        vendor_name VARCHAR(255),
        raw_name TEXT,
        price_bdt DECIMAL(10,2),
        availability_status VARCHAR(50),
        product_url TEXT,
        image_url TEXT,
        description TEXT,
        scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    console.log('Created table in PostgreSQL')

    // Get all data from SQLite
    const rows = await sqliteDb.all('SELECT * FROM cpu_products')
    console.log(`Found ${rows.length} products in SQLite`)

    // Insert data into PostgreSQL
    for (const row of rows) {
      await pgClient.query(`
        INSERT INTO cpu_products (
          standard_name, brand, vendor_name, raw_name, 
          price_bdt, availability_status, product_url, 
          image_url, description, scraped_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        row.standard_name,
        row.brand,
        row.vendor_name,
        row.raw_name,
        row.price_bdt,
        row.availability_status,
        row.product_url,
        row.image_url,
        row.description,
        row.scraped_at
      ])
    }

    console.log(`Successfully migrated ${rows.length} products to PostgreSQL`)

  } catch (error) {
    console.error('Migration error:', error)
  } finally {
    await sqliteDb.close()
    await pgClient.end()
  }
}

migrateToPostgres()
