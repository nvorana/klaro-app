'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

// Screen 0 — Orientation. No AI. Pure UI. Records acknowledgment + routes to Screen 1.

export default function Module8OrientationPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [acknowledging, setAcknowledging] = useState(false)
  const [hasSession, setHasSession] = useState(false)

  useEffect(() => {
    // Verify user has a session before showing orientation
    fetch('/api/module8/session')
      .then(r => r.json())
      .then(data => {
        if (!data.session) {
          router.replace('/module/8')
          return
        }
        setHasSession(true)
        setLoading(false)
      })
      .catch(() => router.replace('/module/8'))
  }, [router])

  async function handleAcknowledge() {
    setAcknowledging(true)
    try {
      const res = await fetch('/api/module8/screen/0/acknowledge', { method: 'POST' })
      if (res.ok) {
        router.push('/module/8/readiness')
      }
    } finally {
      setAcknowledging(false)
    }
  }

  if (loading || !hasSession) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#F4B942] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      <div className="max-w-[430px] md:max-w-3xl mx-auto px-4 pt-6 pb-32">
        <Link href="/module/8" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-[#1A1F36] mb-4">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back
        </Link>

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: '#F4B942' }}>
            <span className="font-bold text-[#1A1F36] text-sm">8</span>
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Module 8 · Orientation</p>
            <h1 className="text-lg font-bold text-[#1A1F36]">Turn Your E-book Into a Course</h1>
          </div>
        </div>

        {/* Subheadline */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100 mb-4">
          <p className="text-sm text-[#1A1F36] leading-relaxed">
            You already built the foundation. Now KLARO will help you turn your e-book, offer,
            and core method into a structured, high-value course.
          </p>
        </div>

        {/* What KLARO Will Use */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100 mb-4">
          <p className="text-xs font-semibold text-[#F4B942] uppercase tracking-wide mb-3">What KLARO Will Use</p>
          <ul className="space-y-2 text-sm text-gray-700">
            <li className="flex items-start gap-2">
              <span className="text-[#F4B942] mt-0.5">●</span>
              Your clarity sentence
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#F4B942] mt-0.5">●</span>
              Your e-book (title and chapters)
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#F4B942] mt-0.5">●</span>
              Your offer
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#F4B942] mt-0.5">●</span>
              Your sales message
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#F4B942] mt-0.5">●</span>
              Your existing product promise
            </li>
          </ul>
        </div>

        {/* What You'll Build */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100 mb-4">
          <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide mb-3">What You&apos;ll Build</p>
          <ul className="space-y-2 text-sm text-gray-700">
            <li className="flex items-start gap-2">
              <span className="text-emerald-600 mt-0.5">●</span>
              Your course promise
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-600 mt-0.5">●</span>
              Your course structure
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-600 mt-0.5">●</span>
              Your module outline
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-600 mt-0.5">●</span>
              Your lesson breakdown
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-600 mt-0.5">●</span>
              Implementation tools
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-600 mt-0.5">●</span>
              Your student experience plan
            </li>
          </ul>
        </div>

        {/* Important Note */}
        <div
          className="rounded-2xl p-5 mb-6"
          style={{ background: '#FFFBEB', border: '1px solid #F4B942' }}
        >
          <p className="text-xs font-semibold text-[#F4B942] uppercase tracking-wide mb-2">Important</p>
          <p className="text-sm text-[#1A1F36] leading-relaxed">
            This is not about turning every page of your e-book into a video. It&apos;s about helping
            your students get the result with less confusion.
          </p>
        </div>
      </div>

      {/* Fixed Bottom Bar */}
      <div
        className="fixed bottom-0 bg-white px-4 py-4"
        style={{ borderTop: '1px solid #e5e7eb', width: '100%', maxWidth: '430px', left: '50%', transform: 'translateX(-50%)' }}
      >
        <button
          onClick={handleAcknowledge}
          disabled={acknowledging}
          className="w-full py-4 rounded-xl font-bold text-base disabled:opacity-50"
          style={{ background: '#F4B942', color: '#1A1F36' }}
        >
          {acknowledging ? 'Starting…' : 'Start Module 8 →'}
        </button>
      </div>
    </div>
  )
}
