'use client'

import { useState, useEffect, useRef } from 'react'

// Shape returned by lib/clarity/mechanisms.ts (streamMechanisms).
export interface Mechanism {
  rank?: number
  name: string
  shape?: string
  core_idea?: string
  parts?: Array<{ label: string; description: string }>
  big_idea?: string
  why_it_stands_out?: string
  aha_moment?: string
  ebook_title?: string
  ebook_subtitle?: string
  tools?: string[]
  safety_note?: string
  strength?: string
  strength_reason?: string
}

export interface MechanismsResult {
  items: Mechanism[]
  recommended: { rank: number; reason: string } | null
}

export const TOTAL_MECHANISMS = 5
const CHARS_PER_MECHANISM = 2400 // Sol wrote ~12k chars of JSON for 5

export interface MechanismsProgressState {
  index: number // 0 until Sol names the first mechanism
  name: string
  chars: number
  charsAtStart: number
  startedAt: number
}

export type MechanismsStreamEvent =
  | { type: 'mechanism'; index: number; name: string }
  | { type: 'progress'; chars: number }
  | { type: 'done'; cards: MechanismsResult }
  | { type: 'error'; message: string }

export function newMechanismsProgress(): MechanismsProgressState {
  return { index: 0, name: '', chars: 0, charsAtStart: 0, startedAt: Date.now() }
}

export function applyMechanismsEvent(p: MechanismsProgressState, ev: MechanismsStreamEvent): MechanismsProgressState {
  if (ev.type === 'progress') return { ...p, chars: ev.chars }
  if (ev.type === 'mechanism') return { ...p, index: ev.index, name: ev.name, charsAtStart: p.chars }
  return p
}

// Reads the NDJSON stream from step 'mechanisms_stream'. Returns the cards.
export async function readMechanismsStream(
  body: ReadableStream<Uint8Array>,
  onEvent: (ev: MechanismsStreamEvent) => void,
): Promise<MechanismsResult> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let result: MechanismsResult | null = null
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let nl: number
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl).trim()
      buffer = buffer.slice(nl + 1)
      if (!line) continue
      const ev = JSON.parse(line) as MechanismsStreamEvent
      if (ev.type === 'error') throw new Error(ev.message)
      if (ev.type === 'done') result = ev.cards
      else onEvent(ev)
    }
  }
  if (!result) throw new Error('The mechanisms did not finish. Please try again.')
  return result
}

function mechanismsPercent(p: MechanismsProgressState, now: number): number {
  // Before the first name: Sol is thinking through why the usual fix fails.
  if (p.index === 0) return Math.min(18, 3 + ((now - p.startedAt) / 1000) * 1.2)
  const done = Math.min(p.index, TOTAL_MECHANISMS) - 1
  const within = Math.min(0.95, Math.max(0, p.chars - p.charsAtStart) / CHARS_PER_MECHANISM)
  return Math.min(98, 20 + 78 * ((done + within) / TOTAL_MECHANISMS))
}

export function MechanismsProgress({ progress, problem }: { progress: MechanismsProgressState; problem: string }) {
  // Same pattern as ProblemsProgress: a 500ms tick reads the latest progress
  // through a ref (never during render); the bar never moves backwards.
  const latest = useRef(progress)
  useEffect(() => { latest.current = progress }, [progress])
  const [pct, setPct] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setPct(prev => Math.max(prev, mechanismsPercent(latest.current, Date.now()))), 500)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm">
        <p className="text-xs font-bold uppercase tracking-wide text-[#F4B942] mb-1">Unique mechanisms</p>
        <h2 className="text-lg font-bold text-[#1A1F36] leading-snug mb-6">
          Building new ways to solve: <span className="text-[#1A1F36]">{problem}</span>
        </h2>

        <div className="mb-2">
          <span className="text-3xl font-black text-[#1A1F36] tabular-nums">{Math.floor(pct)}%</span>
        </div>
        <div
          className="h-2.5 w-full rounded-full bg-gray-200 overflow-hidden"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.floor(pct)}
          aria-label="Mechanism progress"
        >
          <div className="h-full rounded-full bg-[#F4B942] transition-[width] duration-500 ease-out" style={{ width: `${pct}%` }} />
        </div>

        <p className="mt-6 text-sm font-semibold text-[#1A1F36]">
          {progress.index === 0
            ? 'Figuring out why the usual fixes keep failing…'
            : `Building mechanism ${Math.min(progress.index, TOTAL_MECHANISMS)} of ${TOTAL_MECHANISMS}`}
        </p>
        {progress.index > 0 && progress.name && (
          <p className="text-xs text-gray-500 mt-1 leading-relaxed">{progress.name}</p>
        )}

        <p className="mt-8 text-xs text-gray-400 leading-relaxed">
          This usually takes under a minute. Keep this tab open.
        </p>
      </div>
    </div>
  )
}

