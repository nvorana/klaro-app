'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Incorrect email or password. Please try again.')
      setLoading(false)
      return
    }

    // Apply any pending webhook access (handles tag-before-signup and tag-after-signup)
    if (data.user) {
      await fetch('/api/apply-pending-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: data.user.email, userId: data.user.id }),
      })
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA] px-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex bg-[#1A1F36] rounded-2xl px-6 py-3 mb-2">
            <img src="/Klaro_Logo-cropped.png" alt="KLARO" className="h-10 w-auto" />
          </div>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <h1 className="text-xl font-bold text-[#1A1F36] mb-1">Welcome back</h1>
          <p className="text-sm text-gray-400 mb-6">Sign in to continue to your workspace</p>

          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@email.com"
                required
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-[#1A1F36] placeholder-gray-300 focus:outline-none focus:border-[#1A1F36] focus:ring-1 focus:ring-[#1A1F36] transition-colors bg-[#F8F9FA]"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Password
                </label>
                <a
                  href="/forgot-password"
                  className="text-xs text-gray-500 hover:text-[#1A1F36] hover:underline"
                >
                  Forgot?
                </a>
              </div>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-[#1A1F36] placeholder-gray-300 focus:outline-none focus:border-[#1A1F36] focus:ring-1 focus:ring-[#1A1F36] transition-colors bg-[#F8F9FA]"
              />
            </div>

            {error && (
              <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#1A1F36] text-white font-bold py-3.5 rounded-xl text-sm hover:bg-[#2d3458] active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed mt-1"
            >
              {loading ? 'Signing in…' : 'Log In'}
            </button>
          </form>
        </div>

        {/* Footer link */}
        <p className="text-center text-sm text-gray-400 mt-6">
          New student?{' '}
          <a href="/signup" className="text-[#1A1F36] font-semibold hover:underline">
            Create your account
          </a>
        </p>

      </div>
    </div>
  )
}
