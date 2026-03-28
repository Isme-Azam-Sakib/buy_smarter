'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CustomInput } from '@/components/ui/CustomInput'

interface VendorAuthFormProps {
  defaultMode?: 'login' | 'register'
  onClose?: () => void
}

export default function VendorAuthForm({ defaultMode = 'login', onClose }: VendorAuthFormProps) {
  const router = useRouter()
  const [mode, setMode] = useState<'login' | 'register'>(defaultMode)
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const endpoint = mode === 'login' 
        ? '/api/vendor/auth/login' 
        : '/api/vendor/auth/register'
      
      const body = mode === 'login'
        ? { username: formData.username, password: formData.password }
        : { username: formData.username, email: formData.email, password: formData.password }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'An error occurred')
        setLoading(false)
        return
      }

      // Redirect to admin dashboard (vendors use /admin routes)
      if (onClose) {
        onClose()
      }
      // Redirect after a brief moment to ensure state updates
      setTimeout(() => {
        router.push('/admin/dashboard')
        router.refresh()
      }, 300)
    } catch (err: any) {
      setError('An error occurred. Please try again.')
      setLoading(false)
    }
  }

  const switchMode = () => {
    setMode(mode === 'login' ? 'register' : 'login')
    setError('')
    setFormData({ username: '', email: '', password: '' })
  }

  return (
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          {mode === 'login' ? 'Vendor Sign In' : 'Vendor Registration'}
        </h2>
        <p className="text-gray-600">
          {mode === 'login'
            ? 'Sign in to your vendor account'
            : 'Create a new vendor account'}
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <CustomInput
            id="username"
            name="username"
            placeholder="Username"
            value={formData.username}
            onChange={(value) => setFormData({ ...formData, username: value })}
            className="w-full"
            required
          />
        </div>

        {mode === 'register' && (
          <div>
            <CustomInput
              id="email"
              name="email"
              placeholder="Email"
              value={formData.email}
              onChange={(value) => setFormData({ ...formData, email: value })}
              className="w-full"
              type="email"
              required
            />
          </div>
        )}

        <div>
          <CustomInput
            id="password"
            name="password"
            type="password"
            placeholder="Password"
            value={formData.password}
            onChange={(value) => setFormData({ ...formData, password: value })}
            className="w-full"
            required
          />
          {mode === 'register' && (
            <p className="mt-1 text-xs text-gray-500">Password must be at least 6 characters</p>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition font-semibold"
        >
          {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Register'}
        </button>
      </form>

      <div className="mt-6 text-center">
        <button
          type="button"
          onClick={switchMode}
          className="text-purple-600 hover:text-purple-700 text-sm font-medium"
        >
          {mode === 'login'
            ? "Don't have an account? Register"
            : 'Already have an account? Sign in'}
        </button>
      </div>
    </div>
  )
}

