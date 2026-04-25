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

interface LanguagePack {
  everyday_phrases: string[]
  emotional_words: string[]
  world_references: string[]
  jargon: string[]
}

interface Result {
  success: boolean
  foundation_label: string
  target_market: string
  ebook_title: string
  chapter: { number: number; title: string; goal: string }
  language_pack: LanguagePack
  language_elapsed_ms: number
  prompt_used: string
  market_hint_text: string
  with_language: { story: string; word_count: number; elapsed_ms: number }
  without_language: { story: string; word_count: number; elapsed_ms: number }
}

export default function TestMarketLanguagePage() {
  const [foundationId, setFoundationId] = useState<string>('softening_silence')
  const [chapterIndex, setChapterIndex] = useState<number>(0)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState('')
  const [winner, setWinner] = useState<'with' | 'without' | null>(null)

  const currentFoundation = FOUNDATIONS.find(f => f.id === foundationId) ?? FOUNDATIONS[0]
  const selectedChapter = currentFoundation.chapters[chapterIndex] ?? currentFoundation.chapters[0]

  async function runComparison() {
    setRunning(true)
    setError('')
    setResult(null)
    setWinner(null)
    try {
      const res = await fetch('/api/admin/test-market-language', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ foundation_id: foundationId, chapter_index: chapterIndex }),
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

  const totalPhrases = result
    ? result.language_pack.everyday_phrases.length
      + result.language_pack.emotional_words.length
      + result.language_pack.world_references.length
      + result.language_pack.jargon.length
    : 0

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
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Admin · Niche Language A/B Test</p>
          <h1 className="text-xl font-bold text-[#1A1F36]">Market Language — With vs Without</h1>
          <p className="text-sm text-gray-500 mt-1">
            Generates a niche language pack for the chosen foundation, then runs the SAME story-starter prompt twice in parallel — once with the pack injected, once without. Same model, same temperature, same prompt — only the language hint differs.
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
                  <option key={ch.chapter_number} value={i}>Ch {ch.chapter_number}: {ch.title}</option>
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
            {running ? 'Generating language pack and stories…' : 'Run Side-by-Side Comparison'}
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
            {/* Language pack */}
            <div className="bg-white rounded-2xl p-5 border border-gray-100 mb-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold uppercase tracking-wide text-[#1A1F36]">Language Pack Captured for this Niche</p>
                <span className="text-[10px] text-gray-500">{totalPhrases} phrases · {(result.language_elapsed_ms / 1000).toFixed(1)}s to generate</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <Bucket title="Everyday phrases" color="#3b82f6" items={result.language_pack.everyday_phrases} />
                <Bucket title="Emotional / feeling words" color="#ef4444" items={result.language_pack.emotional_words} />
                <Bucket title="World references" color="#10b981" items={result.language_pack.world_references} />
                <Bucket title="Insider jargon" color="#a855f7" items={result.language_pack.jargon} />
              </div>
            </div>

            {/* Verdict */}
            <div className="bg-white rounded-2xl p-4 border border-gray-100 mb-4 flex items-center justify-between">
              <p className="text-sm font-semibold text-[#1A1F36]">Which one feels more like the writer is in their world?</p>
              <div className="flex gap-2">
                <VerdictButton label="Without wins" active={winner === 'without'} onClick={() => setWinner('without')} />
                <VerdictButton label="With wins" active={winner === 'with'} onClick={() => setWinner('with')} />
                <VerdictButton label="Tie / unclear" active={winner === null} onClick={() => setWinner(null)} muted />
              </div>
            </div>

            {/* Stories side-by-side */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Panel
                title="WITHOUT language pack"
                color="#9ca3af"
                story={result.without_language.story}
                wordCount={result.without_language.word_count}
                elapsedMs={result.without_language.elapsed_ms}
                isWinner={winner === 'without'}
              />
              <Panel
                title="WITH language pack"
                color="#F4B942"
                story={result.with_language.story}
                wordCount={result.with_language.word_count}
                elapsedMs={result.with_language.elapsed_ms}
                isWinner={winner === 'with'}
              />
            </div>

            <div className="mt-4 text-center">
              <button
                onClick={runComparison}
                disabled={running}
                className="px-6 py-2 rounded-lg text-sm font-semibold border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Run again (regenerates language pack and stories)
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Bucket({ title, color, items }: { title: string; color: string; items: string[] }) {
  return (
    <div className="bg-gray-50 border border-gray-100 rounded-xl p-3">
      <p className="text-[10px] font-bold uppercase tracking-wide mb-1.5" style={{ color }}>{title} <span className="text-gray-400 font-normal">({items.length})</span></p>
      <p className="text-gray-700 leading-relaxed">{items.length ? items.join(', ') : <span className="italic text-gray-400">(empty)</span>}</p>
    </div>
  )
}

function VerdictButton({ label, active, onClick, muted = false }: { label: string; active: boolean; onClick: () => void; muted?: boolean }) {
  return (
    <button
      onClick={onClick}
      className="px-4 py-2 rounded-lg text-xs font-bold transition-all"
      style={{
        background: active ? '#1A1F36' : '#f3f4f6',
        color: active ? '#F4B942' : muted ? '#9ca3af' : '#6b7280',
        border: active ? '2px solid #F4B942' : '1px solid #e5e7eb',
      }}
    >
      {label}
    </button>
  )
}

function Panel({ title, color, story, wordCount, elapsedMs, isWinner }: {
  title: string
  color: string
  story: string
  wordCount: number
  elapsedMs: number
  isWinner: boolean
}) {
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

      <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap" style={{ minHeight: '300px' }}>
        {story || <span className="text-gray-400 italic">(empty response)</span>}
      </div>
    </div>
  )
}
