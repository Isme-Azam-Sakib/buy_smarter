import { getDatabase } from './database'

export interface VendorApplication {
  id: number
  vendor_name: string
  website_url?: string
  email: string
  phone?: string
  contact_person?: string
  additional_details?: string
  status: 'pending' | 'approved' | 'rejected'
  submitted_at: string
  reviewed_at?: string
  reviewed_by?: number
  notes?: string
  admin_user_id?: number
  vendor_id?: number // Links to vendors table if approved
}

export interface Vendor {
  id: number
  vendor_name: string
  website_url?: string
  email: string
  phone?: string
  contact_person?: string
  status: 'pending' | 'approved' | 'rejected' | 'suspended'
  created_at: string
  updated_at?: string
  approved_at?: string
  approved_by?: number
  admin_user_id?: number
  permissions?: string[]
  managed_vendor_name?: string // The vendor store this vendor user is assigned to manage
}

export interface VendorWithAdmin extends Vendor {
  admin_username?: string
  admin_email?: string
}

function parsePermissions(raw?: string | null): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function mapVendor(row: any): Vendor | null {
  if (!row) return null
  return {
    id: row.id,
    vendor_name: row.vendor_name,
    website_url: row.website_url ?? undefined,
    email: row.email,
    phone: row.phone ?? undefined,
    contact_person: row.contact_person ?? undefined,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at ?? undefined,
    approved_at: row.approved_at ?? undefined,
    approved_by: row.approved_by ?? undefined,
    admin_user_id: row.admin_user_id ?? undefined,
    permissions: parsePermissions(row.permissions),
    managed_vendor_name: row.managed_vendor_name ?? undefined,
  }
}