// ── Mechanism card ───────────────────────────────────────────────────────────
// div[role=radio], like ProblemCard: it holds its own expand toggle.
export function MechanismCard({
  m, isSelected, isRecommended, isOpen, onSelect, onToggle,
}: {
  m: Mechanism
  isSelected: boolean
  isRecommended: boolean
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
        isSelected ? 'border-[#F4B942] bg-[#FFF8E8]' : 'border-gray-100 bg-white hover:border-gray-200'
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-start gap-2 flex-1">
          {m.rank && (
            <span className="text-[10px] font-black text-white bg-[#1A1F36] rounded-md px-1.5 py-0.5 shrink-0 mt-1">#{m.rank}</span>
          )}
          <div>
            <p className="text-base font-bold text-[#1A1F36] leading-snug">{m.name}</p>
            <div className="flex gap-1.5 mt-1 flex-wrap">
              {isRecommended && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#F4B942] text-[#1A1F36]">Top pick</span>
              )}
              {m.strength && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{m.strength}</span>
              )}
            </div>
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

      {m.big_idea && (
        <p className="text-sm text-[#1A1F36] font-semibold leading-snug mb-2">&ldquo;{m.big_idea}&rdquo;</p>
      )}

      {m.parts && m.parts.length > 0 && (
        <div className="flex flex-col gap-1.5 mb-1">
          {m.parts.map((p, k) => (
            <div key={k} className="flex items-start gap-2">
              <span className="w-4 h-4 rounded-full bg-[#F4B942] text-[#1A1F36] text-[9px] font-black flex items-center justify-center shrink-0 mt-0.5">{k + 1}</span>
              <p className="text-xs text-gray-600 leading-relaxed">
                <span className="font-semibold text-[#1A1F36]">{p.label}</span>
                {isOpen && p.description ? `: ${p.description}` : ''}
              </p>
            </div>
          ))}
        </div>
      )}

      {isOpen && (
        <div className="mt-3 pt-3 border-t border-gray-100 flex flex-col gap-3">
          {m.core_idea && (
            <div>
              <p className="text-[11px] font-bold text-[#1A1F36] uppercase tracking-wide mb-1">The core idea</p>
              <p className="text-xs text-gray-600 leading-relaxed">{m.core_idea}</p>
            </div>
          )}
          {m.why_it_stands_out && (
            <div>
              <p className="text-[11px] font-bold text-[#1A1F36] uppercase tracking-wide mb-1">Why it stands out</p>
              <p className="text-xs text-gray-600 leading-relaxed">{m.why_it_stands_out}</p>
            </div>
          )}
          {m.aha_moment && (
            <div className="bg-amber-50 rounded-lg px-3 py-2.5">
              <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wide mb-1">The aha moment</p>
              <p className="text-xs text-amber-800 italic leading-relaxed">&ldquo;{m.aha_moment}&rdquo;</p>
            </div>
          )}
          {(m.ebook_title || m.ebook_subtitle) && (
            <div className="rounded-lg bg-[#F8F9FA] p-3">
              <p className="text-[11px] font-bold text-[#1A1F36] uppercase tracking-wide mb-1">E-book title</p>
              {m.ebook_title && <p className="text-xs font-semibold text-[#1A1F36] leading-snug">{m.ebook_title}</p>}
              {m.ebook_subtitle && <p className="text-xs text-gray-500 leading-relaxed mt-1">{m.ebook_subtitle}</p>}
            </div>
          )}
          {m.tools && m.tools.length > 0 && (
            <div>
              <p className="text-[11px] font-bold text-[#1A1F36] uppercase tracking-wide mb-1">Tools to include</p>
              <ul className="list-disc pl-4 text-xs text-gray-600 leading-relaxed">
                {m.tools.map((t, k) => <li key={k}>{t}</li>)}
              </ul>
            </div>
          )}
          {m.safety_note && (
            <p className="text-[11px] text-gray-500 leading-relaxed">
              <span className="font-semibold text-[#1A1F36]">Keep it safe: </span>{m.safety_note}
            </p>
          )}
          {m.strength_reason && (
            <p className="text-[11px] text-gray-400 leading-relaxed">{m.strength_reason}</p>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={e => { e.stopPropagation(); onToggle() }}
        aria-expanded={isOpen}
        className="mt-2.5 flex items-center gap-1 text-xs font-semibold text-[#1A1F36] hover:text-[#F4B942]"
      >
        {isOpen ? 'Hide details' : 'See full mechanism'}
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
