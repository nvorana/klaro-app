'use client'

import { useState, useEffect, useRef } from 'react'

// Shape returned by lib/clarity/problemsReport.ts (extractProblemCards).
export interface Problem {
  rank: number
  problem: string
  real_question?: string
  signs?: string[]
  urgency?: string
  proof_of_demand?: string
  current_attempts?: string
  sources?: Array<{ title: string; url: string }>
  desired_outcome?: string
  ebook_title?: string
  ebook_positioning?: string
  demand_score?: number
  urgency_score?: number
  ebook_potential?: number
  score_reason?: string
  willingness_to_pay?: 'Low' | 'Medium' | 'High'
  ease_of_selling?: 'Easy' | 'Moderate' | 'Hard'
  common_phrases?: string
}

// ── Problems analysis progress ───────────────────────────────────────────────
// The problems step takes ~1.5 minutes (gpt-5.6-sol searching and writing the
// cards in one pass), so it gets a real progress screen instead of the
// rotating-message loader. Progress comes from what the server is actually
// doing: each web search, then each card as Sol writes it, then a short
// finishing step (source checks). Only that last stretch is time-based.

export const TOTAL_PROBLEMS = 10
const CHARS_PER_PROBLEM = 1500 // one-pass card JSON ran ~15-16k chars for 10 problems

export interface AnalysisProgress {
  phase: 'research' | 'writing' | 'organizing'
  searches: number
  lastQuery: string
  problemIndex: number // 0 until Sol starts Problem 1
  problemTitle: string
  chars: number
  charsAtProblemStart: number
  startedAt: number
  phaseStartedAt: number
}

export type ReportStreamEvent =
  | { type: 'search'; count: number; query?: string }
  | { type: 'problem'; index: number; title: string }
  | { type: 'progress'; chars: number }
  | { type: 'finalizing' }
  | { type: 'done'; cards: ProblemCardsResult; report: string }
  | { type: 'error'; message: string }

export interface ProblemCardsResult {
  items: Problem[]
  top_pick: { rank: number; reason: string } | null
}

export function newAnalysisProgress(): AnalysisProgress {
  const now = Date.now()
  return {
    phase: 'research', searches: 0, lastQuery: '', problemIndex: 0, problemTitle: '',
    chars: 0, charsAtProblemStart: 0, startedAt: now, phaseStartedAt: now,
  }
}

