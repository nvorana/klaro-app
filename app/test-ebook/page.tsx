'use client'

import { useState } from 'react'

// ─── Pre-filled sample data ───────────────────────────────────────────────────
const SAMPLE_PROJECT = {
  target_market: 'Filipino employees and BPO workers who want to earn extra income online',
  problem: 'They have skills and knowledge but don\'t know how to package it into a digital product they can sell',
  unique_mechanism: 'The OPIS Method — a step-by-step system for creating and selling a knowledge-based digital product in 30 days',
}

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

interface TokenUsage {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
}

interface SectionResult {
  label: string
  key: string
  status: 'waiting' | 'running' | 'done' | 'error'
  data: unknown
  usage: TokenUsage | null
  errorMsg?: string
}

const SECTION_DEFS = [
  { key: 'preview', label: 'Pass 0 — Chapter Preview', maxTokens: 300,  color: 'text-gray-300'   },
  { key: 'quote',   label: 'Pass 1 — Opening Quote',   maxTokens: 400,  color: 'text-yellow-400' },
  { key: 'story',   label: 'Pass 2 — Story Starter',   maxTokens: 1500, color: 'text-orange-400' },
  { key: 'lessons', label: 'Pass 3 — Core Lessons',    maxTokens: 3000, color: 'text-blue-400'   },
  { key: 'steps',   label: 'Pass 4 — Practical Steps', maxTokens: 2000, color: 'text-green-400'  },
  { key: 'quickwin',label: 'Pass 5 — Quick Win',       maxTokens: 1500, color: 'text-amber-400'  },
]

type OutlineStage = 'idle' | 'loading' | 'done' | 'error'

function fmt(n: number) { return n.toLocaleString() }

// ─── Token Bar ────────────────────────────────────────────────────────────────

