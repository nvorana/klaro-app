'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

// Screen 1 — Course Readiness Check
// User answers 5 closed-list questions. Server computes score + verdict
// deterministically. Creator generates coach_notes + recommended_next_path.

type Option = { value: string; label: string }

interface Question {
  field: string
  question: string
  helper?: string
  options: Option[]
}

const QUESTIONS: Question[] = [
  {
    field: 'ebook_finished_status',
    question: 'Is your e-book finished?',
    options: [
      { value: 'finished', label: 'Yes — finished and published' },
      { value: 'almost_finished', label: 'Almost finished, just polish left' },
      { value: 'not_finished', label: 'Not finished yet' },
    ],
  },
  {
    field: 'ebook_sales_signal',
    question: 'Have you sold your e-book yet?',
    options: [
      { value: '10_plus_sales', label: 'Yes — 10 or more customers' },
      { value: 'few_sales', label: 'A few sales so far' },
      { value: 'no_sales', label: 'Not yet' },
    ],
  },
  {
    field: 'buyer_feedback_signal',
    question: 'Have buyers given you real feedback?',
    helper: 'Messages, reviews, or replies that tell you what worked for them.',
    options: [
      { value: 'yes_multiple', label: 'Yes — multiple buyers' },
      { value: 'yes_some', label: 'A little feedback' },
      { value: 'no_feedback', label: 'No feedback yet' },
    ],
  },
  {
    field: 'audience_pull_signal',
    question: 'Has your audience asked for a course or deeper help?',
    options: [
      { value: 'yes_directly_asked', label: 'Yes — they directly asked' },
      { value: 'some_interest', label: 'Some interest but not directly asked' },
      { value: 'no_interest', label: 'Not really' },
    ],
  },
  {
    field: 'time_energy_next_6_weeks',
    question: 'How much time and energy do you have for the next 6 weeks?',
    options: [
      { value: 'plenty', label: 'Plenty — this is a priority' },
      { value: 'some', label: 'Some — I can work on it weekly' },
      { value: 'very_little', label: 'Very little right now' },
    ],
  },
]

interface ReadinessPayload {
  readiness_score: number
  readiness_verdict: 'ready' | 'borderline' | 'not_ready'
  recommended_next_path: string
  coach_notes: string
  ebook_finished_status: string
  ebook_sales_signal: string
  buyer_feedback_signal: string
  audience_pull_signal: string
  time_energy_next_6_weeks: string
}

const VERDICT_COPY: Record<string, { label: string; color: string; bg: string; border: string }> = {
  ready:      { label: 'Ready', color: '#065f46', bg: '#ecfdf5', border: '#10B981' },
  borderline: { label: 'Borderline', color: '#92400e', bg: '#FFFBEB', border: '#F4B942' },
  not_ready:  { label: 'Not Ready (advisory)', color: '#7f1d1d', bg: '#fef2f2', border: '#f87171' },
}

const PATH_LABELS: Record<string, string> = {
  course_ready: 'Course-ready',
  workshop_may_be_better: 'A workshop may be a better fit',
  needs_clearer_proof_first: 'Prove the ebook first',
  better_as_implementation_course: 'Better as an implementation course',
  better_as_quick_start_course: 'Better as a quick-start course',
}

