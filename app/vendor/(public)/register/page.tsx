import VendorAuthForm from '@/components/vendor/VendorAuthForm'

export default function VendorRegisterPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 flex items-center justify-center p-6">
      <VendorAuthForm defaultMode="register" />
    </div>
  )
}