async function ensureVendorColumns(db: any, isPostgres: boolean) {
  if (isPostgres) {
    // Check if columns exist before adding them
    const appsColumns = await db.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'vendor_applications' AND column_name IN ('admin_user_id', 'vendor_id')
    `)
    const hasColumn = (columns: any[], name: string) =>
      columns.some((col: any) => col.column_name === name)
    
    if (!hasColumn(appsColumns, 'admin_user_id')) {
      await db.exec(`
        ALTER TABLE vendor_applications
        ADD COLUMN admin_user_id INTEGER REFERENCES admin_users(id);
      `)
    }
    
    if (!hasColumn(appsColumns, 'vendor_id')) {
      await db.exec(`
        ALTER TABLE vendor_applications
        ADD COLUMN vendor_id INTEGER REFERENCES vendors(id);
      `)
    }
    
    const vendorsColumns = await db.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'vendors' AND column_name = 'admin_user_id'
    `)
    if (vendorsColumns.length === 0) {
      await db.exec(`
        ALTER TABLE vendors
        ADD COLUMN admin_user_id INTEGER;
      `)
      // Create unique index separately
      try {
        await db.exec(`
          CREATE UNIQUE INDEX IF NOT EXISTS idx_vendors_admin_user_id ON vendors(admin_user_id)
        `)
      } catch (e: any) {
        console.warn('Could not create unique index on vendors.admin_user_id:', e.message)
      }
    }
    
    const permissionsColumns = await db.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'vendors' AND column_name = 'permissions'
    `)
    if (permissionsColumns.length === 0) {
      await db.exec(`
        ALTER TABLE vendors
        ADD COLUMN permissions TEXT DEFAULT '[]';
      `)
    }
    
    const managedVendorColumns = await db.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'vendors' AND column_name = 'managed_vendor_name'
    `)
    if (managedVendorColumns.length === 0) {
      await db.exec(`
        ALTER TABLE vendors
        ADD COLUMN managed_vendor_name VARCHAR(255);
      `)
    }
  } else {
    // SQLite doesn't support adding UNIQUE columns directly
    // So we add the column first, then create a unique index if needed
    const appsColumns = await db.all(`PRAGMA table_info(vendor_applications)`)
    const vendorsColumns = await db.all(`PRAGMA table_info(vendors)`)
    const hasColumn = (columns: any[], name: string) =>
      Array.isArray(columns) && columns.some((col: any) => col.name === name)

    if (!hasColumn(appsColumns, 'admin_user_id')) {
      await db.exec(`ALTER TABLE vendor_applications ADD COLUMN admin_user_id INTEGER`)
    }
    
    if (!hasColumn(appsColumns, 'vendor_id')) {
      await db.exec(`ALTER TABLE vendor_applications ADD COLUMN vendor_id INTEGER`)
    }

    if (!hasColumn(vendorsColumns, 'admin_user_id')) {
      // SQLite: Add column without UNIQUE constraint
      await db.exec(`ALTER TABLE vendors ADD COLUMN admin_user_id INTEGER`)
      // Then create a unique index
      try {
        await db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_vendors_admin_user_id ON vendors(admin_user_id)`)
      } catch (e: any) {
        // Index might already exist, ignore error
        if (!e.message?.includes('already exists')) {
          console.warn('Could not create unique index on admin_user_id:', e.message)
        }
      }
    }

    if (!hasColumn(vendorsColumns, 'permissions')) {
      await db.exec(`ALTER TABLE vendors ADD COLUMN permissions TEXT DEFAULT '[]'`)
    }
    
    if (!hasColumn(vendorsColumns, 'managed_vendor_name')) {
      await db.exec(`ALTER TABLE vendors ADD COLUMN managed_vendor_name TEXT`)
    }
  }
}

/**
 * Initialize vendor tables
 */
export async function initVendorTables() {
  const db = await getDatabase()
  
  try {
    // SQLite syntax
    await db.exec(`
      CREATE TABLE IF NOT EXISTS vendor_applications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vendor_name TEXT NOT NULL,
        website_url TEXT,
        email TEXT NOT NULL,
        phone TEXT,
        contact_person TEXT,
        additional_details TEXT,
        status TEXT DEFAULT 'pending',
        submitted_at TEXT NOT NULL DEFAULT (datetime('now')),
        reviewed_at TEXT,
        reviewed_by INTEGER REFERENCES admin_users(id),
        notes TEXT,
        admin_user_id INTEGER,
        vendor_id INTEGER REFERENCES vendors(id)
      )
    `)
    
    await db.exec(`
      CREATE TABLE IF NOT EXISTS vendors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vendor_name TEXT UNIQUE NOT NULL,
        website_url TEXT,
        email TEXT NOT NULL,
        phone TEXT,
        contact_person TEXT,
        status TEXT DEFAULT 'pending',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT,
        approved_at TEXT,
        approved_by INTEGER REFERENCES admin_users(id),
        admin_user_id INTEGER,
        permissions TEXT DEFAULT '[]'
      )
    `)
    
    // Create unique index for admin_user_id in SQLite
    // (UNIQUE constraint in CREATE TABLE doesn't work the same way in SQLite)
    try {
      await db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_vendors_admin_user_id ON vendors(admin_user_id)`)
    } catch (e: any) {
      // Index might already exist, ignore error
      if (!e.message?.includes('already exists')) {
        console.warn('Could not create unique index on vendors.admin_user_id:', e.message)
      }
    }

    await ensureVendorColumns(db, false)
  } finally {
    await db.close()
  }
}

/**
 * Submit a vendor application
 */
