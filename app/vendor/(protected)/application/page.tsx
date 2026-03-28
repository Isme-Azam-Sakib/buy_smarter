import { requireVendor } from '@/lib/admin-auth'
import { getLatestVendorApplicationForUser } from '@/lib/vendor-db'
import VendorDashboard from '@/components/vendor/VendorDashboard'

export const dynamic = 'force-dynamic'

export default async function VendorApplicationPage() {
  const session = await requireVendor()
  const application = await getLatestVendorApplicationForUser(session.userId)

  return (
    <VendorDashboard
      session={session}
      initialApplication={application}
      variant="application"
    />
  )
}

