'use client'

import { useState } from 'react'
import Link from 'next/link'

interface ChapterMeta {
  chapter_number: number
  title: string
  core_lessons: string
}

interface Foundation {
  id: string
  label: string
  target_market: string
  ebook_title: string
  chapters: ChapterMeta[]
}

const FOUNDATIONS: Foundation[] = [
  {
    id: 'softening_silence',
    label: 'Healing / Grief — Softening the Silence',
    target_market: 'women struggling with infertility and silent grief',
    ebook_title: 'Softening the Silence: A Healing Journey Through Infertility and Grief',
    chapters: [
      { chapter_number: 1, title: 'The Weight of Unspoken Pain', core_lessons: 'Naming pain, disenfranchised grief intro, early grounding practices' },
      { chapter_number: 2, title: 'Understanding the Grief No One Talks About', core_lessons: 'Disenfranchised grief, psychological toll, why grief is valid' },
      { chapter_number: 3, title: 'Why Numbness Becomes the Default', core_lessons: 'Freeze response, protective shutdown, cost of numbness, thawing' },
      { chapter_number: 5, title: 'Pillar 1 – Awareness: Naming the Pain', core_lessons: 'Affect labeling, body scan, sentence starters' },
    ],
  },
  {
    id: 'pet_fleas',
    label: 'Pet Care — Pawsitive Shield',
    target_market: 'Filipino dog owners with persistent flea and tick problems',
    ebook_title: 'Pawsitive Shield: Keep Fleas and Ticks Off Your Dog for Good',
    chapters: [
      { chapter_number: 1, title: 'Why Fleas Keep Coming Back', core_lessons: 'Life cycle, breeding hotspots, why store products fail' },
      { chapter_number: 3, title: 'Zone 2 — Treating Your Dog', core_lessons: 'Bathing protocol, topical treatments, natural alternatives' },
      { chapter_number: 6, title: 'Handling Infested Environments', core_lessons: 'Deep cleaning protocol, when to call professionals' },
    ],
  },
  {
    id: 'ofw_savings',
    label: 'Finance / OFW — First ₱100K Roadmap',
    target_market: 'Filipino OFWs supporting family back home who have never saved before',
    ebook_title: 'The OFW First ₱100K Roadmap: From Zero Savings to Your First Milestone',
    chapters: [
      { chapter_number: 1, title: 'Why OFWs Struggle to Save', core_lessons: 'Family pressure, lifestyle inflation, no system' },
      { chapter_number: 2, title: 'The Dual-Envelope System', core_lessons: 'Core concept, why 2 envelopes, not 1 big budget' },
      { chapter_number: 5, title: 'Hitting ₱25K Milestone (Month 3)', core_lessons: 'Weekly tracking, celebration markers, adjustments' },
    ],
  },
]

interface Result {
  success: boolean
  project: { target_market: string; problem: string }
  bookTitle: string
  chapter: { number: number; title: string; goal: string }
  old: { story_starter: string; elapsed_ms: number; word_count: number; prompt: string }
  new: { story_starter: string; elapsed_ms: number; word_count: number; prompt: string }
}

export default function TestStoryStarterPage() {
  const [foundationId, setFoundationId] = useState<string>('softening_silence')
  const [chapterIndex, setChapterIndex] = useState<number>(0)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState('')
  const [winner, setWinner] = useState<'old' | 'new' | null>(null)

  const currentFoundation = FOUNDATIONS.find(f => f.id === foundationId) ?? FOUNDATIONS[0]
  const selectedChapter = currentFoundation.chapters[chapterIndex] ?? currentFoundation.chapters[0]

  async function runComparison() {
    setRunning(true)
    setError('')
    setResult(null)
    setWinner(null)
    try {
      const res = await fetch('/api/admin/test-story-starter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          foundation_id: foundationId,
          chapter_index: chapterIndex,
        }),
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
          <h1 className="text-xl font-bold text-[#1A1F36]">Story Starter — Old vs New Prompt</h1>
          <p className="text-sm text-gray-500 mt-1">
            Compares the current production Pass 2 prompt against a sales-copy-styled rewrite. Same chapter, same model, same temperature — only the prompt differs.
          </p>
        </div>

        {/* Inputs */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100 mb-4">
          <p className="text-xs font-semibold text-[#1A1F36] uppercase tracking-wide mb-3">Test Input</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Foundation (niche)</label>
              <select
                value={foundationId}
                onChange={e => { setFoundationId(e.target.value); setChapterIndex(0) }}
                disabled={running}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
              >
                {FOUNDATIONS.map(f => (
                  <option key={f.id} value={f.id}>{f.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Chapter</label>
              <select
                value={chapterIndex}
                onChange={e => setChapterIndex(Number(e.target.value))}
                disabled={running}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
              >
                {currentFoundation.chapters.map((ch, i) => (
                  <option key={ch.chapter_number} value={i}>
                    Ch {ch.chapter_number}: {ch.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-3 border border-gray-100 mb-3 text-xs text-gray-600">
            <p><span className="font-semibold">Target:</span> {currentFoundation.target_market}</p>
            <p><span className="font-semibold">Book:</span> {currentFoundation.ebook_title}</p>
            <p><span className="font-semibold">Chapter goal:</span> {selectedChapter.core_lessons}</p>
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
            {/* Verdict picker */}
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Panel
                title="OLD (current production)"
                color="#9ca3af"
                story={result.old.story_starter}
                wordCount={result.old.word_count}
                elapsedMs={result.old.elapsed_ms}
                isWinner={winner === 'old'}
                prompt={result.old.prompt}
              />
              <Panel
                title="NEW (workshop-style)"
                color="#F4B942"
                story={result.new.story_starter}
                wordCount={result.new.word_count}
                elapsedMs={result.new.elapsed_ms}
                isWinner={winner === 'new'}
                prompt={result.new.prompt}
              />
            </div>

            <div className="mt-4 text-center">
              <button
                onClick={runComparison}
                disabled={running}
                className="px-6 py-2 rounded-lg text-sm font-semibold border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Run again (different output for same chapter)
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Panel({ title, color, story, wordCount, elapsedMs, isWinner, prompt }: {
  title: string
  color: string
  story: string
  wordCount: number
  elapsedMs: number
  isWinner: boolean
  prompt: string
}) {
  const [showPrompt, setShowPrompt] = useState(false)

  return (
    <div
      className="bg-white rounded-2xl p-5 border-2 transition-all"
      style={{
        borderColor: isWinner ? color : '#e5e7eb',
        boxShadow: isWinner ? `0 0 0 3px ${color}33` : 'none',
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-bold uppercase tracking-wide" style={{ color }}>{title}</p>
        <div className="flex items-center gap-2 text-[10px] text-gray-500">
          <span>{wordCount} words</span>
          <span>·</span>
          <span>{(elapsedMs / 1000).toFixed(1)}s</span>
        </div>
      </div>

      <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap mb-3" style={{ minHeight: '300px' }}>
        {story || <span className="text-gray-400 italic">(empty response)</span>}
      </div>

      <button
        onClick={() => setShowPrompt(v => !v)}
        className="text-[11px] text-gray-500 hover:text-[#1A1F36] underline"
      >
        {showPrompt ? 'Hide prompt' : 'Show prompt used'}
      </button>
      {showPrompt && (
        <pre className="mt-2 text-[10px] text-gray-600 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap font-mono leading-snug">
          {prompt}
        </pre>
      )}
    </div>
  )
}