export async function submitVendorApplication(
  vendor_name: string,
  email: string,
  website_url?: string,
  phone?: string,
  contact_person?: string,
  additional_details?: string,
  admin_user_id?: number
): Promise<VendorApplication> {
  await initVendorTables()
  const db = await getDatabase()
  const submittedAt = new Date().toISOString()
  
  try {
    const isPostgres: boolean = false // SQLite only
    let result
    
    if (isPostgres) {
      const queryResult = await db.query(
        `INSERT INTO vendor_applications (vendor_name, website_url, email, phone, contact_person, additional_details, status, submitted_at, admin_user_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id`,
        [vendor_name, website_url || null, email, phone || null, contact_person || null, additional_details || null, 'pending', submittedAt, admin_user_id || null]
      )
      result = { lastID: queryResult[0]?.id }
    } else {
      result = await db.run(
        `INSERT INTO vendor_applications (vendor_name, website_url, email, phone, contact_person, additional_details, status, submitted_at, admin_user_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [vendor_name, website_url || null, email, phone || null, contact_person || null, additional_details || null, 'pending', submittedAt, admin_user_id || null]
      )
    }
    
    return {
      id: result.lastID!,
      vendor_name,
      website_url,
      email,
      phone,
      contact_person,
      additional_details,
      status: 'pending',
      submitted_at: submittedAt,
      admin_user_id,
    }
  } catch (error: any) {
    throw error
  } finally {
    await db.close()
  }
}

/**
 * Get all vendor applications
 * If application is approved and has a vendor record, use vendor status as source of truth
 */
export async function getAllVendorApplications(): Promise<VendorApplication[]> {
  await initVendorTables()
  const db = await getDatabase()
  
  try {
    const isPostgres: boolean = false // SQLite only
    
    // Join with vendors table to get real-time status for approved vendors
    const query = isPostgres
      ? `
        SELECT 
          va.*,
          v.id as vendor_id,
          COALESCE(v.status, va.status) as status
        FROM vendor_applications va
        LEFT JOIN vendors v ON v.admin_user_id = va.admin_user_id 
          AND v.vendor_name = va.vendor_name
        ORDER BY va.submitted_at DESC
      `
      : `
        SELECT 
          va.*,
          v.id as vendor_id,
          COALESCE(v.status, va.status) as status
        FROM vendor_applications va
        LEFT JOIN vendors v ON v.admin_user_id = va.admin_user_id 
          AND v.vendor_name = va.vendor_name
        ORDER BY va.submitted_at DESC
      `
    
    const applications = await db.query(query)
    return Array.isArray(applications) ? (applications as VendorApplication[]) : []
  } catch (error: any) {
    console.error('Error in getAllVendorApplications:', error)
    throw error
  } finally {
    await db.close()
  }
}

/**
 * Get pending vendor applications
 */
export async function getPendingVendorApplications(): Promise<VendorApplication[]> {
  await initVendorTables()
  const db = await getDatabase()
  
  try {
    const isPostgres: boolean = false // SQLite only
    const applications = isPostgres
      ? await db.query(
          `SELECT * FROM vendor_applications WHERE status = $1 ORDER BY submitted_at DESC`,
          ['pending']
        )
      : await db.query(
          `SELECT * FROM vendor_applications WHERE status = ? ORDER BY submitted_at DESC`,
          ['pending']
        )
    return (applications as VendorApplication[]) || []
  } finally {
    await db.close()
  }
}

/**
 * Approve a vendor application
 */
export async function approveVendorApplication(
  applicationId: number,
  approvedBy: number
): Promise<Vendor> {
  await initVendorTables()
  const db = await getDatabase()
  const now = new Date().toISOString()
  
  try {
    // Get the application
    const isPostgres = false // SQLite only
    const application = isPostgres
      ? await db.get(
          `SELECT * FROM vendor_applications WHERE id = $1`,
          [applicationId]
        )
      : await db.get(
          `SELECT * FROM vendor_applications WHERE id = ?`,
          [applicationId]
        )
    
    if (!application) {
      throw new Error('Application not found')
    }
    
    const app = application as VendorApplication
    
    // Create vendor record (or update if exists)
    let vendorResult
    const permissionsJson = JSON.stringify(['products', 'analytics'])
    
    // Check if vendor already exists for this admin_user_id
    const existingVendor = isPostgres
      ? await db.get(`SELECT * FROM vendors WHERE admin_user_id = $1`, [app.admin_user_id || -1])
      : await db.get(`SELECT * FROM vendors WHERE admin_user_id = ?`, [app.admin_user_id || -1])
    
    if (existingVendor) {
      // Update existing vendor
      if (isPostgres) {
        await db.run(
          `UPDATE vendors SET status = $1, vendor_name = $2, website_url = $3, email = $4, phone = $5, contact_person = $6, updated_at = $7, approved_at = $8, approved_by = $9 WHERE id = $10`,
          ['approved', app.vendor_name, app.website_url || null, app.email, app.phone || null, app.contact_person || null, now, now, approvedBy, existingVendor.id]
        )
        vendorResult = { lastID: existingVendor.id }
      } else {
        await db.run(
          `UPDATE vendors SET status = ?, vendor_name = ?, website_url = ?, email = ?, phone = ?, contact_person = ?, updated_at = ?, approved_at = ?, approved_by = ? WHERE id = ?`,
          ['approved', app.vendor_name, app.website_url || null, app.email, app.phone || null, app.contact_person || null, now, now, approvedBy, existingVendor.id]
        )
        vendorResult = { lastID: existingVendor.id }
      }
    } else {
      // Create new vendor record
      if (isPostgres) {
        const queryResult = await db.query(
          `INSERT INTO vendors (vendor_name, website_url, email, phone, contact_person, status, created_at, approved_at, approved_by, admin_user_id, permissions)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           RETURNING id`,
          [app.vendor_name, app.website_url || null, app.email, app.phone || null, app.contact_person || null, 'approved', now, now, approvedBy, app.admin_user_id || null, permissionsJson]
        )
        vendorResult = { lastID: queryResult[0]?.id }
      } else {
        vendorResult = await db.run(
          `INSERT INTO vendors (vendor_name, website_url, email, phone, contact_person, status, created_at, approved_at, approved_by, admin_user_id, permissions)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [app.vendor_name, app.website_url || null, app.email, app.phone || null, app.contact_person || null, 'approved', now, now, approvedBy, app.admin_user_id || null, permissionsJson]
        )
      }
    }
    
    // Update application status and link to vendor
    if (isPostgres) {
      await db.run(
        `UPDATE vendor_applications SET status = $1, reviewed_at = $2, reviewed_by = $3, vendor_id = $4 WHERE id = $5`,
        ['approved', now, approvedBy, vendorResult.lastID, applicationId]
      )
    } else {
      await db.run(
        `UPDATE vendor_applications SET status = ?, reviewed_at = ?, reviewed_by = ?, vendor_id = ? WHERE id = ?`,
        ['approved', now, approvedBy, vendorResult.lastID, applicationId]
      )
    }
    
    // Get the created vendor
    const vendorRow = isPostgres
      ? await db.get(
          `SELECT * FROM vendors WHERE id = $1`,
          [vendorResult.lastID]
        )
      : await db.get(
          `SELECT * FROM vendors WHERE id = ?`,
          [vendorResult.lastID]
        )
    
    if (app.admin_user_id) {
      if (isPostgres) {
        await db.run(
          `UPDATE admin_users SET vendor_id = $1 WHERE id = $2`,
          [vendorResult.lastID, app.admin_user_id]
        )
      } else {
        await db.run(
          `UPDATE admin_users SET vendor_id = ? WHERE id = ?`,
          [vendorResult.lastID, app.admin_user_id]
        )
      }
    }
    
    return mapVendor(vendorRow)!
  } catch (error: any) {
    throw error
  } finally {
    await db.close()
  }
}

