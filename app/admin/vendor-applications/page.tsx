import { requireAdmin } from '@/lib/admin-auth'
import VendorApplicationsView from '@/components/admin/VendorApplicationsView'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function VendorApplicationsPage() {
  try {
    const session = await requireAdmin()
    if (session.role !== 'superadmin') {
      redirect('/admin/dashboard')
    }
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      redirect('/admin/login')
    }
    throw error
  }
  
  return <VendorApplicationsView />
}