export default function ReadinessPage() {
  const router = useRouter()
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState<ReadinessPayload | null>(null)
  const [error, setError] = useState('')
  const [approving, setApproving] = useState(false)

  useEffect(() => {
    fetch('/api/module8/session')
      .then(r => r.json())
      .then(data => {
        if (!data.session) {
          router.replace('/module/8')
          return
        }
        // Preload existing answer if user revisits
        const existing = data.approved_outputs_by_screen?.[1]
        if (existing) {
          setAnswers({
            ebook_finished_status: existing.ebook_finished_status,
            ebook_sales_signal: existing.ebook_sales_signal,
            buyer_feedback_signal: existing.buyer_feedback_signal,
            audience_pull_signal: existing.audience_pull_signal,
            time_energy_next_6_weeks: existing.time_energy_next_6_weeks,
          })
          setResult(existing as ReadinessPayload)
        }
        setLoading(false)
      })
      .catch(() => router.replace('/module/8'))
  }, [router])

  const allAnswered = QUESTIONS.every(q => answers[q.field])

  async function handleGenerate() {
    if (!allAnswered) return
    setGenerating(true)
    setError('')
    try {
      const res = await fetch('/api/module8/screen/1/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.detail ?? data.error ?? 'Could not generate. Please try again.')
        return
      }
      setResult(data.draft as ReadinessPayload)
    } catch {
      setError('Could not generate. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  async function handleContinue() {
    if (!result) return
    setApproving(true)
    try {
      const res = await fetch('/api/module8/screen/1/approve', { method: 'POST' })
      if (res.ok) {
        router.push('/module/8/transformation')
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
        <Link href="/module/8/orientation" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-[#1A1F36] mb-4">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back
        </Link>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: '#F4B942' }}>
            <span className="font-bold text-[#1A1F36] text-sm">1</span>
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Module 8 · Screen 1</p>
            <h1 className="text-lg font-bold text-[#1A1F36]">Course Readiness Check</h1>
          </div>
        </div>

        {!result && (
          <div className="bg-white rounded-2xl p-5 border border-gray-100 mb-4">
            <p className="text-sm text-gray-600 leading-relaxed">
              Before we build a course, let&apos;s make sure it&apos;s the right next step.
              This is advisory — you can proceed either way.
            </p>
          </div>
        )}

        {/* Questions */}
        {QUESTIONS.map(q => (
          <div key={q.field} className="bg-white rounded-2xl p-5 border border-gray-100 mb-3">
            <p className="text-sm font-semibold text-[#1A1F36] mb-1">{q.question}</p>
            {q.helper && <p className="text-xs text-gray-500 mb-3">{q.helper}</p>}
            <div className="space-y-2 mt-3">
              {q.options.map(opt => {
                const selected = answers[q.field] === opt.value
                return (
                  <button
                    key={opt.value}
                    onClick={() => setAnswers(prev => ({ ...prev, [q.field]: opt.value }))}
                    className="w-full text-left px-4 py-3 rounded-xl text-sm transition-all"
                    style={{
                      background: selected ? '#FFFBEB' : '#F8F9FA',
                      border: selected ? '2px solid #F4B942' : '1px solid #e5e7eb',
                      color: selected ? '#1A1F36' : '#4b5563',
                      fontWeight: selected ? 600 : 400,
                    }}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </div>
        ))}

        {error && (
          <div className="mb-3 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Results */}
        {result && (
          <div
            className="rounded-2xl p-5 mb-4"
            style={{
              background: VERDICT_COPY[result.readiness_verdict].bg,
              border: `1px solid ${VERDICT_COPY[result.readiness_verdict].border}`,
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold uppercase tracking-wide" style={{ color: VERDICT_COPY[result.readiness_verdict].color }}>
                Your Readiness
              </p>
              <span className="text-sm font-bold text-[#1A1F36]">{result.readiness_score}/10</span>
            </div>
            <p className="text-base font-bold text-[#1A1F36] mb-2">
              {VERDICT_COPY[result.readiness_verdict].label}
            </p>
            <p className="text-sm text-gray-700 mb-3">
              <span className="font-semibold">Recommended path:</span> {PATH_LABELS[result.recommended_next_path] ?? result.recommended_next_path}
            </p>
            <p className="text-sm text-gray-600 leading-relaxed">
              {result.coach_notes}
            </p>
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
            disabled={!allAnswered || generating}
            className="w-full py-4 rounded-xl font-bold text-base disabled:opacity-40 flex items-center justify-center gap-2"
            style={{ background: '#F4B942', color: '#1A1F36' }}
          >
            {generating ? (
              <>
                <div className="w-4 h-4 border-2 border-[#1A1F36] border-t-transparent rounded-full animate-spin" />
                Checking readiness…
              </>
            ) : (
              'Check My Readiness'
            )}
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => setResult(null)}
              className="flex-1 py-4 rounded-xl font-semibold text-sm"
              style={{ background: '#F3F4F6', color: '#6B7280', border: '1px solid #e5e7eb' }}
            >
              Edit answers
            </button>
            <button
              onClick={handleContinue}
              disabled={approving}
              className="flex-[2] py-4 rounded-xl font-bold text-base disabled:opacity-50"
              style={{ background: '#F4B942', color: '#1A1F36' }}
            >
              {approving ? 'Saving…' : 'Continue →'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
