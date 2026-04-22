'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import ValidatorFeedback from '../_components/ValidatorFeedback'

// Screen 3 — Choose the Right Course Type
// Two independent picks: course_depth + delivery_format (closed lists).
// Creator recommends one value for each with rationale + rejected alternatives.
// User can accept the recommendation or override with their own choice.

const COURSE_DEPTHS = [
  { value: 'quick_start',     label: 'Quick Start',     description: 'Short, high-leverage — 3-5 hours total.' },
  { value: 'implementation',  label: 'Implementation',  description: 'Guided execution of your method.' },
  { value: 'deep_dive',       label: 'Deep Dive',       description: 'Comprehensive mastery of a complex topic.' },
] as const

const DELIVERY_FORMATS = [
  { value: 'self_paced',              label: 'Self-Paced',              description: 'Students move at their own pace, no live component.' },
  { value: 'self_paced_with_support', label: 'Self-Paced with Support', description: 'Self-paced + periodic live support (office hours, monthly calls).' },
  { value: 'cohort_live',             label: 'Cohort (Live)',           description: 'Fixed start/end, everyone progresses together live.' },
  { value: 'hybrid_drip',             label: 'Hybrid Drip',             description: 'Content released on a schedule but not fully live.' },
  { value: 'workshop_intensive',      label: 'Workshop Intensive',      description: 'Short, intense, single day or weekend.' },
] as const

interface CourseTypePayload {
  course_depth: string
  delivery_format: string
  course_type_rationale: string
  rejected_alternatives: { value: string; reason: string }[]
}

interface QCResponse {
  draft: CourseTypePayload
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

export default function CourseTypePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [approving, setApproving] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<CourseTypePayload | null>(null)
  const [qc, setQc] = useState<QCResponse | null>(null)
  const [userDepth, setUserDepth] = useState<string>('')
  const [userFormat, setUserFormat] = useState<string>('')

  useEffect(() => {
    fetch('/api/module8/session')
      .then(r => r.json())
      .then(data => {
        if (!data.session) { router.replace('/module/8'); return }
        const existing = data.approved_outputs_by_screen?.[3] as CourseTypePayload | undefined
        if (existing) {
          setResult(existing)
          setUserDepth(existing.course_depth)
          setUserFormat(existing.delivery_format)
        }
        setLoading(false)
      })
      .catch(() => router.replace('/module/8'))
  }, [router])

  async function handleGenerate() {
    setGenerating(true)
    setError('')
    try {
      const body: Record<string, unknown> = {}
      if (userDepth) body.user_preferred_depth = userDepth
      if (userFormat) body.user_preferred_format = userFormat

      const res = await fetch('/api/module8/screen/3/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.error === 'missing_upstream_context') {
          setError(`Missing required context from earlier screens: ${(data.missing ?? []).join(', ')}. Please complete Screen 2 first.`)
          return
        }
        setError(data.detail ?? data.error ?? 'Could not generate. Please try again.')
        return
      }
      setResult(data.draft as CourseTypePayload)
      setQc(data as QCResponse)
      setUserDepth(data.draft.course_depth)
      setUserFormat(data.draft.delivery_format)
    } catch {
      setError('Could not generate. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  async function handleApprove() {
    if (!result) return
    setApproving(true)
    try {
      // Use user's possibly-overridden selections
      const finalPayload = {
        ...result,
        course_depth: userDepth || result.course_depth,
        delivery_format: userFormat || result.delivery_format,
      }
      const res = await fetch('/api/module8/screen/3/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload: finalPayload }),
      })
      if (res.ok) {
        router.push('/module/8/chapter-audit')
      }
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
        <Link href="/module/8/transformation" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-[#1A1F36] mb-4">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back
        </Link>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: '#F4B942' }}>
            <span className="font-bold text-[#1A1F36] text-sm">3</span>
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Module 8 · Screen 3</p>
            <h1 className="text-lg font-bold text-[#1A1F36]">Choose the Right Course Type</h1>
          </div>
        </div>

        {!result && (
          <div className="bg-white rounded-2xl p-5 border border-gray-100 mb-4">
            <p className="text-sm text-gray-600 leading-relaxed">
              Based on your transformation and audience, KLARO will recommend a course depth and delivery format.
              You can override the recommendations if you want a different direction.
            </p>
          </div>
        )}

        {/* Validator feedback (from QC engine) */}
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

        {/* AI Recommendation banner */}
        {result && (
          <div className="bg-white rounded-2xl p-5 border-2 border-[#F4B942] mb-4" style={{ boxShadow: '0 0 0 3px rgba(244, 185, 66, 0.15)' }}>
            <p className="text-xs font-bold text-[#F4B942] uppercase tracking-wide mb-3">KLARO Recommends</p>
            <p className="text-sm text-gray-700 leading-relaxed mb-4">{result.course_type_rationale}</p>

            {result.rejected_alternatives.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Rejected alternatives</p>
                <ul className="space-y-1.5">
                  {result.rejected_alternatives.map((alt, i) => (
                    <li key={i} className="text-xs text-gray-600">
                      <span className="font-semibold">{alt.value}:</span> {alt.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Course Depth */}
        <div className="mb-4">
          <p className="text-xs font-bold text-[#1A1F36] uppercase tracking-wide mb-2">Course Depth</p>
          <div className="space-y-2">
            {COURSE_DEPTHS.map(opt => {
              const selected = userDepth === opt.value
              const isRecommended = result?.course_depth === opt.value
              return (
                <button
                  key={opt.value}
                  onClick={() => setUserDepth(opt.value)}
                  className="w-full text-left p-4 rounded-xl transition-all"
                  style={{
                    background: selected ? '#FFFBEB' : '#ffffff',
                    border: selected ? '2px solid #F4B942' : '1px solid #e5e7eb',
                  }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-bold text-[#1A1F36]">{opt.label}</p>
                    {isRecommended && (
                      <span className="text-[10px] font-bold text-[#F4B942] bg-[#FFFBEB] px-2 py-0.5 rounded-full">AI PICK</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">{opt.description}</p>
                </button>
              )
            })}
          </div>
        </div>

        {/* Delivery Format */}
        <div className="mb-4">
          <p className="text-xs font-bold text-[#1A1F36] uppercase tracking-wide mb-2">Delivery Format</p>
          <div className="space-y-2">
            {DELIVERY_FORMATS.map(opt => {
              const selected = userFormat === opt.value
              const isRecommended = result?.delivery_format === opt.value
              return (
                <button
                  key={opt.value}
                  onClick={() => setUserFormat(opt.value)}
                  className="w-full text-left p-4 rounded-xl transition-all"
                  style={{
                    background: selected ? '#FFFBEB' : '#ffffff',
                    border: selected ? '2px solid #F4B942' : '1px solid #e5e7eb',
                  }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-bold text-[#1A1F36]">{opt.label}</p>
                    {isRecommended && (
                      <span className="text-[10px] font-bold text-[#F4B942] bg-[#FFFBEB] px-2 py-0.5 rounded-full">AI PICK</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">{opt.description}</p>
                </button>
              )
            })}
          </div>
        </div>

        {error && (
          <div className="mb-3 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
            {error}
          </div>
        )}
      </div>

      {/* Fixed Bottom Bar */}
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
                Analyzing your course type…
              </>
            ) : (
              'Recommend My Course Type'
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
              disabled={approving || !userDepth || !userFormat}
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