/**
 * Reject a vendor application
 */
export async function rejectVendorApplication(
  applicationId: number,
  reviewedBy: number,
  notes?: string
): Promise<void> {
  await initVendorTables()
  const db = await getDatabase()
  const now = new Date().toISOString()
  
  try {
    const isPostgres: boolean = false // SQLite only
    if (isPostgres) {
      await db.run(
        `UPDATE vendor_applications SET status = $1, reviewed_at = $2, reviewed_by = $3, notes = $4 WHERE id = $5`,
        ['rejected', now, reviewedBy, notes || null, applicationId]
      )
    } else {
      await db.run(
        `UPDATE vendor_applications SET status = ?, reviewed_at = ?, reviewed_by = ?, notes = ? WHERE id = ?`,
        ['rejected', now, reviewedBy, notes || null, applicationId]
      )
    }
  } finally {
    await db.close()
  }
}

/**
 * Get vendor by ID
 */
export async function getVendorById(vendorId: number): Promise<Vendor | null> {
  await initVendorTables()
  const db = await getDatabase()
  
  try {
    const isPostgres: boolean = false // SQLite only
    const row = isPostgres
      ? await db.get(
          `SELECT * FROM vendors WHERE id = $1`,
          [vendorId]
        )
      : await db.get(
          `SELECT * FROM vendors WHERE id = ?`,
          [vendorId]
        )
    
    return mapVendor(row)
  } finally {
    await db.close()
  }
}

/**
 * Get all vendors
 */
export async function getAllVendors(): Promise<Vendor[]> {
  await initVendorTables()
  const db = await getDatabase()
  
  try {
    const rows = await db.query(
      `SELECT * FROM vendors ORDER BY created_at DESC`
    )
    return (rows as any[]).map((row) => mapVendor(row)!).filter(Boolean)
  } finally {
    await db.close()
  }
}

export async function getVendorByAdminUserId(adminUserId: number): Promise<Vendor | null> {
  await initVendorTables()
  const db = await getDatabase()

  try {
    const isPostgres: boolean = false // SQLite only
    const row = isPostgres
      ? await db.get(`SELECT * FROM vendors WHERE admin_user_id = $1`, [adminUserId])
      : await db.get(`SELECT * FROM vendors WHERE admin_user_id = ?`, [adminUserId])

    return mapVendor(row)
  } finally {
    await db.close()
  }
}

