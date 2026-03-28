import type { AdminSession } from './admin-auth'

export function hasPermission(session: AdminSession | null, permission: string): boolean {
  if (!session) return false
  if (session.role === 'superadmin') return true
  
  const permissions = session.permissions ?? []
  
  // Check exact match
  if (permissions.includes(permission)) return true
  
  // If checking a granular product permission, check if 'products' is granted
  if (permission.startsWith('products.') && permissions.includes('products')) {
    return true
  }
  
  return false
}

export function requirePermission(session: AdminSession | null, permission: string): void {
  if (!hasPermission(session, permission)) {
    throw new Error('Unauthorized')
  }
}

