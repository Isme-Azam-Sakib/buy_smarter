'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { CustomInput } from '@/components/ui/CustomInput'

export default function AdminLogin() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  // Check if already logged in on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/admin/auth/me', { credentials: 'include' })
        if (response.ok) {
          const redirectTo = searchParams.get('redirect') || '/admin/dashboard'
          router.replace(redirectTo)
        }
      } catch (error) {
        // Not logged in, continue showing login form
      }
    }
    checkAuth()
  }, [router, searchParams])
  
  const [isLogin, setIsLogin] = useState(true)
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
      const endpoint = isLogin ? '/api/admin/auth/login' : '/api/admin/auth/register'
      const body = isLogin 
        ? { username: formData.username, password: formData.password }
        : formData

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

      // Redirect to admin dashboard or the redirect URL if provided
      const redirectTo = new URLSearchParams(window.location.search).get('redirect') || '/admin/dashboard'
      router.push(redirectTo)
    } catch (err: any) {
      setError('An error occurred. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Admin Panel</h1>
          <p className="text-gray-600">
            {isLogin ? 'Sign in to continue' : 'Create a new admin account'}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
           
            <CustomInput
              placeholder="Username"
              value={formData.username}
              onChange={(value) => setFormData({ ...formData, username: value })}
              className="w-full"
              label=""
            />
          </div>

          {!isLogin && (
            <div>
              
              <CustomInput
                placeholder="Email"
                value={formData.email}
                onChange={(value) => setFormData({ ...formData, email: value })}
                className="w-full"
                label=""
                type="email"
              />
            </div>
          )}

          <div>
            
            <CustomInput
              placeholder="Password"
              value={formData.password}
              onChange={(value) => setFormData({ ...formData, password: value })}
              className="w-full"
              label=""
              type="password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {loading ? 'Please wait...' : isLogin ? 'Sign In' : 'Register'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => {
              setIsLogin(!isLogin)
              setError('')
              setFormData({ username: '', email: '', password: '' })
            }}
            className="text-blue-600 hover:text-blue-700 text-sm"
          >
            {isLogin ? "Don't have an account? Register" : 'Already have an account? Sign in'}
          </button>
        </div>
      </div>
    </div>
  )
}

