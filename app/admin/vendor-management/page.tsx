import { requireAdmin } from '@/lib/admin-auth'
import VendorManagementPanel from '@/components/admin/VendorManagementPanel'

export const dynamic = 'force-dynamic'

export default async function VendorManagementPage() {
  const session = await requireAdmin()
  if (session.role !== 'superadmin') {
    throw new Error('Unauthorized')
  }

  return <VendorManagementPanel />
}