export async function getLatestVendorApplicationForUser(adminUserId: number): Promise<VendorApplication | null> {
  try {
    await initVendorTables()
  } catch (error: any) {
    console.error('Error initializing vendor tables:', error)
    // Continue even if initialization fails
  }
  
  const db = await getDatabase()

  try {
    const isPostgres: boolean = false // SQLite only
    const row = isPostgres
      ? await db.get(
          `SELECT * FROM vendor_applications WHERE admin_user_id = $1 ORDER BY submitted_at DESC LIMIT 1`,
          [adminUserId]
        )
      : await db.get(
          `SELECT * FROM vendor_applications WHERE admin_user_id = ? ORDER BY submitted_at DESC LIMIT 1`,
          [adminUserId]
        )

    return row as VendorApplication | null
  } catch (error: any) {
    console.error('Error fetching latest vendor application:', error)
    return null
  } finally {
    await db.close()
  }
}

export interface CreateVendorInput {
  vendor_name: string
  website_url?: string
  email: string
  phone?: string
  contact_person?: string
  status?: 'pending' | 'approved' | 'rejected' | 'suspended'
  admin_user_id?: number | null
  permissions?: string[]
  managed_vendor_name?: string | null
}

export async function getVendorsWithAdmins(): Promise<VendorWithAdmin[]> {
  await initVendorTables()
  const db = await getDatabase()

  try {
    const rows = await db.query(`
      SELECT v.*, au.username as admin_username, au.email as admin_email
      FROM vendors v
      LEFT JOIN admin_users au ON v.admin_user_id = au.id
      ORDER BY v.created_at DESC
    `)

    const vendors: VendorWithAdmin[] = []
    for (const row of rows as any[]) {
      const vendor = mapVendor(row)
      if (vendor) {
        vendors.push({
          ...vendor,
          admin_username: row.admin_username ?? undefined,
          admin_email: row.admin_email ?? undefined,
        })
      }
    }
    return vendors
  } finally {
    await db.close()
  }
}

