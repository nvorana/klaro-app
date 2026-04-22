'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import ValidatorFeedback from '../_components/ValidatorFeedback'

// Screen 8 — Student Experience Plan

interface ExperiencePlan {
  delivery_cadence: string
  support_channel: string
  community_access: string
  live_session_frequency: string
  completion_model: string
  certification: string
}

interface StudentExperiencePayload {
  plan: ExperiencePlan
  rationale_for_user: string
  onboarding_outline?: string
  milestone_plan?: string[]
}

interface QCResponse {
  draft: StudentExperiencePayload
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

const FIELD_LABELS: Record<string, string> = {
  delivery_cadence:       'Delivery Cadence',
  support_channel:        'Support Channel',
  community_access:       'Community Access',
  live_session_frequency: 'Live Session Frequency',
  completion_model:       'Completion Model',
  certification:          'Certification',
}

const VALUE_LABELS: Record<string, string> = {
  // delivery_cadence
  all_at_once: 'All at once',
  weekly_drip: 'Weekly drip',
  biweekly_drip: 'Biweekly drip',
  self_paced_unlocked: 'Self-paced (all unlocked)',
  // support_channel
  none: 'None',
  async_email: 'Email (async)',
  group_chat: 'Group chat',
  live_monthly: 'Monthly live',
  live_weekly: 'Weekly live',
  one_on_one: '1:1 coaching',
  // community_access
  optional_private: 'Private (optional)',
  required_private: 'Private (required)',
  public: 'Public',
  // frequency
  monthly: 'Monthly',
  biweekly: 'Biweekly',
  weekly: 'Weekly',
  // completion_model
  self_report: 'Self-reported',
  milestone_checkpoints: 'Automated milestones',
  coach_verified: 'Coach verified',
  // certification
  completion_badge: 'Completion badge',
  formal_certificate: 'Formal certificate',
}

export default function StudentExperiencePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [approving, setApproving] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<StudentExperiencePayload | null>(null)
  const [qc, setQc] = useState<QCResponse | null>(null)

  useEffect(() => {
    fetch('/api/module8/session')
      .then(r => r.json())
      .then(data => {
        if (!data.session) { router.replace('/module/8'); return }
        const existing = data.approved_outputs_by_screen?.[8] as StudentExperiencePayload | undefined
        if (existing) setResult(existing)
        setLoading(false)
      })
      .catch(() => router.replace('/module/8'))
  }, [router])

  async function handleGenerate() {
    setGenerating(true)
    setError('')
    try {
      const res = await fetch('/api/module8/screen/8/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.error === 'missing_upstream_context') {
          setError(`Missing required context: ${(data.missing ?? []).join(', ')}. Please complete Screens 2 and 3 first.`)
          return
        }
        setError(data.detail ?? data.error ?? 'Could not generate experience plan.')
        return
      }
      setResult(data.draft as StudentExperiencePayload)
      setQc(data as QCResponse)
    } catch {
      setError('Could not generate experience plan.')
    } finally {
      setGenerating(false)
    }
  }

  async function handleApprove() {
    if (!result) return
    setApproving(true)
    try {
      const res = await fetch('/api/module8/screen/8/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload: result }),
      })
      if (res.ok) {
        // Phase 3 ends here. Screen 9 (Blueprint) is Phase 4.
        alert('Phase 3 complete — Screens 1-8 are all built. Screen 9 (Blueprint Assembly) comes next.')
        router.push('/dashboard')
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
        <Link href="/module/8/implementation-layer" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-[#1A1F36] mb-4">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back
        </Link>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: '#F4B942' }}>
            <span className="font-bold text-[#1A1F36] text-sm">8</span>
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Module 8 · Screen 8</p>
            <h1 className="text-lg font-bold text-[#1A1F36]">Define the Student Experience</h1>
          </div>
        </div>

        {!result && (
          <div className="bg-white rounded-2xl p-5 border border-gray-100 mb-4">
            <p className="text-xs font-semibold text-[#F4B942] uppercase tracking-wide mb-2">Why this matters</p>
            <p className="text-sm text-gray-600 leading-relaxed">
              The course experience begins after the content is uploaded. KLARO will design how your students
              move through the course — delivery cadence, support, community, completion, certification —
              based on your audience&apos;s specific needs.
            </p>
          </div>
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
            {/* Rationale */}
            <div className="bg-white rounded-2xl p-5 border-2 border-[#F4B942] mb-4" style={{ boxShadow: '0 0 0 3px rgba(244, 185, 66, 0.15)' }}>
              <p className="text-xs font-bold text-[#F4B942] uppercase tracking-wide mb-2">Why This Plan Fits</p>
              <p className="text-sm text-gray-700 leading-relaxed">{result.rationale_for_user}</p>
            </div>

            {/* Plan grid */}
            <div className="bg-white rounded-2xl p-4 border border-gray-100 mb-4">
              <p className="text-xs font-bold text-[#1A1F36] uppercase tracking-wide mb-3">Your Experience Plan</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {Object.entries(result.plan).map(([key, value]) => (
                  <div key={key} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                    <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-0.5">
                      {FIELD_LABELS[key] ?? key}
                    </p>
                    <p className="text-sm font-semibold text-[#1A1F36]">{VALUE_LABELS[value] ?? value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Onboarding outline */}
            {result.onboarding_outline && (
              <div className="bg-white rounded-2xl p-5 border border-gray-100 mb-3">
                <p className="text-xs font-bold text-[#1A1F36] uppercase tracking-wide mb-2">Onboarding Outline</p>
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{result.onboarding_outline}</p>
              </div>
            )}

            {/* Milestone plan */}
            {result.milestone_plan && result.milestone_plan.length > 0 && (
              <div className="bg-white rounded-2xl p-5 border border-gray-100 mb-3">
                <p className="text-xs font-bold text-[#1A1F36] uppercase tracking-wide mb-2">Milestone Plan</p>
                <ul className="space-y-2">
                  {result.milestone_plan.map((m, i) => (
                    <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                      <span className="text-[#F4B942] mt-0.5">●</span>
                      <span>{m}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
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
                Designing the experience…
              </>
            ) : (
              'Design Student Experience'
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
              {approving ? 'Saving…' : 'Lock In Experience →'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
