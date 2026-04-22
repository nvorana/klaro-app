'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

// Screen 9 — Final Course Blueprint

interface Blueprint {
  blueprint_version: number
  module_8_completion_status: string
  course_name_draft: string
  course_transformation_statement: string
  course_depth: string
  delivery_format: string
  duration?: string
  target_learner: string
  course_outcome: string
  unique_method: string
  total_modules: number
  total_lessons: number
  total_implementation_assets: number
  module_map: { module_number: number; title: string; transformation: string; estimated_lessons: number }[]
  lesson_map: { module_number: number; module_title: string; lessons: { lesson_number: number; title: string; outcome: string }[] }[]
  asset_map: { module_number: number; module_title: string; assets: { type: string; title: string; purpose: string }[] }[]
  experience_plan: Record<string, string>
}

interface AssembleResponse {
  blueprint: Blueprint
  ready_for_approval: boolean
  validation_warnings: string[]
  missing_screens: number[]
}

const VALUE_LABELS: Record<string, string> = {
  all_at_once: 'All at once',
  weekly_drip: 'Weekly drip',
  biweekly_drip: 'Biweekly drip',
  self_paced_unlocked: 'Self-paced',
  none: 'None',
  async_email: 'Email (async)',
  group_chat: 'Group chat',
  live_monthly: 'Monthly live',
  live_weekly: 'Weekly live',
  one_on_one: '1:1 coaching',
  optional_private: 'Private (optional)',
  required_private: 'Private (required)',
  public: 'Public',
  monthly: 'Monthly',
  biweekly: 'Biweekly',
  weekly: 'Weekly',
  self_report: 'Self-reported',
  milestone_checkpoints: 'Automated milestones',
  coach_verified: 'Coach verified',
  completion_badge: 'Completion badge',
  formal_certificate: 'Formal certificate',
  quick_start: 'Quick Start',
  implementation: 'Implementation',
  deep_dive: 'Deep Dive',
  self_paced: 'Self-Paced',
  self_paced_with_support: 'Self-Paced + Support',
  cohort_live: 'Live Cohort',
  hybrid_drip: 'Hybrid Drip',
  workshop_intensive: 'Workshop Intensive',
}

