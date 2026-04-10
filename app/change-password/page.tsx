'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function ChangePasswordPage() {
  const router = useRouter()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const tooShort = newPassword.length > 0 && newPassword.length < 8
  const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword
  const canSubmit = newPassword.length >= 8 && newPassword === confirmPassword && !loading

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()

      // Update the password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
        data: { must_change_password: false },
      })

      if (updateError) {
        setError(updateError.message)
        return
      }

      // Redirect to dashboard after successful change
      router.push('/dashboard')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-[#F4B942] flex items-center justify-center mx-auto mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1A1F36" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <h1 className="text-white text-xl font-bold mb-1">Set Your Password</h1>
          <p className="text-gray-500 text-sm">
            Your account was created with a temporary password. Please set a new one before continuing.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* New password */}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">
              New Password
            </label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                className={`w-full bg-gray-900 border rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none pr-16 transition-colors ${
                  tooShort ? 'border-red-700' : 'border-gray-700 focus:border-gray-500'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowNew(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-gray-500 hover:text-gray-300"
              >
                {showNew ? 'Hide' : 'Show'}
              </button>
            </div>
            {tooShort && (
              <p className="text-red-400 text-[11px] mt-1">Must be at least 8 characters</p>
            )}
          </div>

          {/* Confirm password */}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">
              Confirm Password
            </label>
            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Type it again"
                className={`w-full bg-gray-900 border rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none pr-16 transition-colors ${
                  mismatch ? 'border-red-700' : 'border-gray-700 focus:border-gray-500'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-gray-500 hover:text-gray-300"
              >
                {showConfirm ? 'Hide' : 'Show'}
              </button>
            </div>
            {mismatch && (
              <p className="text-red-400 text-[11px] mt-1">Passwords don&apos;t match</p>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-900/30 border border-red-800 rounded-xl px-4 py-3">
              <p className="text-red-400 text-sm">✗ {error}</p>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full bg-[#F4B942] text-[#1A1F36] font-bold py-3.5 rounded-xl text-sm transition-opacity disabled:opacity-40 mt-2"
          >
            {loading ? 'Saving...' : 'Set New Password'}
          </button>
        </form>

      </div>
    </div>
  )
}
