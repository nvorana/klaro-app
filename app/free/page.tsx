'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createBrowserClient } from '@supabase/ssr'

// ─── Workshop Signup (Lite KLARO) ─────────────────────────────────────────────
// Public signup page used during the AutoMagically workshop. Creates a new
// student account with access_level = 'lite_workshop'. Lite users can use
// Module 1 (Clarity Builder) fully, see Module 2 outline preview, but hit a
// paywall on chapter generation.
//
// If the user pays for the Accelerator Program after the workshop, the
// Systeme.io webhook flips their access_level to 'enrolled' / 'full_access'
// and they keep their clarity sentence + outline. No re-signup.

export default function FreeWorkshopSignup() {
  const router = useRouter()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkingExisting, setCheckingExisting] = useState(true)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // If already signed in, send them to dashboard
  useEffect(() => {
    async function check() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) { router.push('/dashboard'); return }
      setCheckingExisting(false)
    }
    check()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!firstName.trim() || !lastName.trim()) {
      setError('Please enter your first and last name.')
      return
    }
    if (!email.trim()) {
      setError('Please enter your email.')
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
        },
      },
    })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    if (data.user) {
      // Create profile row with lite_workshop access — gives them Module 1
      // immediately. Module 2 outline preview gated inside Module 2 page.
      await supabase.from('profiles').upsert({
        id: data.user.id,
        email: email.trim().toLowerCase(),
        full_name: fullName,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        role: 'student',
        access_level: 'lite_workshop',
        enrolled_at: new Date().toISOString(),
      }, { onConflict: 'id' })

      router.push('/dashboard')
      router.refresh()
      return
    }

    setLoading(false)
  }

  if (checkingExisting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA]">
        <p className="text-gray-500 text-sm animate-pulse">Loading…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1A1F36] via-[#1A1F36] to-[#0d1020] flex flex-col">
      <div className="w-full max-w-md mx-auto px-5 pt-10 pb-12 flex-1 flex flex-col">

        {/* Logo */}
        <div className="text-center mb-6">
          <img src="/Klaro_Logo-cropped.png" alt="KLARO" className="h-12 w-auto mx-auto" />
          <div className="inline-block mt-3 px-3 py-1 rounded-full bg-[#F4B942]/15 border border-[#F4B942]/30">
            <span className="text-[#F4B942] text-xs font-bold tracking-wide">WORKSHOP EDITION · FREE</span>
          </div>
        </div>

        {/* Pitch */}
        <div className="mb-7 text-center">
          <h1 className="text-white text-2xl font-bold leading-tight mb-2">
            Build your clarity sentence + ebook outline in 90 seconds.
          </h1>
          <p className="text-white/60 text-sm leading-relaxed">
            Free for AutoMagically workshop attendees. Sign up now to follow along with the live demo.
          </p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">First name</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  disabled={loading}
                  required
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm text-[#1A1F36] focus:outline-none focus:border-[#1A1F36] focus:ring-1 focus:ring-[#1A1F36] bg-[#F8F9FA]"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">Last name</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  disabled={loading}
                  required
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm text-[#1A1F36] focus:outline-none focus:border-[#1A1F36] focus:ring-1 focus:ring-[#1A1F36] bg-[#F8F9FA]"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                disabled={loading}
                required
                placeholder="you@email.com"
                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm text-[#1A1F36] placeholder:text-gray-400 focus:outline-none focus:border-[#1A1F36] focus:ring-1 focus:ring-[#1A1F36] bg-[#F8F9FA]"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                disabled={loading}
                required
                placeholder="At least 8 characters"
                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm text-[#1A1F36] placeholder:text-gray-400 focus:outline-none focus:border-[#1A1F36] focus:ring-1 focus:ring-[#1A1F36] bg-[#F8F9FA]"
              />
            </div>

            {error && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#1A1F36] text-white font-bold py-3 rounded-xl text-sm hover:bg-[#2d3458] active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {loading ? 'Creating your account…' : 'Start free →'}
            </button>
          </form>

          <p className="text-center text-[11px] text-gray-400 mt-4">
            Already have an account?{' '}
            <Link href="/login" className="text-[#1A1F36] font-semibold underline">Log in</Link>
          </p>
        </div>

        {/* What's included */}
        <div className="mt-6 bg-white/5 rounded-xl p-4 border border-white/10">
          <p className="text-[10px] font-bold text-white/40 uppercase tracking-wide mb-3">What you get free</p>
          <ul className="space-y-2 text-white/70 text-xs leading-relaxed">
            <li className="flex gap-2">
              <span className="text-[#F4B942] flex-shrink-0">✓</span>
              <span>Module 1: Clarity Builder — find your target market, their biggest problem, and your unique solution. Saves your clarity sentence.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-[#F4B942] flex-shrink-0">✓</span>
              <span>Ebook outline preview — title options + your 8-chapter outline, generated for your specific clarity sentence.</span>
            </li>
            <li className="flex gap-2 text-white/40 italic">
              <span className="flex-shrink-0">🔒</span>
              <span>Full ebook generation, sales page, emails, lead magnet, bonuses — unlocked with the Accelerator Program.</span>
            </li>
          </ul>
        </div>

      </div>
    </div>
  )
}
