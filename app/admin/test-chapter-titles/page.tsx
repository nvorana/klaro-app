'use client'

import { useState } from 'react'
import Link from 'next/link'

const FOUNDATIONS = [
  { id: 'softening_silence', label: 'Healing / Grief — Softening the Silence' },
  { id: 'pet_fleas',         label: 'Pet Care — Pawsitive Shield' },
  { id: 'ofw_savings',       label: 'Finance / OFW — First ₱100K Roadmap' },
]

interface ChapterRow { number: number; title: string; goal: string }

interface Result {
  success: boolean
  foundation_label: string
  ebook_title: string
  target_market: string
  original_titles: ChapterRow[]
  old: { chapters: ChapterRow[]; elapsed_ms: number; prompt: string }
  new: { chapters: ChapterRow[]; elapsed_ms: number; prompt: string }
}

export default function TestChapterTitlesPage() {
  const [foundationId, setFoundationId] = useState<string>('softening_silence')
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState('')
  const [winner, setWinner] = useState<'old' | 'new' | null>(null)
  const [showOldPrompt, setShowOldPrompt] = useState(false)
  const [showNewPrompt, setShowNewPrompt] = useState(false)

  async function runComparison() {
    setRunning(true)
    setError('')
    setResult(null)
    setWinner(null)
    try {
      const res = await fetch('/api/admin/test-chapter-titles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ foundation_id: foundationId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.detail ?? data.error ?? 'Comparison failed')
        return
      }
      setResult(data as Result)
    } finally {
      setRunning(false)
    }
  }

  // Build a unified row table — original/old/new aligned by chapter number
  const rows = result
    ? result.original_titles.map(orig => ({
        number: orig.number,
        goal: orig.goal,
        original: orig.title,
        old: result.old.chapters.find(c => c.number === orig.number)?.title ?? '—',
        new: result.new.chapters.find(c => c.number === orig.number)?.title ?? '—',
      }))
    : []

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      <div className="max-w-7xl mx-auto px-4 pt-6 pb-12">
        <Link href="/admin" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-[#1A1F36] mb-4">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back to Admin
        </Link>

        <div className="mb-6">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Admin · Prompt A/B Test</p>
          <h1 className="text-xl font-bold text-[#1A1F36]">Chapter Titles — Old vs New Prompt</h1>
          <p className="text-sm text-gray-500 mt-1">
            Compares the current production title-generation rules against a sales-copy-styled rewrite. Same chapter goals, same model, same temperature — only the prompt differs.
          </p>
        </div>

        {/* Inputs */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100 mb-4">
          <p className="text-xs font-semibold text-[#1A1F36] uppercase tracking-wide mb-3">Test Input</p>

          <div className="mb-3">
            <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Foundation (niche)</label>
            <select
              value={foundationId}
              onChange={e => setFoundationId(e.target.value)}
              disabled={running}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
            >
              {FOUNDATIONS.map(f => (
                <option key={f.id} value={f.id}>{f.label}</option>
              ))}
            </select>
          </div>

          <button
            onClick={runComparison}
            disabled={running}
            className="w-full py-3 rounded-xl font-bold text-sm disabled:opacity-50"
            style={{ background: '#F4B942', color: '#1A1F36' }}
          >
            {running ? 'Running both prompts in parallel…' : 'Run Side-by-Side Comparison'}
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700 mb-4">
            {error}
          </div>
        )}

        {/* Results */}
        {result && (
          <>
            <div className="bg-white rounded-2xl p-4 border border-gray-100 mb-4">
              <p className="text-xs text-gray-500 mb-1">{result.foundation_label}</p>
              <p className="text-sm font-bold text-[#1A1F36]">{result.ebook_title}</p>
              <p className="text-xs text-gray-500 mt-1">For: {result.target_market}</p>
            </div>

            {/* Verdict */}
            <div className="bg-white rounded-2xl p-4 border border-gray-100 mb-4 flex items-center justify-between">
              <p className="text-sm font-semibold text-[#1A1F36]">Which one is better?</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setWinner('old')}
                  className="px-4 py-2 rounded-lg text-xs font-bold transition-all"
                  style={{
                    background: winner === 'old' ? '#1A1F36' : '#f3f4f6',
                    color: winner === 'old' ? '#F4B942' : '#6b7280',
                    border: winner === 'old' ? '2px solid #F4B942' : '1px solid #e5e7eb',
                  }}
                >
                  Old wins
                </button>
                <button
                  onClick={() => setWinner('new')}
                  className="px-4 py-2 rounded-lg text-xs font-bold transition-all"
                  style={{
                    background: winner === 'new' ? '#1A1F36' : '#f3f4f6',
                    color: winner === 'new' ? '#F4B942' : '#6b7280',
                    border: winner === 'new' ? '2px solid #F4B942' : '1px solid #e5e7eb',
                  }}
                >
                  New wins
                </button>
                <button
                  onClick={() => setWinner(null)}
                  className="px-4 py-2 rounded-lg text-xs font-bold transition-all"
                  style={{ background: '#f3f4f6', color: '#6b7280', border: '1px solid #e5e7eb' }}
                >
                  Tie / unclear
                </button>
              </div>
            </div>

            {/* 4-column comparison table: # | Original | Old | New */}
            <div className="bg-white rounded-2xl border border-gray-100 mb-4 overflow-hidden">
              <div className="grid grid-cols-[40px_1fr_1fr_1fr] bg-gray-50 border-b border-gray-200 text-[10px] font-bold uppercase tracking-wide text-gray-500">
                <div className="px-3 py-2.5">#</div>
                <div className="px-3 py-2.5">ORIGINAL (foundation reference)</div>
                <div
                  className="px-3 py-2.5"
                  style={winner === 'old' ? { background: '#FFFBEB', color: '#92400e' } : undefined}
                >
                  OLD PROMPT ({(result.old.elapsed_ms / 1000).toFixed(1)}s)
                </div>
                <div
                  className="px-3 py-2.5"
                  style={winner === 'new' ? { background: '#FFFBEB', color: '#92400e' } : undefined}
                >
                  NEW PROMPT ({(result.new.elapsed_ms / 1000).toFixed(1)}s)
                </div>
              </div>

              {rows.map(r => (
                <div
                  key={r.number}
                  className="grid grid-cols-[40px_1fr_1fr_1fr] border-b border-gray-100 last:border-b-0 text-sm hover:bg-gray-50 transition-colors"
                >
                  <div className="px-3 py-3 text-gray-400 font-bold">{r.number}</div>
                  <div className="px-3 py-3 text-gray-500 italic text-xs leading-snug">{r.original}</div>
                  <div
                    className="px-3 py-3 leading-snug"
                    style={{
                      background: winner === 'old' ? '#FFFBEB' : undefined,
                      color: winner === 'old' ? '#1A1F36' : '#374151',
                      fontWeight: winner === 'old' ? 600 : 500,
                    }}
                  >
                    {r.old}
                  </div>
                  <div
                    className="px-3 py-3 leading-snug"
                    style={{
                      background: winner === 'new' ? '#FFFBEB' : undefined,
                      color: winner === 'new' ? '#1A1F36' : '#374151',
                      fontWeight: winner === 'new' ? 600 : 500,
                    }}
                  >
                    {r.new}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between gap-3 mb-4">
              <button
                onClick={runComparison}
                disabled={running}
                className="px-6 py-2 rounded-lg text-sm font-semibold border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {running ? 'Running…' : 'Run again (different output)'}
              </button>
              <div className="flex gap-2 text-xs">
                <button
                  onClick={() => setShowOldPrompt(v => !v)}
                  className="text-gray-500 hover:text-[#1A1F36] underline"
                >
                  {showOldPrompt ? 'Hide' : 'Show'} old prompt
                </button>
                <button
                  onClick={() => setShowNewPrompt(v => !v)}
                  className="text-gray-500 hover:text-[#1A1F36] underline"
                >
                  {showNewPrompt ? 'Hide' : 'Show'} new prompt
                </button>
              </div>
            </div>

            {showOldPrompt && (
              <details open className="mb-4">
                <summary className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 cursor-pointer">Old prompt</summary>
                <pre className="text-[11px] text-gray-700 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap font-mono leading-snug border border-gray-200">
                  {result.old.prompt}
                </pre>
              </details>
            )}

            {showNewPrompt && (
              <details open className="mb-4">
                <summary className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 cursor-pointer">New prompt</summary>
                <pre className="text-[11px] text-gray-700 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap font-mono leading-snug border border-gray-200">
                  {result.new.prompt}
                </pre>
              </details>
            )}
          </>
        )}
      </div>
    </div>
  )
}
