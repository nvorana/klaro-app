'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createBrowserClient } from '@supabase/ssr'

// User lands here from the email reset link.
// Supabase auth-helpers parse the URL fragment automatically and establish a
// recovery session. We then let the user set a new password.

export default function ResetPasswordPage() {
  const router = useRouter()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)
  const [sessionError, setSessionError] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // On mount, check if we have a valid recovery session from the email link
  useEffect(() => {
    async function checkSession() {
      // Supabase auth-helpers auto-parse the URL fragment on load.
      // Listen for the PASSWORD_RECOVERY event OR check the current session.
      const { data: { session } } = await supabase.auth.getSession()

      if (session) {
        setSessionReady(true)
        return
      }

      // If URL contains error or no session, handle that
      const hash = typeof window !== 'undefined' ? window.location.hash : ''
      if (hash.includes('error')) {
        const params = new URLSearchParams(hash.slice(1))
        setSessionError(params.get('error_description') ?? 'Link invalid or expired.')
        return
      }

      // Listen for Supabase's auth state change (triggers after fragment is parsed)
      const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
        if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
          setSessionReady(true)
        }
      })

      // If nothing happens after 3 seconds, treat as invalid link
      setTimeout(async () => {
        const { data: { session: laterSession } } = await supabase.auth.getSession()
        if (!laterSession) {
          setSessionError('Link invalid or expired. Please request a new reset link.')
        }
      }, 3000)

      return () => authListener.subscription.unsubscribe()
    }

    checkSession()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const tooShort = newPassword.length > 0 && newPassword.length < 8
  const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword
  const canSubmit = newPassword.length >= 8 && newPassword === confirmPassword && !loading && sessionReady

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setLoading(true)
    setError('')

    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
      data: { must_change_password: false },
    })

    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)

    // Redirect after a short delay to let user see the success state
    setTimeout(() => {
      router.push('/dashboard')
      router.refresh()
    }, 1500)
  }

  // ── Success state ──────────────────────────────────────────────────
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA] px-4">
        <div className="w-full max-w-sm">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto mb-4">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-[#1A1F36] mb-1">Password updated</h1>
            <p className="text-sm text-gray-500">Taking you to your dashboard…</p>
          </div>
        </div>
      </div>
    )
  }

  // ── Invalid/expired link state ─────────────────────────────────────
  if (sessionError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA] px-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="inline-flex bg-[#1A1F36] rounded-2xl px-6 py-3 mb-2">
              <img src="/Klaro_Logo-cropped.png" alt="KLARO" className="h-10 w-auto" />
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-red-50 border border-red-200 flex items-center justify-center mx-auto mb-4">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-[#1A1F36] mb-2">Link issue</h1>
            <p className="text-sm text-gray-500 leading-relaxed mb-4">{sessionError}</p>
            <Link
              href="/forgot-password"
              className="inline-block w-full bg-[#1A1F36] text-white font-bold py-3 rounded-xl text-sm hover:bg-[#2d3458] transition-colors"
            >
              Request New Link
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // ── Form state (default) ───────────────────────────────────────────
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
          <h1 className="text-xl font-bold text-[#1A1F36] mb-1">Set a new password</h1>
          <p className="text-sm text-gray-500 mb-6">
            Choose a new password for your account.
          </p>

          {!sessionReady ? (
            <div className="text-center py-6">
              <div className="w-8 h-8 border-4 border-[#F4B942] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-gray-500">Verifying your reset link…</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showNew ? 'text' : 'password'}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    required
                    className={`w-full px-4 py-3 rounded-xl border text-sm text-[#1A1F36] placeholder-gray-300 focus:outline-none focus:ring-1 transition-colors bg-[#F8F9FA] pr-16 ${
                      tooShort
                        ? 'border-red-300 focus:border-red-400 focus:ring-red-300'
                        : 'border-gray-200 focus:border-[#1A1F36] focus:ring-[#1A1F36]'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-gray-700"
                  >
                    {showNew ? 'Hide' : 'Show'}
                  </button>
                </div>
                {tooShort && (
                  <p className="text-xs text-red-500 mt-1">Must be at least 8 characters</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Type it again"
                    required
                    className={`w-full px-4 py-3 rounded-xl border text-sm text-[#1A1F36] placeholder-gray-300 focus:outline-none focus:ring-1 transition-colors bg-[#F8F9FA] pr-16 ${
                      mismatch
                        ? 'border-red-300 focus:border-red-400 focus:ring-red-300'
                        : 'border-gray-200 focus:border-[#1A1F36] focus:ring-[#1A1F36]'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-gray-700"
                  >
                    {showConfirm ? 'Hide' : 'Show'}
                  </button>
                </div>
                {mismatch && (
                  <p className="text-xs text-red-500 mt-1">Passwords don&apos;t match</p>
                )}
              </div>

              {error && (
                <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={!canSubmit}
                className="w-full bg-[#1A1F36] text-white font-bold py-3.5 rounded-xl text-sm hover:bg-[#2d3458] active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed mt-1"
              >
                {loading ? 'Saving…' : 'Set New Password'}
              </button>
            </form>
          )}
        </div>

      </div>
    </div>
  )
}
