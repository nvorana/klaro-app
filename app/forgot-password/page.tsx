'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createBrowserClient } from '@supabase/ssr'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email) return
    setLoading(true)
    setError('')

    // Build the redirect URL the email link will send them back to.
    // We send it through /auth/callback so the PKCE code can be exchanged
    // for a real session server-side before the user lands on /reset-password.
    const redirectTo = `${window.location.origin}/auth/callback?next=/reset-password`

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    })

    if (resetError) {
      // Don't leak whether the email exists — but show generic error for real failures
      console.error('Reset error:', resetError)
    }

    // Always show success (prevents email enumeration)
    setSent(true)
    setLoading(false)
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
          {!sent ? (
            <>
              <h1 className="text-xl font-bold text-[#1A1F36] mb-1">Forgot your password?</h1>
              <p className="text-sm text-gray-500 mb-6">
                Enter your email and we&apos;ll send you a link to reset it.
              </p>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
                    autoFocus
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
                  disabled={loading || !email}
                  className="w-full bg-[#1A1F36] text-white font-bold py-3.5 rounded-xl text-sm hover:bg-[#2d3458] active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed mt-1"
                >
                  {loading ? 'Sending…' : 'Send Reset Link'}
                </button>
              </form>
            </>
          ) : (
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto mb-4">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h1 className="text-xl font-bold text-[#1A1F36] mb-2">Check your email</h1>
              <p className="text-sm text-gray-500 leading-relaxed mb-4">
                If an account exists for <span className="font-semibold text-[#1A1F36]">{email}</span>,
                we sent a reset link. It should arrive in your inbox within a minute.
              </p>
              <p className="text-xs text-gray-400">
                Didn&apos;t get it? Check your spam folder, or{' '}
                <button
                  onClick={() => { setSent(false); setError('') }}
                  className="text-[#1A1F36] font-semibold hover:underline"
                >
                  try again
                </button>
                .
              </p>
            </div>
          )}
        </div>

        {/* Footer link */}
        <p className="text-center text-sm text-gray-400 mt-6">
          <Link href="/login" className="text-[#1A1F36] font-semibold hover:underline">
            Back to login
          </Link>
        </p>

      </div>
    </div>
  )
}