export function applyReportEvent(p: AnalysisProgress, ev: ReportStreamEvent): AnalysisProgress {
  if (ev.type === 'search') return { ...p, searches: ev.count, lastQuery: ev.query ?? p.lastQuery }
  if (ev.type === 'progress') return { ...p, chars: ev.chars }
  if (ev.type === 'finalizing') return { ...p, phase: 'organizing', phaseStartedAt: Date.now() }
  if (ev.type === 'problem') {
    return {
      ...p,
      phase: 'writing',
      problemIndex: ev.index,
      problemTitle: ev.title.replace(/[*_`#]/g, '').trim(),
      charsAtProblemStart: p.chars,
      phaseStartedAt: p.phase === 'writing' ? p.phaseStartedAt : Date.now(),
    }
  }
  return p
}

function analysisPercent(p: AnalysisProgress, now: number): number {
  if (p.phase === 'research') {
    // Searches arrive in bursts; creep a little with time so it never stalls.
    return Math.min(28, 3 + p.searches * 3 + ((now - p.startedAt) / 1000) * 0.35)
  }
  if (p.phase === 'writing') {
    const done = Math.min(p.problemIndex, TOTAL_PROBLEMS) - 1
    const within = Math.min(0.95, Math.max(0, p.chars - p.charsAtProblemStart) / CHARS_PER_PROBLEM)
    return Math.min(95, 30 + 65 * ((done + within) / TOTAL_PROBLEMS))
  }
  // Finishing: source checks are instant; a banned-word rewrite (rare) can
  // take ~30s. Ease toward 99% and let 'done' finish it.
  return 95 + 4 * (1 - Math.exp(-((now - p.phaseStartedAt) / 1000) / 10))
}

// Reads the NDJSON stream from step 'problems_report'. Returns the cards.
export async function readProblemsStream(
  body: ReadableStream<Uint8Array>,
  onEvent: (ev: ReportStreamEvent) => void,
): Promise<ProblemCardsResult> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let cards: ProblemCardsResult | null = null
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let nl: number
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl).trim()
      buffer = buffer.slice(nl + 1)
      if (!line) continue
      const ev = JSON.parse(line) as ReportStreamEvent
      if (ev.type === 'error') throw new Error(ev.message)
      if (ev.type === 'done') cards = ev.cards
      else onEvent(ev)
    }
  }
  if (!cards) throw new Error('The market analysis did not finish. Please try again.')
  return cards
}

export function ProblemsProgress({ progress, market }: { progress: AnalysisProgress; market: string }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(t)
  }, [])

  // Never let the bar move backwards (e.g. a search event after writing began).
  const highest = useRef(0)
  const pct = Math.max(highest.current, analysisPercent(progress, now))
  useEffect(() => { highest.current = pct })

  const order = ['research', 'writing', 'organizing'] as const
  const current = order.indexOf(progress.phase)

  const steps = [
    {
      label: 'Researching your market',
      detail: progress.searches > 0
        ? `${progress.searches} web search${progress.searches === 1 ? '' : 'es'} done`
        : 'Starting the search…',
    },
    {
      label: `Analyzing the top ${TOTAL_PROBLEMS} problems`,
      detail: progress.problemIndex > 0
        ? `Problem ${Math.min(progress.problemIndex, TOTAL_PROBLEMS)} of ${TOTAL_PROBLEMS}: ${progress.problemTitle}`
        : 'Checking signs, costs, and what people already spend',
    },
    {
      label: 'Finishing your cards',
      detail: 'Checking every source link against what the search found',
    },
  ]

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm">
        <p className="text-xs font-bold uppercase tracking-wide text-[#F4B942] mb-1">Market analysis</p>
        <h2 className="text-lg font-bold text-[#1A1F36] leading-snug mb-6">
          Finding the biggest problems for <span className="text-[#1A1F36]">{market}</span>
        </h2>

        {/* Progress bar */}
        <div className="mb-2">
          <span className="text-3xl font-black text-[#1A1F36] tabular-nums">{Math.floor(pct)}%</span>
        </div>
        <div
          className="h-2.5 w-full rounded-full bg-gray-200 overflow-hidden"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.floor(pct)}
          aria-label="Market analysis progress"
        >
          <div
            className="h-full rounded-full bg-[#F4B942] transition-[width] duration-500 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* Steps */}
        <ol className="mt-7 flex flex-col gap-4">
          {steps.map((s, i) => {
            const state = i < current ? 'done' : i === current ? 'active' : 'pending'
            return (
              <li key={s.label} className="flex gap-3">
                <span
                  className={`mt-0.5 w-5 h-5 shrink-0 rounded-full flex items-center justify-center ${
                    state === 'done' ? 'bg-[#1A1F36]' : state === 'active' ? 'border-2 border-[#F4B942]' : 'border-2 border-gray-200'
                  }`}
                >
                  {state === 'done' && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                  {state === 'active' && <span className="w-2 h-2 rounded-full bg-[#F4B942] animate-pulse" />}
                </span>
                <div className="min-w-0">
                  <p className={`text-sm font-semibold ${state === 'pending' ? 'text-gray-400' : 'text-[#1A1F36]'}`}>{s.label}</p>
                  {state !== 'pending' && (
                    <p className="text-xs text-gray-500 leading-relaxed mt-0.5">{state === 'done' && i === 1 ? `All ${TOTAL_PROBLEMS} problems analyzed` : s.detail}</p>
                  )}
                  {state === 'active' && i < 2 && progress.lastQuery && (
                    <p className="text-[11px] text-gray-400 italic mt-1 truncate">Searching: &ldquo;{progress.lastQuery}&rdquo;</p>
                  )}
                </div>
              </li>
            )
          })}
        </ol>

        <p className="mt-8 text-xs text-gray-400 leading-relaxed">
          This deep analysis usually takes 1 to 2 minutes. Keep this tab open, sulit ang hintay.
        </p>
      </div>
    </div>
  )
}

export function ScoreDots({ label, value }: { label: string; value?: number }) {
  if (!value) return null
  return (
    <span className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-500" aria-label={`${label}: ${value} out of 5`}>
      {label}
      <span className="flex gap-0.5" aria-hidden="true">
        {[1, 2, 3, 4, 5].map(n => (
          <span key={n} className={`w-1.5 h-1.5 rounded-full ${n <= value ? 'bg-[#F4B942]' : 'bg-gray-200'}`} />
        ))}
      </span>
    </span>
  )
}


// ── Problem card ─────────────────────────────────────────────────────────────
// A div with role="radio" rather than a <button>: the card holds its own
// "See full analysis" toggle and source links, and interactive elements cannot
// be nested inside a button.
export function ProblemCard({
  p, isSelected, isTopPick, isOpen, onSelect, onToggle,
}: {
  p: Problem
  isSelected: boolean
  isTopPick: boolean
  isOpen: boolean
  onSelect: () => void
  onToggle: () => void
}) {
  return (
    <div
      role="radio"
      aria-checked={isSelected}
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={e => {
        if (e.target !== e.currentTarget) return
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect() }
      }}
      className={`w-full text-left p-4 rounded-xl border-2 transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1A1F36] ${
        isSelected
          ? 'border-[#F4B942] bg-[#FFF8E8]'
          : 'border-gray-100 bg-white hover:border-gray-200'
      }`}
    >
      {/* Rank + title row */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-start gap-2 flex-1">
          <span className="text-[10px] font-black text-white bg-[#1A1F36] rounded-md px-1.5 py-0.5 shrink-0 mt-0.5">#{p.rank}</span>
          <div>
            <p className="text-sm font-bold text-[#1A1F36] leading-snug">{p.problem}</p>
            {isTopPick && (
              <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#F4B942] text-[#1A1F36]">Top pick</span>
            )}
          </div>
        </div>
        {isSelected && (
          <div className="w-5 h-5 rounded-full bg-[#F4B942] flex items-center justify-center shrink-0 mt-0.5">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        )}
      </div>
  
      {/* Scores */}
      <div className="flex gap-x-4 gap-y-1 mb-2.5 flex-wrap">
        <ScoreDots label="Demand" value={p.demand_score} />
        <ScoreDots label="Urgency" value={p.urgency_score} />
        <ScoreDots label="E-book potential" value={p.ebook_potential} />
      </div>
  
      {/* Their real question */}
      {p.real_question && (
        <p className="text-[12px] text-[#B8860B] italic leading-relaxed mb-2">
          &ldquo;{p.real_question}&rdquo;
        </p>
      )}
  
      {p.urgency && (
        <p className="text-xs text-gray-600 leading-relaxed">
          <span className="font-semibold text-[#1A1F36]">Why now: </span>{p.urgency}
        </p>
      )}
  
      {/* Full analysis */}
      {isOpen && (
        <div className="mt-3 pt-3 border-t border-gray-100 flex flex-col gap-3">
          {p.signs && p.signs.length > 0 && (
            <div>
              <p className="text-[11px] font-bold text-[#1A1F36] uppercase tracking-wide mb-1">What it looks like</p>
              <ul className="list-disc pl-4 text-xs text-gray-600 leading-relaxed">
                {p.signs.map((s, k) => <li key={k}>{s}</li>)}
              </ul>
            </div>
          )}
          {p.proof_of_demand && (
            <div>
              <p className="text-[11px] font-bold text-[#1A1F36] uppercase tracking-wide mb-1">Evidence of demand</p>
              <p className="text-xs text-gray-600 leading-relaxed">{p.proof_of_demand}</p>
              {p.sources && p.sources.length > 0 && (
                <p className="text-[11px] text-gray-400 mt-1">
                  Sources:{' '}
                  {p.sources.map((s, k) => (
                    <span key={k}>
                      {k > 0 && ', '}
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="underline hover:text-[#1A1F36]"
                      >
                        {s.title}
                      </a>
                    </span>
                  ))}
                </p>
              )}
            </div>
          )}
          {p.desired_outcome && (
            <div>
              <p className="text-[11px] font-bold text-[#1A1F36] uppercase tracking-wide mb-1">What they want</p>
              <p className="text-xs text-gray-600 leading-relaxed">{p.desired_outcome}</p>
            </div>
          )}
          {(p.ebook_title || p.ebook_positioning) && (
            <div className="rounded-lg bg-[#F8F9FA] p-3">
              <p className="text-[11px] font-bold text-[#1A1F36] uppercase tracking-wide mb-1">E-book angle</p>
              {p.ebook_title && <p className="text-xs font-semibold text-[#1A1F36] leading-snug">{p.ebook_title}</p>}
              {p.ebook_positioning && <p className="text-xs text-gray-500 leading-relaxed mt-1">{p.ebook_positioning}</p>}
            </div>
          )}
          {p.score_reason && (
            <p className="text-[11px] text-gray-400 leading-relaxed">{p.score_reason}</p>
          )}
        </div>
      )}
  
      <button
        type="button"
        onClick={e => { e.stopPropagation(); onToggle() }}
        aria-expanded={isOpen}
        className="mt-2.5 flex items-center gap-1 text-xs font-semibold text-[#1A1F36] hover:text-[#F4B942]"
      >
        {isOpen ? 'Hide full analysis' : 'See full analysis'}
        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
    </div>
  )
}
