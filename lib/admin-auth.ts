import { cookies } from 'next/headers'
import { AdminUser } from './admin-db'
import { getVendorByAdminUserId, getLatestVendorApplicationForUser } from './vendor-db'

export interface AdminSession {
  userId: number
  username: string
  email: string
  role: 'superadmin' | 'vendor'
  vendorId?: number
  vendorStatus?: string
  permissions: string[]
  managedVendorName?: string // The vendor store this vendor user is assigned to manage
}

/**
 * Get current admin session
 * For vendors, refresh status from database to ensure it's up-to-date
 */
export async function getAdminSession(): Promise<AdminSession | null> {
  try {
    const cookieStore = await cookies()
    const session = cookieStore.get('admin_session')
    
    if (!session) {
      return null
    }

    const parsed = JSON.parse(session.value) as AdminSession
    if (!Array.isArray(parsed.permissions)) {
      parsed.permissions = []
    }
    
    // Refresh vendor status from database for vendor users
    // This ensures status changes are reflected immediately without requiring re-login
    if (parsed.role === 'vendor' && parsed.userId) {
      try {
        const vendorRecord = await getVendorByAdminUserId(parsed.userId)
        
        if (vendorRecord) {
          // Update session with latest vendor data from database
          parsed.vendorId = vendorRecord.id
          parsed.vendorStatus = vendorRecord.status
          parsed.permissions = vendorRecord.permissions ?? parsed.permissions
          parsed.managedVendorName = vendorRecord.managed_vendor_name ?? undefined
        } else {
          // No vendor record, check application status
          const lastApplication = await getLatestVendorApplicationForUser(parsed.userId)
          parsed.vendorStatus = lastApplication?.status || 'not_submitted'
        }
      } catch (error: any) {
        console.error('Error refreshing vendor status in session:', error)
        // Continue with cached session if refresh fails
      }
    }
    
    return parsed
  } catch {
    return null
  }
}

export async function buildSessionPayload(user: AdminUser): Promise<AdminSession> {
  const role = user.role || 'superadmin'
  let vendorId = user.vendor_id || undefined
  let vendorStatus: string | undefined
  let permissions = user.permissions || []

  if (role === 'vendor') {
    try {
      const vendorRecord = await getVendorByAdminUserId(user.id)

      if (vendorRecord) {
        vendorId = vendorRecord.id
        vendorStatus = vendorRecord.status
        permissions = vendorRecord.permissions ?? permissions
      } else {
        try {
          const lastApplication = await getLatestVendorApplicationForUser(user.id)
          vendorStatus = lastApplication?.status || 'not_submitted'
        } catch (error: any) {
          console.error('Error fetching vendor application for session:', error)
          vendorStatus = 'not_submitted'
        }
      }
    } catch (error: any) {
      console.error('Error building vendor session payload:', error)
      // Continue with default values
      vendorStatus = 'not_submitted'
    }
  }

  let managedVendorName: string | undefined
  if (role === 'vendor') {
    try {
      const vendorRecord = await getVendorByAdminUserId(user.id)
      managedVendorName = vendorRecord?.managed_vendor_name ?? undefined
    } catch (error: any) {
      console.error('Error fetching managed vendor name for session:', error)
    }
  }

  return {
    userId: user.id,
    username: user.username,
    email: user.email,
    role,
    vendorId,
    vendorStatus,
    permissions,
    managedVendorName,
  }
}

/**
 * Check if user is authenticated as admin
 */
export async function requireAdmin(): Promise<AdminSession> {
  const session = await getAdminSession()
  
  if (!session) {
    throw new Error('Unauthorized')
  }
  
  return session
}

export async function requireVendor(): Promise<AdminSession> {
  const session = await getAdminSession()

  if (!session || session.role !== 'vendor') {
    throw new Error('Unauthorized')
  }

  return session
}