function TokenBar({ usage, maxTokens }: { usage: TokenUsage; maxTokens: number }) {
  const pct = Math.min(100, Math.round((usage.completion_tokens / maxTokens) * 100))
  return (
    <div className="mt-2">
      <div className="flex justify-between text-[10px] text-gray-500 mb-1">
        <span>prompt: {fmt(usage.prompt_tokens)} · completion: <span className="text-white font-bold">{fmt(usage.completion_tokens)}</span> · total: {fmt(usage.total_tokens)}</span>
        <span>{pct}% of {fmt(maxTokens)} limit used</span>
      </div>
      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-amber-400' : 'bg-green-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

// ─── Section Card ─────────────────────────────────────────────────────────────

function SectionCard({ sec, maxTokens }: { sec: SectionResult; maxTokens: number }) {
  const [expanded, setExpanded] = useState(false)
  const def = SECTION_DEFS.find(d => d.key === sec.key)

  const statusIcon =
    sec.status === 'waiting' ? <span className="text-gray-600">○</span> :
    sec.status === 'running' ? <span className="text-yellow-400 animate-pulse">◉</span> :
    sec.status === 'done'    ? <span className="text-green-400">✓</span> :
                               <span className="text-red-400">✗</span>

  return (
    <div className={`border rounded-xl overflow-hidden transition-colors ${
      sec.status === 'done'    ? 'border-gray-700' :
      sec.status === 'running' ? 'border-yellow-800' :
      sec.status === 'error'   ? 'border-red-800' :
                                 'border-gray-800'
    }`}>
      {/* Header row */}
      <div
        className={`flex items-center justify-between px-4 py-3 ${sec.status === 'done' ? 'cursor-pointer hover:bg-gray-800/40' : ''}`}
        onClick={() => sec.status === 'done' && setExpanded(e => !e)}
      >
        <div className="flex items-center gap-3">
          {statusIcon}
          <span className={`text-sm font-bold ${def?.color ?? 'text-gray-300'}`}>{sec.label}</span>
          {sec.status === 'running' && <span className="text-[11px] text-yellow-400 animate-pulse">Generating…</span>}
          {sec.status === 'error' && <span className="text-[11px] text-red-400">{sec.errorMsg}</span>}
        </div>
        <div className="flex items-center gap-3">
          {sec.usage && (
            <span className="text-[11px] text-gray-400 font-mono">
              {fmt(sec.usage.completion_tokens)} / {fmt(maxTokens)} tokens
            </span>
          )}
          {sec.status === 'done' && (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`text-gray-500 transition-transform ${expanded ? 'rotate-180' : ''}`}>
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          )}
        </div>
      </div>

      {/* Token bar */}
      {sec.usage && (
        <div className="px-4 pb-2">
          <TokenBar usage={sec.usage} maxTokens={maxTokens} />
        </div>
      )}

      {/* Content preview */}
      {expanded && sec.data && (
        <div className="px-4 pb-4 border-t border-gray-800 pt-3 space-y-3">
          {sec.key === 'preview' && (() => {
            const d = sec.data as { chapter_preview: string }
            return (
              <div className="border-l-2 border-gray-600 pl-3">
                <p className="text-gray-300 text-sm italic">{d.chapter_preview}</p>
              </div>
            )
          })()}

          {sec.key === 'quote' && (() => {
            const d = sec.data as { quote: { text: string; author: string } }
            return (
              <div className="border-l-2 border-yellow-600 pl-3">
                <p className="text-gray-300 text-sm italic">"{d.quote?.text}"</p>
                <p className="text-gray-500 text-xs mt-1">— {d.quote?.author}</p>
              </div>
            )
          })()}

          {sec.key === 'story' && (() => {
            const d = sec.data as { story_starter: string }
            return <p className="text-gray-300 text-xs leading-relaxed whitespace-pre-wrap">{d.story_starter}</p>
          })()}

          {sec.key === 'lessons' && (() => {
            const d = sec.data as { core_lessons: string }
            return (
              <div className="text-xs leading-relaxed text-gray-300 whitespace-pre-wrap">
                {d.core_lessons?.split('\n').map((line, i) =>
                  line.startsWith('## ')
                    ? <p key={i} className="font-bold text-white text-sm mt-3 mb-1">{line.replace('## ', '')}</p>
                    : <p key={i} className="mb-1">{line}</p>
                )}
              </div>
            )
          })()}

          {sec.key === 'steps' && (() => {
            const d = sec.data as { practical_steps: Array<{ step_number: number; title: string; what_to_do: string; why_it_matters: string; common_mistake: string }> }
            return (
              <div className="space-y-3">
                {d.practical_steps?.map((s, i) => (
                  <div key={i} className="pl-3 border-l border-gray-700">
                    <p className="text-white text-xs font-bold">Step {s.step_number}: {s.title}</p>
                    <p className="text-gray-400 text-xs mt-0.5">{s.what_to_do}</p>
                    <p className="text-green-400 text-[11px] mt-0.5">→ {s.why_it_matters}</p>
                    <p className="text-red-400 text-[11px] mt-0.5">⚠ {s.common_mistake}</p>
                  </div>
                ))}
              </div>
            )
          })()}

          {sec.key === 'quickwin' && (() => {
            const d = sec.data as { quick_win: { name: string; goal: string; instructions: string[]; immediate_result: string } }
            return (
              <div>
                {d.quick_win?.name && <p className="text-amber-400 font-bold text-sm mb-1">{d.quick_win.name}</p>}
                <p className="text-gray-300 text-xs mb-2">{d.quick_win?.goal}</p>
                <div className="space-y-1">
                  {d.quick_win?.instructions?.map((inst, i) => (
                    <p key={i} className="text-gray-400 text-xs"><span className="text-amber-400 font-bold mr-1">{i+1}.</span>{inst}</p>
                  ))}
                </div>
                {d.quick_win?.immediate_result && (
                  <p className="text-green-400 text-xs mt-2">✓ {d.quick_win.immediate_result}</p>
                )}
              </div>
            )
          })()}

        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TestEbookPage() {
  const [targetMarket, setTargetMarket] = useState(SAMPLE_PROJECT.target_market)
  const [problem, setProblem] = useState(SAMPLE_PROJECT.problem)
  const [mechanism, setMechanism] = useState(SAMPLE_PROJECT.unique_mechanism)

  // Outline state
  const [outlineStage, setOutlineStage] = useState<OutlineStage>('idle')
  const [titleOptions, setTitleOptions] = useState<TitleOption[]>([])
  const [chapters, setChapters] = useState<ChapterOutline[]>([])
  const [selectedTitle, setSelectedTitle] = useState<TitleOption | null>(null)
  const [selectedChapterIdx, setSelectedChapterIdx] = useState(0)

  // Section-by-section state
  const [sections, setSections] = useState<SectionResult[]>(
    SECTION_DEFS.map(d => ({ label: d.label, key: d.key, status: 'waiting', data: null, usage: null }))
  )
  const [running, setRunning] = useState(false)
  const [totalTokens, setTotalTokens] = useState(0)

  const project = { target_market: targetMarket, problem, unique_mechanism: mechanism }

  // ── Outline ──────────────────────────────────────────────────────────────────

  async function generateOutline() {
    setOutlineStage('loading')
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
      resetSections()
    } catch {
      setOutlineStage('error')
    }
  }

  function resetSections() {
    setSections(SECTION_DEFS.map(d => ({ label: d.label, key: d.key, status: 'waiting', data: null, usage: null })))
    setTotalTokens(0)
  }

  // ── Section-by-section chapter generation ────────────────────────────────────

  async function generateAllSections() {
    if (!selectedTitle || chapters.length === 0 || running) return
    const chapter = chapters[selectedChapterIdx]

    resetSections()
    setRunning(true)
    let storyText = ''
    let lessonsText = ''
    let runningTotal = 0

    for (const def of SECTION_DEFS) {
      // Mark this section as running
      setSections(prev => prev.map(s => s.key === def.key ? { ...s, status: 'running' } : s))

      try {
        const body: Record<string, unknown> = {
          stage: 'chapter_section',
          project,
          data: {
            section:      def.key,
            book_title:   selectedTitle.title,
            chapter,
            all_chapters: chapters,
            ctx_story:    storyText || undefined,
            ctx_lessons:  lessonsText || undefined,
          },
        }

        const res = await fetch('/api/generate/ebook-agent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Failed')

        const usage: TokenUsage = json.usage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
        runningTotal += usage.total_tokens
        setTotalTokens(runningTotal)

        // Store context for dependent sections
        if (def.key === 'story')   storyText   = (json.data as { story_starter: string }).story_starter ?? ''
        if (def.key === 'lessons') lessonsText = (json.data as { core_lessons: string }).core_lessons ?? ''

        setSections(prev => prev.map(s =>
          s.key === def.key ? { ...s, status: 'done', data: json.data, usage } : s
        ))
      } catch (e: unknown) {
        setSections(prev => prev.map(s =>
          s.key === def.key ? { ...s, status: 'error', errorMsg: e instanceof Error ? e.message : 'Error' } : s
        ))
        break
      }
    }

    setRunning(false)
  }

  const TYPE_COLORS: Record<string, string> = {
    standard:   'bg-blue-900/30 text-blue-400 border-blue-800',
    myth_truth: 'bg-purple-900/30 text-purple-400 border-purple-800',
    case_study: 'bg-amber-900/30 text-amber-400 border-amber-800',
    worksheet:  'bg-teal-900/30 text-teal-400 border-teal-800',
    template:   'bg-pink-900/30 text-pink-400 border-pink-800',
  }

  const doneSections = sections.filter(s => s.status === 'done').length
  const totalSections = SECTION_DEFS.length

  return (
    <div className="min-h-screen bg-gray-950 px-4 py-8 max-w-3xl mx-auto">

      {/* Header */}
      <div className="mb-8">
        <p className="text-[#F4B942] text-xs font-bold uppercase tracking-widest mb-1">Dev Tool</p>
        <h1 className="text-white text-xl font-bold">Ebook Agent — Multi-Pass Test</h1>
        <p className="text-gray-500 text-sm mt-1">Test chapter generation section by section with live token counts. Not linked in any nav.</p>
      </div>

      {/* ── Project Input ─────────────────────────────────────────────────────── */}
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-5 mb-5">
        <p className="text-white font-bold text-sm mb-4">Clarity Sentence Data</p>
        <div className="space-y-3">
          {[
            { label: 'Target Market', val: targetMarket, set: setTargetMarket },
            { label: 'Problem',       val: problem,      set: setProblem      },
            { label: 'Unique Mechanism', val: mechanism, set: setMechanism    },
          ].map(({ label, val, set }) => (
            <div key={label}>
              <label className="text-[11px] text-gray-500 uppercase tracking-wide font-bold block mb-1">{label}</label>
              <textarea
                value={val}
                onChange={e => set(e.target.value)}
                rows={2}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-gray-500 resize-none"
              />
            </div>
          ))}
        </div>
      </div>

      {/* ── Stage 1: Outline ──────────────────────────────────────────────────── */}
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-5 mb-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-white font-bold text-sm">Stage 1 — Outline</p>
            <p className="text-gray-500 text-xs">Generates title options + chapter list</p>
          </div>
          <button
            onClick={generateOutline}
            disabled={outlineStage === 'loading'}
            className="bg-[#F4B942] text-[#1A1F36] text-xs font-bold px-4 py-2 rounded-lg disabled:opacity-40"
          >
            {outlineStage === 'loading' ? 'Generating…' : outlineStage === 'done' ? 'Regenerate' : 'Generate Outline'}
          </button>
        </div>

        {titleOptions.length > 0 && (
          <div className="mb-4">
            <p className="text-[11px] text-gray-500 uppercase tracking-wide font-bold mb-2">Title Options — click to select</p>
            <div className="space-y-2">
              {titleOptions.map(t => (
                <button key={t.option} onClick={() => { setSelectedTitle(t); resetSections() }}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition-colors ${selectedTitle?.option === t.option ? 'border-[#F4B942] bg-[#1A1F36]' : 'border-gray-700 hover:border-gray-500'}`}>
                  <p className="text-white text-sm font-semibold">{t.title}</p>
                  <p className="text-gray-400 text-xs mt-0.5">{t.subtitle}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {chapters.length > 0 && (
          <div>
            <p className="text-[11px] text-gray-500 uppercase tracking-wide font-bold mb-2">Chapters ({chapters.length})</p>
            <div className="space-y-1.5">
              {chapters.map(c => (
                <div key={c.number} className="flex items-start gap-3 px-3 py-2 bg-gray-800/50 rounded-lg">
                  <span className="text-[#F4B942] text-xs font-bold w-5 shrink-0 mt-0.5">{c.number}</span>
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

      {/* ── Stage 2: Chapter — Multi-Pass ─────────────────────────────────────── */}
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-5 mb-5">

        {/* Header + controls */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-white font-bold text-sm">Stage 2 — Chapter (Multi-Pass)</p>
            <p className="text-gray-500 text-xs">6 focused API calls, one per section</p>
          </div>
          <button
            onClick={generateAllSections}
            disabled={running || chapters.length === 0 || !selectedTitle}
            className="bg-[#F4B942] text-[#1A1F36] text-xs font-bold px-4 py-2 rounded-lg disabled:opacity-40 shrink-0"
          >
            {running ? `Running… (${doneSections}/${totalSections})` : 'Generate Chapter'}
          </button>
        </div>

        {/* Chapter selector */}
        {chapters.length > 0 && (
          <div className="mb-4">
            <label className="text-[11px] text-gray-500 uppercase tracking-wide font-bold block mb-1">Select Chapter</label>
            <select
              value={selectedChapterIdx}
              onChange={e => { setSelectedChapterIdx(+e.target.value); resetSections() }}
              disabled={running}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none disabled:opacity-40"
            >
              {chapters.map((c, i) => (
                <option key={c.number} value={i}>
                  Ch {c.number}: {c.title} [{c.chapter_type ?? 'standard'}]
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Token summary bar */}
        {totalTokens > 0 && (
          <div className="flex items-center justify-between bg-gray-800/50 rounded-xl px-4 py-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-gray-500 uppercase font-bold tracking-wide">Total tokens used</span>
              <span className="text-white font-bold text-sm font-mono">{fmt(totalTokens)}</span>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-gray-500">
              <span>{doneSections}/{totalSections} sections</span>
              {!running && doneSections === totalSections && (
                <span className="text-green-400 font-bold">✓ Complete</span>
              )}
            </div>
          </div>
        )}

        {/* Section cards */}
        <div className="space-y-2">
          {sections.map((sec, i) => (
            <SectionCard
              key={sec.key}
              sec={sec}
              maxTokens={SECTION_DEFS[i].maxTokens}
            />
          ))}
        </div>

      </div>

    </div>
  )
}
