'use client'

import { useState, useEffect, useRef } from 'react'

// ── Module 2 progress screens ────────────────────────────────────────────────
// Added 2026-10-05 when the ebook writer moved to gpt-5.6-sol: the outline went
// from ~3s to ~20s and a chapter from ~45s to ~90s, behind a greyed-out button
// and a spinner that still said "20-30 seconds". Students read it as frozen.
//
// Chapters report real progress (the server streams an event as each section
// starts). The outline and the intro/conclusion are single requests with
// nothing to report midway, so they get one step paced to their typical time.

export interface ProgressStep {
  label: string
  weight: number      // share of the bar, all steps sum to 100
  expectedSecs: number
}

// Standard chapters: the order generateStandardChapterMultiPass runs in.
// Durations from gpt-5.6-sol test chapters. Practical steps were dropped on
// 2026-10-06 (Option A: one Quick Win per chapter).
export const STANDARD_CHAPTER_STEPS: ProgressStep[] = [
  { label: 'Chapter preview and opening quote', weight: 12, expectedSecs: 8 },
  { label: 'Opening story', weight: 24, expectedSecs: 19 },
  { label: 'Lessons', weight: 42, expectedSecs: 25 },
  { label: 'Your quick win', weight: 15, expectedSecs: 12 },
  { label: 'Final quality check', weight: 7, expectedSecs: 6 },
]

// Myth vs truth, case study, worksheet and template chapters: one pass.
export const SINGLE_PASS_CHAPTER_STEPS: ProgressStep[] = [
  { label: 'Writing the full chapter', weight: 100, expectedSecs: 45 },
]

export const OUTLINE_STEPS: ProgressStep[] = [
  { label: 'Choosing 3 title options and planning your chapters', weight: 100, expectedSecs: 22 },
]

export const FRONTMATTER_STEPS: ProgressStep[] = [
  { label: 'Writing your introduction and conclusion', weight: 100, expectedSecs: 25 },
]

function percentFor(steps: ProgressStep[], current: number, stepStartedAt: number, now: number): number {
  const done = steps.slice(0, current).reduce((a, s) => a + s.weight, 0)
  const step = steps[Math.min(current, steps.length - 1)]
  // Ease toward 95% of the current step's share so a slow step never looks
  // finished; the next real event (or the result) moves it on.
  const within = 1 - Math.exp(-((now - stepStartedAt) / 1000) / step.expectedSecs)
  return Math.min(99, done + step.weight * 0.95 * within)
}

export function GenerationProgress({
  eyebrow, title, subtitle, steps, current, stepStartedAt, note,
}: {
  eyebrow: string
  title: string
  subtitle?: string
  steps: ProgressStep[]
  current: number
  stepStartedAt: number
  note: string
}) {
  // Same pattern as Module 1: a 500ms tick reads the latest props through a
  // ref (never during render), and the bar never moves backwards.
  const latest = useRef({ steps, current, stepStartedAt })
  useEffect(() => { latest.current = { steps, current, stepStartedAt } }, [steps, current, stepStartedAt])
  const [pct, setPct] = useState(0)
  useEffect(() => {
    const t = setInterval(() => {
      const l = latest.current
      setPct(prev => Math.max(prev, percentFor(l.steps, l.current, l.stepStartedAt, Date.now())))
    }, 500)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="w-full max-w-sm mx-auto text-left">
      <p className="text-xs font-bold uppercase tracking-wide text-[#F4B942] mb-1">{eyebrow}</p>
      <h2 className="text-lg font-bold text-[#1A1F36] leading-snug">{title}</h2>
      {subtitle && <p className="text-sm text-gray-500 mt-1 leading-snug">{subtitle}</p>}

      <div className="mt-6 mb-2">
        <span className="text-3xl font-black text-[#1A1F36] tabular-nums">{Math.floor(pct)}%</span>
      </div>
      <div
        className="h-2.5 w-full rounded-full bg-gray-200 overflow-hidden"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.floor(pct)}
        aria-label={`${title} progress`}
      >
        <div className="h-full rounded-full bg-[#F4B942] transition-[width] duration-500 ease-out" style={{ width: `${pct}%` }} />
      </div>

      {steps.length > 1 && (
        <ol className="mt-6 flex flex-col gap-3">
          {steps.map((s, i) => {
            const state = i < current ? 'done' : i === current ? 'active' : 'pending'
            return (
              <li key={s.label} className="flex items-center gap-3">
                <span
                  className={`w-5 h-5 shrink-0 rounded-full flex items-center justify-center ${
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
                <span className={`text-sm ${state === 'pending' ? 'text-gray-400' : 'text-[#1A1F36] font-semibold'}`}>
                  {s.label}
                </span>
              </li>
            )
          })}
        </ol>
      )}
      {steps.length === 1 && (
        <p className="mt-5 text-sm font-semibold text-[#1A1F36]">{steps[0].label}…</p>
      )}

      <p className="mt-6 text-xs text-gray-400 leading-relaxed">{note}</p>
    </div>
  )
}

// Reads the NDJSON stream from stage 'chapter' with data.stream = true.
export async function readChapterStream<T>(
  body: ReadableStream<Uint8Array>,
  onStep: (index: number, kind: 'standard' | 'single') => void,
): Promise<T> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let result: T | null = null
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let nl: number
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl).trim()
      buffer = buffer.slice(nl + 1)
      if (!line) continue
      const ev = JSON.parse(line) as { type: string; index?: number; kind?: 'standard' | 'single'; data?: T; message?: string }
      if (ev.type === 'error') throw new Error(ev.message || 'Failed to write this chapter.')
      if (ev.type === 'step' && typeof ev.index === 'number') onStep(ev.index, ev.kind ?? 'standard')
      if (ev.type === 'done') result = ev.data ?? null
    }
  }
  if (!result) throw new Error('The chapter did not finish. Please try again.')
  return result
}