export async function createVendorManual(data: CreateVendorInput): Promise<Vendor> {
  await initVendorTables()
  const db = await getDatabase()
  const now = new Date().toISOString()
  const permissionsJson = JSON.stringify(data.permissions ?? [])
  const status = data.status || 'pending'

  try {
    const isPostgres: boolean = false // SQLite only
    let result

    if (isPostgres) {
      const queryResult = await db.query(
        `INSERT INTO vendors (
          vendor_name, website_url, email, phone, contact_person,
          status, created_at, updated_at, admin_user_id, permissions, managed_vendor_name
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id`,
        [
          data.vendor_name,
          data.website_url || null,
          data.email,
          data.phone || null,
          data.contact_person || null,
          status,
          now,
          now,
          data.admin_user_id || null,
          permissionsJson,
          data.managed_vendor_name || null,
        ]
      )
      result = { lastID: queryResult[0]?.id }
    } else {
      result = await db.run(
        `INSERT INTO vendors (
          vendor_name, website_url, email, phone, contact_person,
          status, created_at, updated_at, admin_user_id, permissions, managed_vendor_name
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          data.vendor_name,
          data.website_url || null,
          data.email,
          data.phone || null,
          data.contact_person || null,
          status,
          now,
          now,
          data.admin_user_id || null,
          permissionsJson,
          data.managed_vendor_name || null,
        ]
      )
    }

    if (data.admin_user_id) {
      if (false) { // SQLite only
        await db.run(
          `UPDATE admin_users SET vendor_id = $1 WHERE id = $2`,
          [result.lastID, data.admin_user_id]
        )
      } else {
        await db.run(
          `UPDATE admin_users SET vendor_id = ? WHERE id = ?`,
          [result.lastID, data.admin_user_id]
        )
      }
    }

    const vendorRow = isPostgres
      ? await db.get(`SELECT * FROM vendors WHERE id = $1`, [result.lastID])
      : await db.get(`SELECT * FROM vendors WHERE id = ?`, [result.lastID])

    return mapVendor(vendorRow)!
  } finally {
    await db.close()
  }
}

export async function updateVendorRecord(
  vendorId: number,
  updates: Partial<CreateVendorInput>
): Promise<Vendor | null> {
  await initVendorTables()
  const db = await getDatabase()

  // Get current vendor to know linked admin user id before updates
  const existingVendor = await db.get(
    false // SQLite only
      ? `SELECT * FROM vendors WHERE id = $1`
      : `SELECT * FROM vendors WHERE id = ?`,
    [vendorId]
  )

  if (!existingVendor) {
    await db.close()
    return null
  }

  const columns: { column: string; value: any }[] = []

  if (updates.vendor_name !== undefined) columns.push({ column: 'vendor_name', value: updates.vendor_name })
  if (updates.website_url !== undefined) columns.push({ column: 'website_url', value: updates.website_url })
  if (updates.email !== undefined) columns.push({ column: 'email', value: updates.email })
  if (updates.phone !== undefined) columns.push({ column: 'phone', value: updates.phone })
  if (updates.contact_person !== undefined) columns.push({ column: 'contact_person', value: updates.contact_person })
  if (updates.status !== undefined) columns.push({ column: 'status', value: updates.status })
  if (updates.permissions !== undefined) {
    columns.push({ column: 'permissions', value: JSON.stringify(updates.permissions) })
  }
  if (updates.managed_vendor_name !== undefined) {
    columns.push({ column: 'managed_vendor_name', value: updates.managed_vendor_name || null })
  }
  columns.push({ column: 'updated_at', value: new Date().toISOString() })

  if (!columns.length) {
    await db.close()
    return mapVendor(existingVendor)
  }

  const isPostgres = process.env.DATABASE_URL?.startsWith('postgresql://')
  
  const assignments = columns.map(
    (field, index) => isPostgres ? `${field.column} = $${index + 1}` : `${field.column} = ?`
  )
  const params = columns.map((field) => field.value)
  params.push(vendorId)

  try {
    if (isPostgres) {
      // PostgreSQL: Use parameterized query
      await db.run(
        `UPDATE vendors SET ${assignments.join(', ')} WHERE id = $${columns.length + 1}`,
        params
      )
    } else {
      // SQLite: Use parameterized query  
      await db.run(
        `UPDATE vendors SET ${assignments.join(', ')} WHERE id = ?`,
        params
      )
    }

      const vendorRow = isPostgres
        ? await db.get(`SELECT * FROM vendors WHERE id = $1`, [vendorId])
        : await db.get(`SELECT * FROM vendors WHERE id = ?`, [vendorId])

      // Keep vendor applications in sync with vendor status
      // Update all applications linked to this vendor (use vendor table as source of truth)
      if (updates.status !== undefined) {
        if (isPostgres) {
          await db.run(
            `UPDATE vendor_applications SET status = $1 WHERE vendor_id = $2 OR (admin_user_id = $3 AND vendor_name = $4)`,
            [updates.status, vendorId, existingVendor.admin_user_id, existingVendor.vendor_name]
          )
        } else {
          await db.run(
            `UPDATE vendor_applications SET status = ? WHERE vendor_id = ? OR (admin_user_id = ? AND vendor_name = ?)`,
            [updates.status, vendorId, existingVendor.admin_user_id, existingVendor.vendor_name]
          )
        }
      }

      return mapVendor(vendorRow)
  } finally {
    await db.close()
  }
}

/**
 * Get all distinct vendor names from all_products table
 * Used for vendor store assignment dropdown
 */
export async function getProductVendorNames(): Promise<string[]> {
  const db = await getDatabase()
  try {
    const rows = await db.query(`
      SELECT DISTINCT vendor_name 
      FROM all_products 
      WHERE vendor_name IS NOT NULL 
      ORDER BY vendor_name
    `)
    return (rows as any[]).map((row) => row.vendor_name).filter(Boolean)
  } finally {
    await db.close()
  }
}

export async function deleteVendorRecord(vendorId: number): Promise<void> {
  await initVendorTables()
  const db = await getDatabase()

  try {
    const isPostgres: boolean = false // SQLite only
    const vendorRow = isPostgres
      ? await db.get(`SELECT * FROM vendors WHERE id = $1`, [vendorId])
      : await db.get(`SELECT * FROM vendors WHERE id = ?`, [vendorId])

    if (!vendorRow) {
      return
    }

    if (isPostgres) {
      await db.run(`DELETE FROM vendors WHERE id = $1`, [vendorId])
    } else {
      await db.run(`DELETE FROM vendors WHERE id = ?`, [vendorId])
    }

    if (vendorRow.admin_user_id) {
      if (isPostgres) {
        await db.run(`UPDATE admin_users SET vendor_id = NULL WHERE id = $1`, [
          vendorRow.admin_user_id,
        ])
      } else {
        await db.run(`UPDATE admin_users SET vendor_id = NULL WHERE id = ?`, [
          vendorRow.admin_user_id,
        ])
      }
    }
  } finally {
    await db.close()
  }
}

