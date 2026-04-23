'use client'

import { useState } from 'react'
import Link from 'next/link'

// Admin Module 8 test runner. Runs each of the 8 creator screens sequentially
// against a preset test foundation. Shows output progressively.

interface Foundation {
  id: string
  label: string
  description: string
}

const FOUNDATIONS: Foundation[] = [
  { id: 'softening_silence', label: 'Healing / Grief — Softening the Silence', description: 'Emotional, low-bandwidth audience. From Appendix A.' },
  { id: 'pet_fleas',         label: 'Pet Care — Pawsitive Shield Flea Prevention', description: 'Practical, tactical Filipino dog owner niche.' },
  { id: 'ofw_savings',       label: 'Finance / OFW — First ₱100K Roadmap', description: 'Money/tactical niche for Filipino overseas workers.' },
]

interface ScreenResult {
  screen_id: number
  name: string
  status: 'pending' | 'running' | 'done' | 'error'
  draft?: Record<string, unknown>
  elapsed_ms?: number
  error?: string
}

const SCREEN_NAMES: Record<number, string> = {
  1: 'Readiness Check',
  2: 'Transformation',
  3: 'Course Type',
  4: 'Chapter Audit',
  5: 'Course Skeleton',
  6: 'Lesson Map',
  7: 'Implementation Assets',
  8: 'Student Experience',
}

export default function TestModule8Page() {
  const [foundationId, setFoundationId] = useState<string>('softening_silence')
  const [running, setRunning] = useState(false)
  const [results, setResults] = useState<ScreenResult[]>([])
  const [totalElapsed, setTotalElapsed] = useState(0)

  async function runAll() {
    setRunning(true)
    setResults([])
    setTotalElapsed(0)
    const start = Date.now()

    // Initialize all 8 screens as pending
    const initial: ScreenResult[] = Array.from({ length: 8 }, (_, i) => ({
      screen_id: i + 1,
      name: SCREEN_NAMES[i + 1],
      status: 'pending',
    }))
    setResults(initial)

    const accumulated: Record<string, unknown> = {}

    for (let screenId = 1; screenId <= 8; screenId++) {
      // Mark running
      setResults(prev => prev.map(r => r.screen_id === screenId ? { ...r, status: 'running' } : r))

      try {
        if (screenId === 6) {
          // Screen 6 is per-module — run for each module from the skeleton
          const moduleMap = (accumulated.module_map as Array<{ module_number: number }>) ?? []
          const lessonMap: unknown[] = []

          for (const mod of moduleMap) {
            const res = await fetch('/api/admin/test-module8/run-screen', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                foundation_id: foundationId,
                screen_id: 6,
                upstream: accumulated,
                module_number: mod.module_number,
              }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.detail ?? data.error ?? 'Module 6 gen failed')
            lessonMap.push(data.draft)
          }

          const combined = { lesson_map: lessonMap, complete: true }
          Object.assign(accumulated, combined)

          setResults(prev => prev.map(r =>
            r.screen_id === 6
              ? { ...r, status: 'done', draft: combined, elapsed_ms: Date.now() - start }
              : r
          ))
        } else {
          const res = await fetch('/api/admin/test-module8/run-screen', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              foundation_id: foundationId,
              screen_id: screenId,
              upstream: accumulated,
            }),
          })
          const data = await res.json()
          if (!res.ok) throw new Error(data.detail ?? data.error ?? 'Screen gen failed')

          // Accumulate the draft's fields into upstream context for next screens
          Object.assign(accumulated, data.draft)

          setResults(prev => prev.map(r =>
            r.screen_id === screenId
              ? { ...r, status: 'done', draft: data.draft, elapsed_ms: data.elapsed_ms }
              : r
          ))
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        setResults(prev => prev.map(r =>
          r.screen_id === screenId
            ? { ...r, status: 'error', error: message }
            : r
        ))
        break  // stop on first error
      }
    }

    setTotalElapsed(Date.now() - start)
    setRunning(false)
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      <div className="max-w-5xl mx-auto px-4 pt-6 pb-12">
        <Link href="/admin" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-[#1A1F36] mb-4">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back to Admin
        </Link>

        <div className="mb-6">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Admin · Test Runner</p>
          <h1 className="text-xl font-bold text-[#1A1F36]">Module 8 — End-to-End Test</h1>
          <p className="text-sm text-gray-500 mt-1">
            Runs all 8 creator screens sequentially against a preset foundation. Uses real GPT-4o calls.
          </p>
        </div>

        {/* Foundation picker */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100 mb-4">
          <p className="text-xs font-semibold text-[#1A1F36] uppercase tracking-wide mb-3">Test Foundation</p>
          <div className="space-y-2">
            {FOUNDATIONS.map(f => (
              <label
                key={f.id}
                className="flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-colors"
                style={{
                  background: foundationId === f.id ? '#FFFBEB' : '#F8F9FA',
                  border: foundationId === f.id ? '2px solid #F4B942' : '1px solid #e5e7eb',
                }}
              >
                <input
                  type="radio"
                  name="foundation"
                  value={f.id}
                  checked={foundationId === f.id}
                  onChange={e => setFoundationId(e.target.value)}
                  disabled={running}
                  className="mt-0.5"
                />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-[#1A1F36]">{f.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{f.description}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Run button */}
        <button
          onClick={runAll}
          disabled={running}
          className="w-full py-4 rounded-xl font-bold text-base disabled:opacity-50 mb-6"
          style={{ background: '#F4B942', color: '#1A1F36' }}
        >
          {running ? 'Running — do not navigate away…' : 'Run Full Module 8 Test'}
        </button>

        {/* Results checklist */}
        {results.length > 0 && (
          <div className="bg-white rounded-2xl p-5 border border-gray-100 mb-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-[#1A1F36] uppercase tracking-wide">Progress</p>
              {totalElapsed > 0 && (
                <p className="text-xs text-gray-500">Total: {(totalElapsed / 1000).toFixed(1)}s</p>
              )}
            </div>
            <div className="space-y-2">
              {results.map(r => (
                <ScreenRow key={r.screen_id} result={r} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function ScreenRow({ result }: { result: ScreenResult }) {
  const [expanded, setExpanded] = useState(false)

  const iconColor = {
    pending: '#e5e7eb',
    running: '#F4B942',
    done:    '#10B981',
    error:   '#ef4444',
  }[result.status]

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(v => !v)}
        disabled={result.status === 'pending' || !result.draft}
        className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors disabled:cursor-default"
      >
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: iconColor }}
        >
          {result.status === 'running' ? (
            <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : result.status === 'done' ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : result.status === 'error' ? (
            <span className="text-white font-bold text-xs">!</span>
          ) : (
            <span className="text-xs text-gray-500">{result.screen_id}</span>
          )}
        </div>
        <div className="flex-1 text-left">
          <p className="text-sm font-semibold text-[#1A1F36]">
            Screen {result.screen_id} — {result.name}
          </p>
          {result.status === 'done' && result.elapsed_ms && (
            <p className="text-[10px] text-gray-500">{(result.elapsed_ms / 1000).toFixed(1)}s</p>
          )}
          {result.status === 'error' && result.error && (
            <p className="text-[10px] text-red-600 mt-0.5">{result.error}</p>
          )}
        </div>
        {result.draft && (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#9ca3af"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`transition-transform ${expanded ? 'rotate-180' : ''}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        )}
      </button>
      {expanded && result.draft && (
        <div className="p-3 bg-gray-50 border-t border-gray-100">
          <pre className="text-[11px] text-gray-700 whitespace-pre-wrap break-words font-mono leading-relaxed">
            {JSON.stringify(result.draft, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}
