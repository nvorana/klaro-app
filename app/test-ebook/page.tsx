'use client'

import { useState } from 'react'

// ─── Pre-filled sample data ───────────────────────────────────────────────────
const SAMPLE_PROJECT = {
  target_market: 'Filipino employees and BPO workers who want to earn extra income online',
  problem: 'They have skills and knowledge but don\'t know how to package it into a digital product they can sell',
  unique_mechanism: 'The OPIS Method — a step-by-step system for creating and selling a knowledge-based digital product in 30 days',
}

const SAMPLE_TITLE = 'Your First Digital Product'
const SAMPLE_SUBTITLE = 'How Filipino Employees Are Earning Extra Income Without Quitting Their Jobs'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChapterOutline {
  number: number
  title: string
  goal: string
  quick_win_outcome: string
  chapter_type?: string
}

interface TitleOption {
  option: number
  title: string
  subtitle: string
}

type Stage = 'idle' | 'loading' | 'done' | 'error'

export default function TestEbookPage() {
  // Project fields
  const [targetMarket, setTargetMarket] = useState(SAMPLE_PROJECT.target_market)
  const [problem, setProblem] = useState(SAMPLE_PROJECT.problem)
  const [mechanism, setMechanism] = useState(SAMPLE_PROJECT.unique_mechanism)

  // Outline state
  const [outlineStage, setOutlineStage] = useState<Stage>('idle')
  const [titleOptions, setTitleOptions] = useState<TitleOption[]>([])
  const [chapters, setChapters] = useState<ChapterOutline[]>([])
  const [selectedTitle, setSelectedTitle] = useState<TitleOption | null>(null)

  // Chapter state
  const [selectedChapterIdx, setSelectedChapterIdx] = useState<number>(0)
  const [chapterStage, setChapterStage] = useState<Stage>('idle')
  const [chapterResult, setChapterResult] = useState<unknown>(null)

  // Introduction state
  const [introStage, setIntroStage] = useState<Stage>('idle')
  const [introResult, setIntroResult] = useState<string | null>(null)

  // Conclusion state
  const [conclusionStage, setConclusionStage] = useState<Stage>('idle')
  const [conclusionResult, setConclusionResult] = useState<string | null>(null)

  // Log
  const [log, setLog] = useState<{ time: string; msg: string; type: 'info' | 'ok' | 'err' }[]>([])

  function addLog(msg: string, type: 'info' | 'ok' | 'err' = 'info') {
    setLog(l => [{ time: new Date().toLocaleTimeString(), msg, type }, ...l])
  }

  const project = { target_market: targetMarket, problem, unique_mechanism: mechanism }

  // ── Stage 1: Generate Outline ─────────────────────────────────────────────

  async function generateOutline() {
    setOutlineStage('loading')
    addLog('Generating outline…', 'info')
    try {
      const res = await fetch('/api/generate/ebook-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: 'outline', project, data: {} }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed')
      setTitleOptions(json.data.title_options)
      setChapters(json.data.chapters)
      const rec = json.data.title_options.find((t: TitleOption) => t.option === json.data.recommended)
      setSelectedTitle(rec || json.data.title_options[0])
      setOutlineStage('done')
      addLog(`Outline done — ${json.data.chapters.length} chapters generated.`, 'ok')
    } catch (e: unknown) {
      setOutlineStage('error')
      addLog(`Outline error: ${e instanceof Error ? e.message : 'Unknown'}`, 'err')
    }
  }

  // ── Stage 2: Generate a Single Chapter ───────────────────────────────────

  async function generateChapter() {
    if (!selectedTitle || chapters.length === 0) return
    const chapter = chapters[selectedChapterIdx]
    setChapterStage('loading')
    setChapterResult(null)
    addLog(`Generating Chapter ${chapter.number}: "${chapter.title}"…`, 'info')
    try {
      const res = await fetch('/api/generate/ebook-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stage: 'chapter',
          project,
          data: {
            book_title: selectedTitle.title,
            chapter,
            all_chapters: chapters,
          },
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed')
      setChapterResult(json.data)
      setChapterStage('done')
      addLog(`Chapter ${chapter.number} done.`, 'ok')
    } catch (e: unknown) {
      setChapterStage('error')
      addLog(`Chapter error: ${e instanceof Error ? e.message : 'Unknown'}`, 'err')
    }
  }

  // ── Stage 3: Generate Introduction ───────────────────────────────────────

  async function generateIntro() {
    if (!selectedTitle || chapters.length === 0) return
    setIntroStage('loading')
    setIntroResult(null)
    addLog('Generating introduction…', 'info')
    try {
      const res = await fetch('/api/generate/ebook-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stage: 'introduction',
          project,
          data: {
            book_title: selectedTitle.title,
            book_subtitle: selectedTitle.subtitle,
            chapters,
          },
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed')
      setIntroResult(json.data.introduction)
      setIntroStage('done')
      addLog('Introduction done.', 'ok')
    } catch (e: unknown) {
      setIntroStage('error')
      addLog(`Intro error: ${e instanceof Error ? e.message : 'Unknown'}`, 'err')
    }
  }

  // ── Stage 4: Generate Conclusion ─────────────────────────────────────────

  async function generateConclusion() {
    if (!selectedTitle || chapters.length === 0) return
    setConclusionStage('loading')
    setConclusionResult(null)
    addLog('Generating conclusion…', 'info')
    try {
      const res = await fetch('/api/generate/ebook-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stage: 'conclusion',
          project,
          data: { book_title: selectedTitle.title, chapters },
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed')
      setConclusionResult(json.data.conclusion)
      setConclusionStage('done')
      addLog('Conclusion done.', 'ok')
    } catch (e: unknown) {
      setConclusionStage('error')
      addLog(`Conclusion error: ${e instanceof Error ? e.message : 'Unknown'}`, 'err')
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  function stageColor(s: Stage) {
    if (s === 'loading') return 'text-yellow-400'
    if (s === 'done') return 'text-green-400'
    if (s === 'error') return 'text-red-400'
    return 'text-gray-500'
  }

  function stageLabel(s: Stage) {
    if (s === 'loading') return '⏳ Generating…'
    if (s === 'done') return '✓ Done'
    if (s === 'error') return '✗ Error'
    return '—'
  }

  const TYPE_COLORS: Record<string, string> = {
    standard:   'bg-blue-900/30 text-blue-400 border-blue-800',
    myth_truth: 'bg-purple-900/30 text-purple-400 border-purple-800',
    case_study: 'bg-amber-900/30 text-amber-400 border-amber-800',
    worksheet:  'bg-teal-900/30 text-teal-400 border-teal-800',
    template:   'bg-pink-900/30 text-pink-400 border-pink-800',
  }

  return (
    <div className="min-h-screen bg-gray-950 px-4 py-8 max-w-3xl mx-auto">

      {/* Header */}
      <div className="mb-8">
        <p className="text-[#F4B942] text-xs font-bold uppercase tracking-widest mb-1">Dev Tool</p>
        <h1 className="text-white text-xl font-bold">Ebook Agent Test Page</h1>
        <p className="text-gray-500 text-sm mt-1">Test ebook generation without going through the full app flow. Not linked in any nav.</p>
      </div>

      {/* ── Project Input ───────────────────────────────────────────────────── */}
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-5 mb-6">
        <p className="text-white font-bold text-sm mb-4">Clarity Sentence Data</p>
        <div className="space-y-3">
          <div>
            <label className="text-[11px] text-gray-500 uppercase tracking-wide font-bold block mb-1">Target Market</label>
            <textarea
              value={targetMarket}
              onChange={e => setTargetMarket(e.target.value)}
              rows={2}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-gray-500 resize-none"
            />
          </div>
          <div>
            <label className="text-[11px] text-gray-500 uppercase tracking-wide font-bold block mb-1">Problem</label>
            <textarea
              value={problem}
              onChange={e => setProblem(e.target.value)}
              rows={2}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-gray-500 resize-none"
            />
          </div>
          <div>
            <label className="text-[11px] text-gray-500 uppercase tracking-wide font-bold block mb-1">Unique Mechanism</label>
            <textarea
              value={mechanism}
              onChange={e => setMechanism(e.target.value)}
              rows={2}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-gray-500 resize-none"
            />
          </div>
        </div>
      </div>

      {/* ── Stage 1: Outline ────────────────────────────────────────────────── */}
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-white font-bold text-sm">Stage 1 — Outline</p>
            <p className="text-gray-500 text-xs">Generates title options + chapter list</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-xs font-bold ${stageColor(outlineStage)}`}>{stageLabel(outlineStage)}</span>
            <button
              onClick={generateOutline}
              disabled={outlineStage === 'loading'}
              className="bg-[#F4B942] text-[#1A1F36] text-xs font-bold px-4 py-2 rounded-lg disabled:opacity-40"
            >
              {outlineStage === 'done' ? 'Regenerate' : 'Generate Outline'}
            </button>
          </div>
        </div>

        {/* Title options */}
        {titleOptions.length > 0 && (
          <div className="mb-4">
            <p className="text-[11px] text-gray-500 uppercase tracking-wide font-bold mb-2">Title Options — click to select</p>
            <div className="space-y-2">
              {titleOptions.map(t => (
                <button
                  key={t.option}
                  onClick={() => setSelectedTitle(t)}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition-colors ${
                    selectedTitle?.option === t.option
                      ? 'border-[#F4B942] bg-[#1A1F36]'
                      : 'border-gray-700 hover:border-gray-500'
                  }`}
                >
                  <p className="text-white text-sm font-semibold">{t.title}</p>
                  <p className="text-gray-400 text-xs mt-0.5">{t.subtitle}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Chapter list */}
        {chapters.length > 0 && (
          <div>
            <p className="text-[11px] text-gray-500 uppercase tracking-wide font-bold mb-2">Chapters ({chapters.length})</p>
            <div className="space-y-1.5">
              {chapters.map(c => (
                <div key={c.number} className="flex items-start gap-3 px-3 py-2 bg-gray-800/50 rounded-lg">
                  <span className="text-[#F4B942] text-xs font-bold w-5 shrink-0 mt-0.5">
                    {c.number}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-xs font-medium">{c.title}</p>
                    <p className="text-gray-500 text-[11px] mt-0.5">{c.goal}</p>
                  </div>
                  {c.chapter_type && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${TYPE_COLORS[c.chapter_type] ?? 'bg-gray-800 text-gray-500 border-gray-700'}`}>
                      {c.chapter_type.replace('_', ' ')}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Stage 2: Single Chapter ─────────────────────────────────────────── */}
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-white font-bold text-sm">Stage 2 — Chapter Draft</p>
            <p className="text-gray-500 text-xs">Write one chapter at a time to inspect quality</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-xs font-bold ${stageColor(chapterStage)}`}>{stageLabel(chapterStage)}</span>
            <button
              onClick={generateChapter}
              disabled={chapterStage === 'loading' || chapters.length === 0 || !selectedTitle}
              className="bg-[#F4B942] text-[#1A1F36] text-xs font-bold px-4 py-2 rounded-lg disabled:opacity-40"
            >
              Generate Chapter
            </button>
          </div>
        </div>

        {chapters.length > 0 && (
          <div className="mb-4">
            <p className="text-[11px] text-gray-500 uppercase tracking-wide font-bold mb-2">Select chapter to generate</p>
            <select
              value={selectedChapterIdx}
              onChange={e => { setSelectedChapterIdx(+e.target.value); setChapterResult(null); setChapterStage('idle') }}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none"
            >
              {chapters.map((c, i) => (
                <option key={c.number} value={i}>
                  Ch {c.number}: {c.title} [{c.chapter_type ?? 'standard'}]
                </option>
              ))}
            </select>
          </div>
        )}

        {chapterResult && (
          <div className="bg-gray-800/50 rounded-xl p-4 space-y-4 text-sm">
            {(() => {
              const ch = chapterResult as Record<string, unknown>
              return (
                <>
                  {ch.quote && (
                    <div className="border-l-2 border-[#F4B942] pl-3">
                      <p className="text-gray-300 italic">&ldquo;{(ch.quote as Record<string,string>).text}&rdquo;</p>
                      <p className="text-gray-500 text-xs mt-1">— {(ch.quote as Record<string,string>).author}</p>
                    </div>
                  )}
                  {ch.story_starter && (
                    <div>
                      <p className="text-[11px] text-gray-500 uppercase tracking-wide font-bold mb-1">Story Starter</p>
                      <p className="text-gray-300 whitespace-pre-wrap text-xs leading-relaxed">{ch.story_starter as string}</p>
                    </div>
                  )}
                  {ch.core_lessons && (
                    <div>
                      <p className="text-[11px] text-gray-500 uppercase tracking-wide font-bold mb-1">Core Lessons</p>
                      <p className="text-gray-300 whitespace-pre-wrap text-xs leading-relaxed">{ch.core_lessons as string}</p>
                    </div>
                  )}
                  {Array.isArray(ch.practical_steps) && ch.practical_steps.length > 0 && (
                    <div>
                      <p className="text-[11px] text-gray-500 uppercase tracking-wide font-bold mb-1">Practical Steps ({(ch.practical_steps as unknown[]).length})</p>
                      {(ch.practical_steps as Record<string,unknown>[]).map((s, i) => (
                        <div key={i} className="mb-2 pl-3 border-l border-gray-700">
                          <p className="text-white text-xs font-semibold">Step {s.step_number as number}: {s.title as string}</p>
                          <p className="text-gray-400 text-xs mt-0.5">{s.what_to_do as string}</p>
                          <p className="text-red-400 text-[11px] mt-0.5">⚠ {s.common_mistake as string}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {ch.quick_win && (
                    <div>
                      <p className="text-[11px] text-gray-500 uppercase tracking-wide font-bold mb-1">Quick Win</p>
                      <p className="text-gray-300 text-xs">{(ch.quick_win as Record<string,string>).goal}</p>
                    </div>
                  )}
                  {ch.confidence_close && (
                    <div>
                      <p className="text-[11px] text-gray-500 uppercase tracking-wide font-bold mb-1">Confidence Close</p>
                      <p className="text-gray-300 whitespace-pre-wrap text-xs leading-relaxed">{ch.confidence_close as string}</p>
                    </div>
                  )}
                  {Array.isArray(ch.references) && (ch.references as string[]).length > 0 && (
                    <div>
                      <p className="text-[11px] text-gray-500 uppercase tracking-wide font-bold mb-1">References</p>
                      {(ch.references as string[]).map((r, i) => (
                        <p key={i} className="text-gray-500 text-[11px] italic">{r}</p>
                      ))}
                    </div>
                  )}
                </>
              )
            })()}
          </div>
        )}
      </div>

      {/* ── Stage 3: Introduction ────────────────────────────────────────────── */}
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-white font-bold text-sm">Stage 3 — Introduction</p>
            <p className="text-gray-500 text-xs">Big idea hook + emotional opener</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-xs font-bold ${stageColor(introStage)}`}>{stageLabel(introStage)}</span>
            <button
              onClick={generateIntro}
              disabled={introStage === 'loading' || chapters.length === 0 || !selectedTitle}
              className="bg-[#F4B942] text-[#1A1F36] text-xs font-bold px-4 py-2 rounded-lg disabled:opacity-40"
            >
              Generate Intro
            </button>
          </div>
        </div>
        {introResult && (
          <div className="bg-gray-800/50 rounded-xl p-4">
            <p className="text-gray-300 whitespace-pre-wrap text-xs leading-relaxed">{introResult}</p>
          </div>
        )}
      </div>

      {/* ── Stage 4: Conclusion ──────────────────────────────────────────────── */}
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-white font-bold text-sm">Stage 4 — Conclusion</p>
            <p className="text-gray-500 text-xs">Final call to action + memorable close</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-xs font-bold ${stageColor(conclusionStage)}`}>{stageLabel(conclusionStage)}</span>
            <button
              onClick={generateConclusion}
              disabled={conclusionStage === 'loading' || chapters.length === 0 || !selectedTitle}
              className="bg-[#F4B942] text-[#1A1F36] text-xs font-bold px-4 py-2 rounded-lg disabled:opacity-40"
            >
              Generate Conclusion
            </button>
          </div>
        </div>
        {conclusionResult && (
          <div className="bg-gray-800/50 rounded-xl p-4">
            <p className="text-gray-300 whitespace-pre-wrap text-xs leading-relaxed">{conclusionResult}</p>
          </div>
        )}
      </div>

      {/* ── Log ─────────────────────────────────────────────────────────────── */}
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-5">
        <p className="text-white font-bold text-sm mb-3">Activity Log</p>
        {log.length === 0 ? (
          <p className="text-gray-600 text-xs">No activity yet.</p>
        ) : (
          <div className="space-y-1.5 font-mono">
            {log.map((entry, i) => (
              <div key={i} className="flex gap-3 text-[11px]">
                <span className="text-gray-600 shrink-0">{entry.time}</span>
                <span className={
                  entry.type === 'ok' ? 'text-green-400' :
                  entry.type === 'err' ? 'text-red-400' : 'text-gray-400'
                }>
                  {entry.msg}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}
