'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import ValidatorFeedback from '../_components/ValidatorFeedback'

// Screen 7 — Implementation Layer (1-3 assets per module)

interface Asset {
  type: string
  title: string
  purpose: string
}

interface ModuleAssets {
  module_number: number
  module_title: string
  assets: Asset[]
}

interface ImplementationLayerPayload {
  asset_map: ModuleAssets[]
  reused_from_offer_stack?: string[]
  asset_coverage_complete: boolean
}

interface QCResponse {
  draft: ImplementationLayerPayload
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

const ASSET_ICONS: Record<string, string> = {
  video:            '🎥',
  text_lesson:      '📄',
  worksheet:        '📝',
  checklist:        '✅',
  prompt_pack:      '💭',
  template:         '📋',
  tracker:          '📊',
  audio_guide:      '🎧',
  script_card:      '📇',
  demo_walkthrough: '🎬',
  case_study:       '📖',
  faq:              '❓',
}

export default function ImplementationLayerPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [approving, setApproving] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<ImplementationLayerPayload | null>(null)
  const [qc, setQc] = useState<QCResponse | null>(null)

  useEffect(() => {
    fetch('/api/module8/session')
      .then(r => r.json())
      .then(data => {
        if (!data.session) { router.replace('/module/8'); return }
        const existing = data.approved_outputs_by_screen?.[7] as ImplementationLayerPayload | undefined
        if (existing) setResult(existing)
        setLoading(false)
      })
      .catch(() => router.replace('/module/8'))
  }, [router])

  async function handleGenerate() {
    setGenerating(true)
    setError('')
    try {
      const res = await fetch('/api/module8/screen/7/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.error === 'missing_upstream_context') {
          setError(`Missing required context: ${(data.missing ?? []).join(', ')}. Please complete Screens 5 and 6 first.`)
          return
        }
        setError(data.detail ?? data.error ?? 'Could not generate asset plan.')
        return
      }
      setResult(data.draft as ImplementationLayerPayload)
      setQc(data as QCResponse)
    } catch {
      setError('Could not generate asset plan.')
    } finally {
      setGenerating(false)
    }
  }

  async function handleApprove() {
    if (!result) return
    setApproving(true)
    try {
      const res = await fetch('/api/module8/screen/7/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload: result }),
      })
      if (res.ok) router.push('/module/8/student-experience')
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
        <Link href="/module/8/lesson-map" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-[#1A1F36] mb-4">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back
        </Link>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: '#F4B942' }}>
            <span className="font-bold text-[#1A1F36] text-sm">7</span>
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Module 8 · Screen 7</p>
            <h1 className="text-lg font-bold text-[#1A1F36]">Add the Implementation Layer</h1>
          </div>
        </div>

        {!result && (
          <div className="bg-white rounded-2xl p-5 border border-gray-100 mb-4">
            <p className="text-xs font-semibold text-[#F4B942] uppercase tracking-wide mb-2">Why this matters</p>
            <p className="text-sm text-gray-600 leading-relaxed">
              Students are happiest when they know exactly what to do next. KLARO will recommend 1-3 implementation
              assets per module (worksheets, checklists, templates, etc.) so your course is about execution,
              not just information.
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

        {/* Reused from offer stack */}
        {result && result.reused_from_offer_stack && result.reused_from_offer_stack.length > 0 && (
          <div className="rounded-2xl p-4 mb-4" style={{ background: '#ecfdf5', border: '1px solid #10B981' }}>
            <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wide mb-2">Reused from Your Offer Stack</p>
            <ul className="space-y-1">
              {result.reused_from_offer_stack.map((note, i) => (
                <li key={i} className="text-xs text-emerald-800">● {note}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Per-module asset cards */}
        {result?.asset_map.map(modAssets => (
          <div key={modAssets.module_number} className="bg-white rounded-2xl p-4 border border-gray-100 mb-3">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#FFFBEB', border: '1px solid #F4B942' }}>
                <span className="text-[#F4B942] font-bold text-xs">{modAssets.module_number}</span>
              </div>
              <p className="text-sm font-bold text-[#1A1F36]">{modAssets.module_title}</p>
            </div>
            <div className="space-y-2">
              {modAssets.assets.map((asset, i) => (
                <div key={i} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                  <div className="flex items-start gap-2">
                    <span className="text-lg flex-shrink-0 leading-none">{ASSET_ICONS[asset.type] ?? '📎'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-semibold text-[#1A1F36]">{asset.title}</p>
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-gray-200 text-gray-600 capitalize">
                          {asset.type.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 leading-relaxed">{asset.purpose}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

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
                Planning implementation assets…
              </>
            ) : (
              'Plan Implementation Assets'
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
              {approving ? 'Saving…' : 'Lock In Assets →'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
