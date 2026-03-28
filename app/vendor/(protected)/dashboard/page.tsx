import { requireVendor } from '@/lib/admin-auth'
import { getLatestVendorApplicationForUser } from '@/lib/vendor-db'
import VendorDashboard from '@/components/vendor/VendorDashboard'

export const dynamic = 'force-dynamic'

export default async function VendorDashboardPage() {
  try {
    const session = await requireVendor()
    let application = null
    
    try {
      application = await getLatestVendorApplicationForUser(session.userId)
    } catch (error: any) {
      console.error('Error fetching vendor application:', error)
      // Continue without application if there's an error
    }

    return (
      <VendorDashboard
        session={session}
        initialApplication={application}
      />
    )
  } catch (error: any) {
    console.error('Vendor dashboard error:', error)
    throw error
  }
}

