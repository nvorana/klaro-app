'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

// Screen 2 — Reconfirm the Transformation

interface TransformationPayload {
  course_transformation_statement: string
  target_learner: string
  course_outcome: string
  unique_method: string
  implicit_outcomes: string[]
  duration_commitment: string
  audience_protective_clause?: string
}

interface UserInputs {
  course_audience: string
  course_problem: string
  course_result: string
  course_method: string
  student_capability: string
  duration_commitment?: string
}

interface ApprovedOutputs {
  clarity_sentence?: string
  target_market?: string
  core_problem?: string
  unique_mechanism?: string
  ebook_title?: string
}

export default function TransformationPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [approving, setApproving] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<TransformationPayload | null>(null)
  const [upstreamContext, setUpstreamContext] = useState<ApprovedOutputs>({})

  const [inputs, setInputs] = useState<UserInputs>({
    course_audience: '',
    course_problem: '',
    course_result: '',
    course_method: '',
    student_capability: '',
    duration_commitment: '',
  })

  useEffect(() => {
    async function load() {
      const res = await fetch('/api/module8/session')
      const data = await res.json()
      if (!data.session) { router.replace('/module/8'); return }

      // Fetch upstream KLARO context (clarity + ebook) for pre-fill
      const ctxRes = await fetch('/api/module8/upstream-context')
      if (ctxRes.ok) {
        const ctx = await ctxRes.json()
        setUpstreamContext(ctx.context ?? {})
        setInputs(prev => ({
          ...prev,
          course_audience: prev.course_audience || (ctx.context?.target_market ?? ''),
          course_problem: prev.course_problem || (ctx.context?.core_problem ?? ''),
          course_method: prev.course_method || (ctx.context?.unique_mechanism ?? ''),
        }))
      }

      // Preload existing approved output if user revisits
      const existing = data.approved_outputs_by_screen?.[2] as TransformationPayload | undefined
      if (existing) {
        setResult(existing)
      }

      setLoading(false)
    }
    load()
  }, [router])

  const allFilled = inputs.course_audience.trim() && inputs.course_problem.trim() &&
    inputs.course_result.trim() && inputs.course_method.trim() && inputs.student_capability.trim()

  async function handleGenerate() {
    if (!allFilled) return
    setGenerating(true)
    setError('')
    try {
      const res = await fetch('/api/module8/screen/2/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inputs),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.error === 'missing_upstream_context') {
          setError(`Missing required data from earlier modules: ${(data.missing ?? []).join(', ')}. Please ensure Modules 1 and 2 are fully completed.`)
          return
        }
        setError(data.detail ?? data.error ?? 'Could not generate. Please try again.')
        return
      }
      setResult(data.draft as TransformationPayload)
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
      const res = await fetch('/api/module8/screen/2/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload: result }),
      })
      if (res.ok) router.push('/module/8/course-type')
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
        <Link href="/module/8/readiness" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-[#1A1F36] mb-4">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back
        </Link>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: '#F4B942' }}>
            <span className="font-bold text-[#1A1F36] text-sm">2</span>
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Module 8 · Screen 2</p>
            <h1 className="text-lg font-bold text-[#1A1F36]">Reconfirm the Transformation</h1>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-gray-100 mb-4">
          <p className="text-xs font-semibold text-[#F4B942] uppercase tracking-wide mb-2">Why this matters</p>
          <p className="text-sm text-gray-600 leading-relaxed">
            A course should not only teach ideas — it should help people DO something specific.
            We&apos;ve prefilled what KLARO knows from your earlier work. Review, sharpen, then let us
            craft the transformation statement.
          </p>
        </div>

        {!result && (
          <>
            <Field
              label="Who is this course for?"
              value={inputs.course_audience}
              onChange={v => setInputs(prev => ({ ...prev, course_audience: v }))}
              placeholder="e.g. Filipino dog owners dealing with recurring flea problems"
              rows={2}
            />
            <Field
              label="What painful problem are they trying to solve?"
              value={inputs.course_problem}
              onChange={v => setInputs(prev => ({ ...prev, course_problem: v }))}
              placeholder="e.g. Their dogs keep scratching, and expensive products don't work"
              rows={2}
            />
            <Field
              label="What exact result should they get by the end?"
              value={inputs.course_result}
              onChange={v => setInputs(prev => ({ ...prev, course_result: v }))}
              placeholder="e.g. A flea-free home and dog within 30 days, no more expensive products"
              rows={2}
            />
            <Field
              label="What method or approach are you teaching?"
              value={inputs.course_method}
              onChange={v => setInputs(prev => ({ ...prev, course_method: v }))}
              placeholder="e.g. The Pawsitive Shield Flea Elimination System"
              rows={2}
            />
            <Field
              label="What should students be able to DO after finishing?"
              value={inputs.student_capability}
              onChange={v => setInputs(prev => ({ ...prev, student_capability: v }))}
              placeholder="e.g. Identify breeding hotspots, apply the 3-step treatment, prevent re-infestation"
              rows={3}
            />
            <Field
              label="Preferred duration (optional)"
              value={inputs.duration_commitment ?? ''}
              onChange={v => setInputs(prev => ({ ...prev, duration_commitment: v }))}
              placeholder="e.g. 6 weeks, or 30-day guided journey"
              rows={1}
            />
          </>
        )}

        {error && (
          <div className="mb-3 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
            {error}
          </div>
        )}

        {result && (
          <div className="bg-white rounded-2xl p-5 border-2 border-[#F4B942] mb-4" style={{ boxShadow: '0 0 0 3px rgba(244, 185, 66, 0.15)' }}>
            <p className="text-xs font-bold text-[#F4B942] uppercase tracking-wide mb-3">Your Course Transformation Statement</p>
            <p className="text-sm text-[#1A1F36] leading-relaxed font-medium mb-4">{result.course_transformation_statement}</p>

            <hr className="border-gray-200 mb-3" />

            <ResultRow label="Target learner" value={result.target_learner} />
            <ResultRow label="Outcome" value={result.course_outcome} />
            <ResultRow label="Method" value={result.unique_method} />
            <ResultRow label="Duration" value={result.duration_commitment} />
            {result.audience_protective_clause && (
              <ResultRow label="Protection" value={result.audience_protective_clause} />
            )}

            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-4 mb-2">Students will be able to:</p>
            <ul className="space-y-1.5">
              {result.implicit_outcomes.map((outcome, i) => (
                <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                  <span className="text-emerald-600 mt-0.5">●</span>
                  <span>{outcome}</span>
                </li>
              ))}
            </ul>
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
            disabled={!allFilled || generating}
            className="w-full py-4 rounded-xl font-bold text-base disabled:opacity-40 flex items-center justify-center gap-2"
            style={{ background: '#F4B942', color: '#1A1F36' }}
          >
            {generating ? (
              <>
                <div className="w-4 h-4 border-2 border-[#1A1F36] border-t-transparent rounded-full animate-spin" />
                Crafting your transformation…
              </>
            ) : (
              'Craft the Transformation'
            )}
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => setResult(null)}
              className="flex-1 py-4 rounded-xl font-semibold text-sm"
              style={{ background: '#F3F4F6', color: '#6B7280', border: '1px solid #e5e7eb' }}
            >
              Regenerate
            </button>
            <button
              onClick={handleApprove}
              disabled={approving}
              className="flex-[2] py-4 rounded-xl font-bold text-base disabled:opacity-50"
              style={{ background: '#F4B942', color: '#1A1F36' }}
            >
              {approving ? 'Saving…' : 'Looks Good →'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function Field({ label, value, onChange, placeholder, rows = 2 }: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  rows?: number
}) {
  return (
    <div className="bg-white rounded-2xl p-4 border border-gray-100 mb-3">
      <p className="text-xs font-semibold text-[#1A1F36] mb-2">{label}</p>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full bg-gray-50 text-[#1A1F36] text-sm px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#F4B942] focus:border-[#F4B942] resize-none"
      />
    </div>
  )
}

function ResultRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-2">
      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-sm text-[#1A1F36]">{value}</p>
    </div>
  )
}