export default function BlueprintPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [assembling, setAssembling] = useState(false)
  const [approving, setApproving] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<AssembleResponse | null>(null)

  useEffect(() => {
    assemble()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function assemble() {
    setAssembling(true)
    setError('')
    try {
      const res = await fetch('/api/module8/screen/9/assemble', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setError(data.detail ?? data.error ?? 'Could not assemble blueprint.')
        return
      }
      setResult(data as AssembleResponse)
    } catch {
      setError('Could not assemble blueprint.')
    } finally {
      setAssembling(false)
      setLoading(false)
    }
  }

  async function handleApprove() {
    if (!result) return
    setApproving(true)
    try {
      const res = await fetch('/api/module8/screen/9/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload: result.blueprint }),
      })
      if (res.ok) {
        router.push('/module/8/blueprint?approved=1')
        // Trigger a re-fetch
        setTimeout(() => {
          window.location.reload()
        }, 500)
      }
    } finally {
      setApproving(false)
    }
  }

  async function handleDownload() {
    setDownloading(true)
    try {
      const res = await fetch('/api/module8/export')
      if (!res.ok) return
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const title = (result?.blueprint.course_name_draft ?? 'course-blueprint')
        .replace(/[^a-zA-Z0-9\s-]/g, '').trim().replace(/\s+/g, '-').toLowerCase()
      a.download = `${title}-blueprint.json`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setDownloading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#F4B942] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const isApproved = result?.blueprint.module_8_completion_status === 'blueprint_approved'

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      <div className="max-w-[430px] md:max-w-3xl mx-auto px-4 pt-6 pb-36">
        <Link href="/module/8/student-experience" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-[#1A1F36] mb-4">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back
        </Link>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: '#F4B942' }}>
            <span className="font-bold text-[#1A1F36] text-sm">9</span>
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Module 8 · Screen 9</p>
            <h1 className="text-lg font-bold text-[#1A1F36]">Your Course Blueprint</h1>
          </div>
        </div>

        {error && (
          <div className="mb-3 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Warnings / missing screens */}
        {result && !result.ready_for_approval && (
          <div className="rounded-2xl p-5 mb-4" style={{ background: '#fef2f2', border: '1px solid #f87171' }}>
            <p className="text-xs font-bold text-red-700 uppercase tracking-wide mb-2">Blueprint Not Ready</p>
            {result.missing_screens.length > 0 && (
              <p className="text-sm text-red-800 mb-2">
                Missing approvals from Screen(s): {result.missing_screens.join(', ')}
              </p>
            )}
            {result.validation_warnings.length > 0 && (
              <ul className="text-xs text-red-700 space-y-1">
                {result.validation_warnings.map((w, i) => (
                  <li key={i}>● {w}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Approved celebration banner */}
        {result && isApproved && (
          <div className="rounded-2xl p-5 mb-4" style={{ background: '#ecfdf5', border: '1px solid #10B981' }}>
            <p className="text-xs font-bold text-emerald-700 uppercase tracking-wide mb-1">Blueprint Approved</p>
            <p className="text-sm font-bold text-[#1A1F36]">Your course architecture is locked in.</p>
            <p className="text-xs text-emerald-700 mt-1">Version {result.blueprint.blueprint_version} · Ready for detailed lesson content in future builders.</p>
          </div>
        )}

        {result && (
          <>
            {/* Hero card */}
            <div className="bg-white rounded-2xl p-5 border-2 border-[#F4B942] mb-4" style={{ boxShadow: '0 0 0 3px rgba(244, 185, 66, 0.15)' }}>
              <p className="text-xs font-bold text-[#F4B942] uppercase tracking-wide mb-1">Course Name</p>
              <p className="text-lg font-bold text-[#1A1F36] leading-snug mb-3">{result.blueprint.course_name_draft}</p>

              <p className="text-xs font-bold text-[#F4B942] uppercase tracking-wide mb-1">Transformation</p>
              <p className="text-sm text-gray-700 leading-relaxed mb-4">{result.blueprint.course_transformation_statement}</p>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-gray-50 rounded-lg p-2">
                  <p className="text-lg font-bold text-[#1A1F36]">{result.blueprint.total_modules}</p>
                  <p className="text-[10px] text-gray-500 uppercase">Modules</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-2">
                  <p className="text-lg font-bold text-[#1A1F36]">{result.blueprint.total_lessons}</p>
                  <p className="text-[10px] text-gray-500 uppercase">Lessons</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-2">
                  <p className="text-lg font-bold text-[#1A1F36]">{result.blueprint.total_implementation_assets}</p>
                  <p className="text-[10px] text-gray-500 uppercase">Assets</p>
                </div>
              </div>
            </div>

            {/* Quick facts */}
            <div className="bg-white rounded-2xl p-4 border border-gray-100 mb-3">
              <p className="text-xs font-bold text-[#1A1F36] uppercase tracking-wide mb-3">At a Glance</p>
              <div className="space-y-2 text-sm">
                <Row label="Target learner" value={result.blueprint.target_learner} />
                <Row label="Duration" value={result.blueprint.duration ?? '—'} />
                <Row label="Course depth" value={VALUE_LABELS[result.blueprint.course_depth] ?? result.blueprint.course_depth} />
                <Row label="Delivery format" value={VALUE_LABELS[result.blueprint.delivery_format] ?? result.blueprint.delivery_format} />
                <Row label="Method" value={result.blueprint.unique_method} />
              </div>
            </div>

            {/* Module map */}
            <details className="bg-white rounded-2xl p-4 border border-gray-100 mb-3" open>
              <summary className="text-xs font-bold text-[#1A1F36] uppercase tracking-wide cursor-pointer">Module Map ({result.blueprint.module_map.length})</summary>
              <div className="space-y-2 mt-3">
                {result.blueprint.module_map.map(mod => (
                  <div key={mod.module_number} className="bg-gray-50 rounded-lg p-3">
                    <p className="text-sm font-semibold text-[#1A1F36]">
                      {mod.module_number}. {mod.title}
                    </p>
                    <p className="text-xs text-gray-600 mt-1">{mod.transformation}</p>
                    <p className="text-[10px] text-gray-500 mt-1">{mod.estimated_lessons} lessons</p>
                  </div>
                ))}
              </div>
            </details>

            {/* Lesson map */}
            <details className="bg-white rounded-2xl p-4 border border-gray-100 mb-3">
              <summary className="text-xs font-bold text-[#1A1F36] uppercase tracking-wide cursor-pointer">Lesson Map</summary>
              <div className="space-y-3 mt-3">
                {result.blueprint.lesson_map.map(mod => (
                  <div key={mod.module_number}>
                    <p className="text-xs font-semibold text-[#F4B942] uppercase mb-1">
                      M{mod.module_number}: {mod.module_title}
                    </p>
                    <ul className="space-y-1">
                      {mod.lessons.map(l => (
                        <li key={l.lesson_number} className="text-xs text-gray-700 pl-3">
                          <span className="font-semibold">{l.lesson_number}.</span> {l.title}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </details>

            {/* Assets */}
            <details className="bg-white rounded-2xl p-4 border border-gray-100 mb-3">
              <summary className="text-xs font-bold text-[#1A1F36] uppercase tracking-wide cursor-pointer">Implementation Assets</summary>
              <div className="space-y-2 mt-3">
                {result.blueprint.asset_map.map(mod => (
                  <div key={mod.module_number}>
                    <p className="text-xs font-semibold text-[#F4B942] uppercase mb-1">
                      M{mod.module_number}: {mod.module_title}
                    </p>
                    <ul className="space-y-1 pl-3">
                      {mod.assets.map((a, i) => (
                        <li key={i} className="text-xs text-gray-700">
                          <span className="font-semibold">{a.title}</span>
                          <span className="text-gray-400"> ({a.type.replace(/_/g, ' ')})</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </details>

            {/* Experience plan */}
            <details className="bg-white rounded-2xl p-4 border border-gray-100 mb-3">
              <summary className="text-xs font-bold text-[#1A1F36] uppercase tracking-wide cursor-pointer">Student Experience</summary>
              <div className="space-y-2 mt-3 text-sm">
                {Object.entries(result.blueprint.experience_plan).map(([key, value]) => (
                  <Row
                    key={key}
                    label={key.replace(/_/g, ' ')}
                    value={VALUE_LABELS[value] ?? value}
                  />
                ))}
              </div>
            </details>
          </>
        )}
      </div>

      {/* Fixed Bottom Bar */}
      <div
        className="fixed bottom-0 bg-white px-4 py-4"
        style={{ borderTop: '1px solid #e5e7eb', width: '100%', maxWidth: '430px', left: '50%', transform: 'translateX(-50%)' }}
      >
        {result && !result.ready_for_approval && (
          <button
            onClick={assemble}
            disabled={assembling}
            className="w-full py-4 rounded-xl font-bold text-base disabled:opacity-50"
            style={{ background: '#F3F4F6', color: '#6B7280', border: '1px solid #e5e7eb' }}
          >
            {assembling ? 'Re-assembling…' : 'Re-check'}
          </button>
        )}
        {result && result.ready_for_approval && !isApproved && (
          <button
            onClick={handleApprove}
            disabled={approving}
            className="w-full py-4 rounded-xl font-bold text-base disabled:opacity-50"
            style={{ background: '#F4B942', color: '#1A1F36' }}
          >
            {approving ? 'Approving…' : 'Approve Blueprint →'}
          </button>
        )}
        {isApproved && (
          <div className="flex gap-2">
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="flex-1 py-4 rounded-xl font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ background: '#1A1F36', color: 'white' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              {downloading ? 'Preparing…' : 'Download (.json)'}
            </button>
            <button
              onClick={() => router.push('/dashboard')}
              className="flex-[2] py-4 rounded-xl font-bold text-base"
              style={{ background: '#F4B942', color: '#1A1F36' }}
            >
              Back to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 text-xs">
      <p className="text-gray-500 capitalize w-32 flex-shrink-0">{label}</p>
      <p className="text-[#1A1F36] font-medium flex-1">{value}</p>
    </div>
  )
}
