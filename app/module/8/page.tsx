'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

// Module 8 entry page. Checks unlock eligibility and routes accordingly:
// - Not eligible → locked screen
// - Eligible but no session → shows Screen 0 (orientation) CTA to start
// - Active session → routes to current_screen page

interface Eligibility {
  eligible: boolean
  reasons_passed: string[]
  reasons_failed: string[]
  admin_override: boolean
}

interface Session {
  id: string
  current_screen: number
  module8_status: string
  unlock_status: string
}

const SCREEN_SLUGS: Record<number, string> = {
  0: 'orientation',
  1: 'readiness',
  2: 'transformation',
  3: 'course-type',
  4: 'chapter-audit',
  5: 'course-skeleton',
  6: 'lesson-map',
  7: 'implementation-layer',
  8: 'student-experience',
  9: 'blueprint',
}

export default function Module8EntryPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [eligibility, setEligibility] = useState<Eligibility | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [starting, setStarting] = useState(false)

  useEffect(() => {
    loadSession()
  }, [])

  async function loadSession() {
    try {
      const res = await fetch('/api/module8/session')
      if (res.status === 401) { router.push('/login'); return }
      const data = await res.json()
      setEligibility(data.eligibility)
      setSession(data.session)
    } finally {
      setLoading(false)
    }
  }

  async function handleStart() {
    setStarting(true)
    try {
      const res = await fetch('/api/module8/session', { method: 'POST' })
      const data = await res.json()
      if (data.session) {
        router.push(`/module/8/${SCREEN_SLUGS[data.session.current_screen] ?? 'orientation'}`)
      }
    } finally {
      setStarting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#F4B942] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // ── Locked screen ───────────────────────────────────────────────────────
  if (!eligibility?.eligible) {
    return (
      <div className="min-h-screen bg-[#F8F9FA]">
        <div className="max-w-[430px] md:max-w-3xl mx-auto px-4 pt-6 pb-32">
          <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-[#1A1F36] mb-4">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Back to Dashboard
          </Link>

          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: '#1A1F36' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F4B942" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Module 8</p>
              <h1 className="text-lg font-bold text-[#1A1F36]">Turn Your E-book Into a Course</h1>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-gray-100 mb-4">
            <div className="mb-4">
              <p className="text-sm font-semibold text-[#1A1F36] mb-2">Module 8 is coming soon for you.</p>
              <p className="text-sm text-gray-500 leading-relaxed">
                This is an advanced module that helps you turn your completed e-book into a structured online course.
                It&apos;s currently in a closed beta while we fine-tune the experience.
              </p>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Requirements</p>
              <ul className="space-y-1.5 text-sm text-gray-700">
                <li className="flex items-start gap-2">
                  <span className={eligibility?.reasons_passed.includes('all_modules_1_7_completed') ? 'text-emerald-600' : 'text-gray-400'}>●</span>
                  Complete all 7 modules (Clarity → Facebook Content)
                </li>
                <li className="flex items-start gap-2">
                  <span className={eligibility?.reasons_passed.includes('access_level_eligible') ? 'text-emerald-600' : 'text-gray-400'}>●</span>
                  Have full access or tier 3+ enrollment
                </li>
                <li className="flex items-start gap-2">
                  <span className={eligibility?.reasons_passed.includes('flagged_for_beta') ? 'text-emerald-600' : 'text-gray-400'}>●</span>
                  Beta access flag enabled by admin
                </li>
              </ul>
            </div>
          </div>

          <Link
            href="/dashboard"
            className="w-full block py-3 rounded-xl font-semibold text-sm text-center bg-[#1A1F36] text-white"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  // ── Eligible: either has session or needs to start one ───────────────────
  if (session) {
    const slug = SCREEN_SLUGS[session.current_screen] ?? 'orientation'
    router.replace(`/module/8/${slug}`)
    return null
  }

  // No session yet — show start CTA
  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      <div className="max-w-[430px] md:max-w-3xl mx-auto px-4 pt-6 pb-32">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-[#1A1F36] mb-4">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back to Dashboard
        </Link>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: '#F4B942' }}>
            <span className="font-bold text-[#1A1F36] text-sm">8</span>
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Module 8</p>
            <h1 className="text-lg font-bold text-[#1A1F36]">Turn Your E-book Into a Course</h1>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-gray-100 mb-4">
          <p className="text-sm font-semibold text-[#1A1F36] mb-2">Welcome to Module 8.</p>
          <p className="text-sm text-gray-500 leading-relaxed">
            You already built the foundation. Now we&apos;ll help you turn your e-book, offer, and core method
            into a structured, high-value course.
          </p>
        </div>

        <button
          onClick={handleStart}
          disabled={starting}
          className="w-full py-4 rounded-xl font-bold text-base disabled:opacity-50"
          style={{ background: '#F4B942', color: '#1A1F36' }}
        >
          {starting ? 'Starting…' : 'Start Module 8'}
        </button>
      </div>
    </div>
  )
}
