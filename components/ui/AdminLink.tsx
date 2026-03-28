import Link from 'next/link'

interface AdminLinkProps {
  session: { username: string; role: string } | null
}

export default function AdminLink({ session }: AdminLinkProps) {
  if (session) {
    return (
      <Link href="/admin/dashboard" className="text-gray-400 hover:text-white text-sm">
        Admin Dashboard
      </Link>
    )
  }
  
  return (
    <Link href="/admin/login" className="text-gray-400 hover:text-white text-sm">
      Admin Login
    </Link>
  )
}

