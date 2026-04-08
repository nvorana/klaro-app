'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

type Screen = 'signup' | 'pending'

export default function SignupPage() {
  const router = useRouter()
  const [screen, setScreen] = useState<Screen>('signup')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!firstName.trim() || !lastName.trim()) {
      setError('Please enter your first and last name.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    setLoading(true)

    const fullName = `${firstName.trim()} ${lastName.trim()}`

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          phone: phone.trim(),
        },
      },
    })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    // Save extra fields to profiles table
    if (data.user) {
      await supabase.from('profiles').upsert({
        id: data.user.id,
        full_name: fullName,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone: phone.trim(),
        role: 'student',
      }, { onConflict: 'id' })

      const { data: profile } = await supabase
        .from('profiles')
        .select('access_level')
        .eq('id', data.user.id)
        .single()

      const accessLevel = profile?.access_level ?? 'pending'

      if (accessLevel === 'full_access' || accessLevel === 'enrolled') {
        router.push('/dashboard')
        router.refresh()
        return
      }
    }

    setLoading(false)
    setScreen('pending')
  }

  async function handleRefreshCheck() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data: profile } = await supabase
      .from('profiles')
      .select('access_level')
      .eq('id', user.id)
      .single()

    const accessLevel = profile?.access_level ?? 'pending'

    if (accessLevel === 'full_access' || accessLevel === 'enrolled') {
      router.push('/dashboard')
      router.refresh()
    } else {
      setLoading(false)
    }
  }

  const inputClass = "w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-[#1A1F36] placeholder-gray-300 focus:outline-none focus:border-[#1A1F36] focus:ring-1 focus:ring-[#1A1F36] transition-colors bg-[#F8F9FA]"
  const labelClass = "block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5"

  // ── Access Pending Screen ─────────────────────────────────
  if (screen === 'pending') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA] px-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="inline-flex bg-[#1A1F36] rounded-2xl px-6 py-3">
              <img src="/Klaro_Logo-cropped.png" alt="KLARO" className="h-10 w-auto" />
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-amber-50 border-2 border-amber-200 flex items-center justify-center mx-auto mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </div>

            <h2 className="text-lg font-bold text-[#1A1F36] mb-2">Access Pending</h2>
            <p className="text-sm text-gray-500 leading-relaxed mb-6">
              Your account has been created. Once your enrollment is confirmed, KLARO will be unlocked automatically.
              This usually takes a few minutes.
            </p>

            <button
              onClick={handleRefreshCheck}
              disabled={loading}
              className="w-full bg-[#1A1F36] text-white font-bold py-3.5 rounded-xl text-sm hover:bg-[#2d3458] active:scale-[0.98] transition-all disabled:opacity-60"
            >
              {loading ? 'Checking…' : 'Check My Access'}
            </button>

            <p className="text-xs text-gray-400 mt-4">
              Need help?{' '}
              <a href="mailto:support@negosyouniversity.com" className="text-[#1A1F36] font-semibold hover:underline">
                Contact support
              </a>
            </p>

            <button
              onClick={async () => {
                const { createClient } = await import('@/lib/supabase/client')
                const supabase = createClient()
                await supabase.auth.signOut()
                window.location.href = '/login'
              }}
              className="text-xs text-gray-400 hover:text-gray-600 mt-3 underline"
            >
              Sign out and use a different account
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Signup Form ───────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA] px-4 py-10">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex bg-[#1A1F36] rounded-2xl px-6 py-3 mb-2">
            <img src="/Klaro_Logo-cropped.png" alt="KLARO" className="h-10 w-auto" />
          </div>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <h1 className="text-xl font-bold text-[#1A1F36] mb-1">Create your account</h1>
          <p className="text-sm text-gray-400 mb-6">Set up your KLARO workspace</p>

          <form onSubmit={handleSignup} className="flex flex-col gap-4">

            {/* First & Last Name — side by side */}
            <div className="flex gap-3">
              <div className="flex-1">
                <label className={labelClass}>First Name</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  placeholder="Maria"
                  required
                  className={inputClass}
                />
              </div>
              <div className="flex-1">
                <label className={labelClass}>Last Name</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  placeholder="Santos"
                  required
                  className={inputClass}
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className={labelClass}>Email Address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@email.com"
                required
                className={inputClass}
              />
            </div>

            {/* Phone */}
            <div>
              <label className={labelClass}>Phone Number</label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+63 912 345 6789"
                required
                className={inputClass}
              />
            </div>

            {/* Password */}
            <div>
              <label className={labelClass}>Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Min. 8 characters"
                required
                className={inputClass}
              />
            </div>

            {/* Confirm Password */}
            <div>
              <label className={labelClass}>Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                className={inputClass}
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
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-gray-400 mt-6">
          Already have an account?{' '}
          <a href="/login" className="text-[#1A1F36] font-semibold hover:underline">
            Log in
          </a>
        </p>

      </div>
    </div>
  )
}
