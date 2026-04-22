'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import ValidatorFeedback from '../_components/ValidatorFeedback'

// Screen 4 — Chapter Audit

interface ChapterEntry {
  source_chapter_id: number
  chapter_title: string
  structural_verdict: string
  support_needs: string[]
  rationale: string
}

interface ChapterAuditPayload {
  chapter_audit: ChapterEntry[]
  summary: Record<string, number>
}

interface QCResponse {
  draft: ChapterAuditPayload
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

const VERDICT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  KEEP:   { bg: '#ecfdf5', text: '#065f46', border: '#10B981' },
  EXPAND: { bg: '#eff6ff', text: '#1e40af', border: '#3b82f6' },
  MERGE:  { bg: '#FFFBEB', text: '#92400e', border: '#F4B942' },
  SPLIT:  { bg: '#fdf2f8', text: '#9d174d', border: '#ec4899' },
  ADAPT:  { bg: '#f5f3ff', text: '#5b21b6', border: '#8b5cf6' },
  MOVE:   { bg: '#f0fdfa', text: '#115e59', border: '#14b8a6' },
  REMOVE: { bg: '#fef2f2', text: '#991b1b', border: '#ef4444' },
}

export default function ChapterAuditPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [approving, setApproving] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<ChapterAuditPayload | null>(null)
  const [qc, setQc] = useState<QCResponse | null>(null)

  useEffect(() => {
    fetch('/api/module8/session')
      .then(r => r.json())
      .then(data => {
        if (!data.session) { router.replace('/module/8'); return }
        const existing = data.approved_outputs_by_screen?.[4] as ChapterAuditPayload | undefined
        if (existing) setResult(existing)
        setLoading(false)
      })
      .catch(() => router.replace('/module/8'))
  }, [router])

  async function handleGenerate() {
    setGenerating(true)
    setError('')
    try {
      const res = await fetch('/api/module8/screen/4/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.error === 'missing_upstream_context') {
          setError(`Missing required context: ${(data.missing ?? []).join(', ')}. Ensure your ebook is completed in Module 2.`)
          return
        }
        setError(data.detail ?? data.error ?? 'Could not audit your chapters. Please try again.')
        return
      }
      setResult(data.draft as ChapterAuditPayload)
      setQc(data as QCResponse)
    } catch {
      setError('Could not audit your chapters. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  async function handleApprove() {
    if (!result) return
    setApproving(true)
    try {
      const res = await fetch('/api/module8/screen/4/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload: result }),
      })
      if (res.ok) router.push('/module/8/course-skeleton')
    } finally {
      setApproving(false)
    }
  }

  function updateEntry(index: number, field: keyof ChapterEntry, value: string | string[]) {
    if (!result) return
    const updated = { ...result }
    updated.chapter_audit = updated.chapter_audit.map((entry, i) =>
      i === index ? { ...entry, [field]: value } : entry
    )
    setResult(updated)
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
        <Link href="/module/8/course-type" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-[#1A1F36] mb-4">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back
        </Link>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: '#F4B942' }}>
            <span className="font-bold text-[#1A1F36] text-sm">4</span>
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Module 8 · Screen 4</p>
            <h1 className="text-lg font-bold text-[#1A1F36]">Audit Your E-book</h1>
          </div>
        </div>

        {!result && (
          <div className="bg-white rounded-2xl p-5 border border-gray-100 mb-4">
            <p className="text-xs font-semibold text-[#F4B942] uppercase tracking-wide mb-2">Why this matters</p>
            <p className="text-sm text-gray-600 leading-relaxed">
              Not every chapter should become a lesson. KLARO will classify each chapter:
              what to keep, expand, merge, move, or cut entirely. Your e-book is raw material,
              not the final course structure.
            </p>
          </div>
        )}

        {/* Validator feedback */}
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

        {/* Summary card */}
        {result && (
          <div className="bg-white rounded-2xl p-4 border border-gray-100 mb-4">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-2">Audit Summary</p>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(result.summary).filter(([, count]) => count > 0).map(([verdict, count]) => (
                <span
                  key={verdict}
                  className="text-xs font-semibold px-2 py-1 rounded-full"
                  style={{
                    background: VERDICT_COLORS[verdict]?.bg ?? '#f3f4f6',
                    color: VERDICT_COLORS[verdict]?.text ?? '#374151',
                    border: `1px solid ${VERDICT_COLORS[verdict]?.border ?? '#e5e7eb'}`,
                  }}
                >
                  {verdict} × {count}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Chapter list */}
        {result?.chapter_audit.map((entry, i) => (
          <div key={entry.source_chapter_id} className="bg-white rounded-2xl p-4 border border-gray-100 mb-3">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Chapter {entry.source_chapter_id}</p>
                <p className="text-sm font-bold text-[#1A1F36] leading-snug">{entry.chapter_title}</p>
              </div>
              <span
                className="text-xs font-bold px-2 py-1 rounded-full flex-shrink-0"
                style={{
                  background: VERDICT_COLORS[entry.structural_verdict]?.bg,
                  color: VERDICT_COLORS[entry.structural_verdict]?.text,
                  border: `1px solid ${VERDICT_COLORS[entry.structural_verdict]?.border}`,
                }}
              >
                {entry.structural_verdict}
              </span>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed mb-3">{entry.rationale}</p>

            {/* Support needs */}
            <div className="mb-2">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Support</p>
              <div className="flex flex-wrap gap-1">
                {entry.support_needs.map(need => (
                  <span key={need} className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 capitalize">
                    {need.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            </div>

            {/* Override controls */}
            <details className="mt-2">
              <summary className="text-xs text-[#F4B942] font-semibold cursor-pointer">Override verdict</summary>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {['KEEP', 'EXPAND', 'MERGE', 'SPLIT', 'ADAPT', 'MOVE', 'REMOVE'].map(v => (
                  <button
                    key={v}
                    onClick={() => updateEntry(i, 'structural_verdict', v)}
                    className="text-[10px] px-2 py-1 rounded-full transition-all"
                    style={{
                      background: entry.structural_verdict === v
                        ? VERDICT_COLORS[v].bg
                        : '#f3f4f6',
                      color: entry.structural_verdict === v
                        ? VERDICT_COLORS[v].text
                        : '#6b7280',
                      border: entry.structural_verdict === v
                        ? `1px solid ${VERDICT_COLORS[v].border}`
                        : '1px solid #e5e7eb',
                      fontWeight: entry.structural_verdict === v ? 700 : 400,
                    }}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </details>
          </div>
        ))}

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
                Auditing your chapters…
              </>
            ) : (
              'Audit My E-book'
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
              {approving ? 'Saving…' : 'Looks Good →'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
