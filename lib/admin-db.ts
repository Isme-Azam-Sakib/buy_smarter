import { getDatabase } from './database'
import crypto from 'crypto'

export interface AdminUser {
  id: number
  username: string
  email: string
  password_hash: string
  created_at: string
  last_login?: string
  role: 'superadmin' | 'vendor'
  vendor_id?: number | null
  permissions?: string[]
}

type AdminRole = 'superadmin' | 'vendor'

function parsePermissions(raw?: string | null): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function mapDbUser(row: any): AdminUser | null {
  if (!row) return null
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    password_hash: row.password_hash,
    created_at: row.created_at,
    last_login: row.last_login ?? undefined,
    role: (row.role as AdminRole) || 'superadmin',
    vendor_id: row.vendor_id ?? undefined,
    permissions: parsePermissions(row.permissions),
  }
}

async function ensureAdminUserColumns(db: any) {
  // SQLite only - check for columns and add if missing
  const columns = await db.all(`PRAGMA table_info(admin_users)`)
  const hasColumn = (name: string) =>
    Array.isArray(columns) && columns.some((col: any) => col.name === name)

  if (!hasColumn('role')) {
    await db.exec(`ALTER TABLE admin_users ADD COLUMN role TEXT DEFAULT 'superadmin'`)
  }

  if (!hasColumn('vendor_id')) {
    await db.exec(`ALTER TABLE admin_users ADD COLUMN vendor_id INTEGER`)
  }

  if (!hasColumn('permissions')) {
    await db.exec(`ALTER TABLE admin_users ADD COLUMN permissions TEXT DEFAULT '[]'`)
  }
}

/**
 * Initialize admin users table
 */
export async function initAdminTable() {
  const db = await getDatabase()
  
  try {
    // Create admin_users table if it doesn't exist - SQLite only
    await db.exec(`
      CREATE TABLE IF NOT EXISTS admin_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        last_login TEXT
      )
    `)

    await ensureAdminUserColumns(db)
  } finally {
    await db.close()
  }
}

/**
 * Hash password using SHA-256 (simple hashing for now, can upgrade to bcrypt later)
 */
export function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex')
}

/**
 * Verify password
 */
export function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash
}

/**
 * Create a new admin user
 */
interface CreateAdminUserOptions {
  role?: AdminRole
  vendorId?: number | null
  permissions?: string[]
}

export async function createAdminUser(
  username: string,
  email: string,
  password: string,
  options: CreateAdminUserOptions = {}
): Promise<AdminUser> {
  await initAdminTable()
  const db = await getDatabase()

  const passwordHash = hashPassword(password)
  const createdAt = new Date().toISOString()
  const role: AdminRole = options.role || 'superadmin'
  const vendorId = options.vendorId ?? null
  const permissionsJson = JSON.stringify(options.permissions ?? [])
  
  try {
    // SQLite only
    const result = await db.run(
      `INSERT INTO admin_users (username, email, password_hash, created_at, role, vendor_id, permissions)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [username, email, passwordHash, createdAt, role, vendorId, permissionsJson]
    )
    
    return {
      id: result.lastID!,
      username,
      email,
      password_hash: passwordHash,
      created_at: createdAt,
      role,
      vendor_id: vendorId ?? undefined,
      permissions: JSON.parse(permissionsJson),
    }
  } catch (error: any) {
    if (error.message?.includes('UNIQUE constraint') || error.message?.includes('duplicate key')) {
      throw new Error('Username or email already exists')
    }
    throw error
  } finally {
    await db.close()
  }
}

/**
 * Get admin user by username
 */
export async function getAdminByUsername(username: string): Promise<AdminUser | null> {
  await initAdminTable()
  const db = await getDatabase()
  
  try {
    // SQLite only
    const row = await db.get(
      `SELECT * FROM admin_users WHERE username = ?`,
      [username]
    )
    
    return mapDbUser(row)
  } finally {
    await db.close()
  }
}

/**
 * Get admin user by email
 */
export async function getAdminByEmail(email: string): Promise<AdminUser | null> {
  await initAdminTable()
  const db = await getDatabase()
  
  try {
    // SQLite only
    const row = await db.get(
      `SELECT * FROM admin_users WHERE email = ?`,
      [email]
    )
    
    return mapDbUser(row)
  } finally {
    await db.close()
  }
}

export async function getAdminById(userId: number): Promise<AdminUser | null> {
  await initAdminTable()
  const db = await getDatabase()

  try {
    // SQLite only
    const row = await db.get(`SELECT * FROM admin_users WHERE id = ?`, [userId])

    return mapDbUser(row)
  } finally {
    await db.close()
  }
}

/**
 * Update last login time
 */
export async function updateLastLogin(userId: number) {
  await initAdminTable()
  const db = await getDatabase()
  
  try {
    // SQLite only
    await db.run(
      `UPDATE admin_users SET last_login = ? WHERE id = ?`,
      [new Date().toISOString(), userId]
    )
  } finally {
    await db.close()
  }
}

/**
 * Get all admin users (for admin management)
 */
export async function getAllAdmins(): Promise<AdminUser[]> {
  await initAdminTable()
  const db = await getDatabase()
  
  try {
    const rows = await db.query(
      `SELECT * FROM admin_users ORDER BY created_at DESC`
    )

    const mapped = (rows as any[]).map((row) => mapDbUser(row)).filter(
      (user): user is AdminUser => Boolean(user)
    )

    return mapped
  } finally {
    await db.close()
  }
}

export async function setAdminUserVendor(userId: number, vendorId: number | null) {
  await initAdminTable()
  const db = await getDatabase()

  try {
    // SQLite only
    await db.run(
      `UPDATE admin_users SET vendor_id = ? WHERE id = ?`,
      [vendorId, userId]
    )
  } finally {
    await db.close()
  }
}

export async function updateAdminUserPermissions(userId: number, permissions: string[]) {
  await initAdminTable()
  const db = await getDatabase()
  const permissionsJson = JSON.stringify(permissions)

  try {
    // SQLite only
    await db.run(
      `UPDATE admin_users SET permissions = ? WHERE id = ?`,
      [permissionsJson, userId]
    )
  } finally {
    await db.close()
  }
}

export async function updateAdminUserPassword(userId: number, newPassword: string) {
  await initAdminTable()
  const db = await getDatabase()
  const passwordHash = hashPassword(newPassword)

  try {
    // SQLite only
    await db.run(
      `UPDATE admin_users SET password_hash = ? WHERE id = ?`,
      [passwordHash, userId]
    )
  } finally {
    await db.close()
  }
}

