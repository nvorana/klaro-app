'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import ValidatorFeedback from '../_components/ValidatorFeedback'

// Screen 5 — Course Skeleton

interface ModuleEntry {
  module_number: number
  title: string
  transformation: string
  estimated_lessons: number
  source_chapters: number[]
}

interface CourseSkeletonPayload {
  course_title: string
  module_map: ModuleEntry[]
  total_modules: number
  total_estimated_lessons: number
  sequence_rationale: string
}

interface QCResponse {
  draft: CourseSkeletonPayload
  decision: 'pass' | 'revise' | 'escalate' | 'blocked_by_rule'
  decision_reason?: string
  weighted_average?: number | null
  validator_scores?: { name: string; score: number; recommendation: string }[]
  validator_feedback?: {
    name: string
    overall_score: number
    pass_recommendation: string
    top_issues?: string[]
    suggested_fixes?: string[]
  }[]
  hard_rule_failures?: { rule_id: string; message: string }[]
  duplicate_flags?: { message: string }[]
}

export default function CourseSkeletonPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [approving, setApproving] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<CourseSkeletonPayload | null>(null)
  const [qc, setQc] = useState<QCResponse | null>(null)
  const [preferredCount, setPreferredCount] = useState<number | ''>('')

  useEffect(() => {
    fetch('/api/module8/session')
      .then(r => r.json())
      .then(data => {
        if (!data.session) { router.replace('/module/8'); return }
        const existing = data.approved_outputs_by_screen?.[5] as CourseSkeletonPayload | undefined
        if (existing) setResult(existing)
        setLoading(false)
      })
      .catch(() => router.replace('/module/8'))
  }, [router])

  async function handleGenerate() {
    setGenerating(true)
    setError('')
    try {
      const body: Record<string, unknown> = {}
      if (preferredCount !== '') body.preferred_module_count = preferredCount

      const res = await fetch('/api/module8/screen/5/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.error === 'missing_upstream_context') {
          setError(`Missing required context: ${(data.missing ?? []).join(', ')}. Please complete Screens 2-4 first.`)
          return
        }
        setError(data.detail ?? data.error ?? 'Could not generate course skeleton. Please try again.')
        return
      }
      setResult(data.draft as CourseSkeletonPayload)
      setQc(data as QCResponse)
    } catch {
      setError('Could not generate course skeleton. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  async function handleApprove() {
    if (!result) return
    setApproving(true)
    try {
      const res = await fetch('/api/module8/screen/5/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload: result }),
      })
      if (res.ok) router.push('/module/8/lesson-map')
    } finally {
      setApproving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#F4B942] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      <div className="max-w-[430px] md:max-w-3xl mx-auto px-4 pt-6 pb-36">
        <Link href="/module/8/chapter-audit" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-[#1A1F36] mb-4">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back
        </Link>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: '#F4B942' }}>
            <span className="font-bold text-[#1A1F36] text-sm">5</span>
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Module 8 · Screen 5</p>
            <h1 className="text-lg font-bold text-[#1A1F36]">Build the Course Skeleton</h1>
          </div>
        </div>

        {!result && (
          <>
            <div className="bg-white rounded-2xl p-5 border border-gray-100 mb-4">
              <p className="text-xs font-semibold text-[#F4B942] uppercase tracking-wide mb-2">Why this matters</p>
              <p className="text-sm text-gray-600 leading-relaxed">
                Your course should follow the student&apos;s journey, not just your knowledge categories.
                KLARO will propose 4-7 modules with a clear transformation outcome for each.
              </p>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-gray-100 mb-3">
              <p className="text-xs font-semibold text-[#1A1F36] mb-2">Preferred module count (optional)</p>
              <div className="flex gap-2">
                {[3, 4, 5, 6, 7].map(n => (
                  <button
                    key={n}
                    onClick={() => setPreferredCount(preferredCount === n ? '' : n)}
                    className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
                    style={{
                      background: preferredCount === n ? '#FFFBEB' : '#f3f4f6',
                      color: preferredCount === n ? '#1A1F36' : '#6b7280',
                      border: preferredCount === n ? '2px solid #F4B942' : '1px solid #e5e7eb',
                    }}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {result && qc && (
          <ValidatorFeedback
            decision={qc.decision}
            decisionReason={qc.decision_reason}
            weightedAverage={qc.weighted_average}
            validatorScores={qc.validator_scores}
            validatorFeedback={qc.validator_feedback}
            hardRuleFailures={qc.hard_rule_failures}
            duplicateFlags={qc.duplicate_flags}
          />
        )}

        {result && (
          <>
            <div className="bg-white rounded-2xl p-5 border-2 border-[#F4B942] mb-4" style={{ boxShadow: '0 0 0 3px rgba(244, 185, 66, 0.15)' }}>
              <p className="text-xs font-bold text-[#F4B942] uppercase tracking-wide mb-1">Course Title</p>
              <p className="text-base font-bold text-[#1A1F36] leading-snug mb-3">{result.course_title}</p>
              <div className="flex gap-3 text-xs text-gray-600">
                <span>{result.total_modules} modules</span>
                <span>·</span>
                <span>~{result.total_estimated_lessons} lessons total</span>
              </div>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 mb-4 border border-gray-200">
              <p className="text-[10px] font-bold text-gray-600 uppercase tracking-wide mb-1.5">Sequence Rationale</p>
              <p className="text-xs text-gray-700 leading-relaxed">{result.sequence_rationale}</p>
            </div>

            {result.module_map.map(mod => (
              <div key={mod.module_number} className="bg-white rounded-2xl p-4 border border-gray-100 mb-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#FFFBEB', border: '1px solid #F4B942' }}>
                    <span className="text-[#F4B942] font-bold text-xs">{mod.module_number}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-[#1A1F36] mb-1">{mod.title}</p>
                    <p className="text-xs text-gray-600 leading-relaxed mb-2">{mod.transformation}</p>
                    <div className="flex items-center gap-2 text-[10px] text-gray-500">
                      <span>{mod.estimated_lessons} lesson{mod.estimated_lessons !== 1 ? 's' : ''}</span>
                      {mod.source_chapters.length > 0 && (
                        <>
                          <span>·</span>
                          <span>from chapter{mod.source_chapters.length !== 1 ? 's' : ''} {mod.source_chapters.join(', ')}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </>
        )}

        {error && (
          <div className="mb-3 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
            {error}
          </div>
        )}
      </div>

      <div
        className="fixed bottom-0 bg-white px-4 py-4"
        style={{ borderTop: '1px solid #e5e7eb', width: '100%', maxWidth: '430px', left: '50%', transform: 'translateX(-50%)' }}
      >
        {!result ? (
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="w-full py-4 rounded-xl font-bold text-base disabled:opacity-40 flex items-center justify-center gap-2"
            style={{ background: '#F4B942', color: '#1A1F36' }}
          >
            {generating ? (
              <>
                <div className="w-4 h-4 border-2 border-[#1A1F36] border-t-transparent rounded-full animate-spin" />
                Building your course structure…
              </>
            ) : (
              'Build My Course Skeleton'
            )}
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="flex-1 py-4 rounded-xl font-semibold text-sm disabled:opacity-50"
              style={{ background: '#F3F4F6', color: '#6B7280', border: '1px solid #e5e7eb' }}
            >
              {generating ? 'Regenerating…' : 'Regenerate'}
            </button>
            <button
              onClick={handleApprove}
              disabled={approving}
              className="flex-[2] py-4 rounded-xl font-bold text-base disabled:opacity-50"
              style={{ background: '#F4B942', color: '#1A1F36' }}
            >
              {approving ? 'Saving…' : 'Lock It In →'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
