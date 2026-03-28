import { requireVendor } from '@/lib/admin-auth'
import { getLatestVendorApplicationForUser } from '@/lib/vendor-db'
import VendorDashboard from '@/components/vendor/VendorDashboard'

export const dynamic = 'force-dynamic'

export default async function VendorApplicationPage() {
  const session = await requireVendor()
  let application = null
  
  try {
    application = await getLatestVendorApplicationForUser(session.userId)
  } catch (error: any) {
    console.error('Error fetching vendor application:', error)
  }

  return (
    <VendorDashboard
      session={session}
      initialApplication={application}
      variant="application"
    />
  )
}

