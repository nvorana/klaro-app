'use client'

import { useState } from 'react'
import Link from 'next/link'

interface WorkshopItem {
  rank: number
  problem: string
  insight: string
}

interface ProductionItem {
  rank: number
  problem: string
  urgency: string
  proof_of_demand: string
  willingness_to_pay: string
  ease_of_selling: string
  common_phrases: string
}

interface Result {
  success: boolean
  target_market: string
  production: { items: ProductionItem[]; elapsed_ms: number; prompt: string }
  workshop: { items: WorkshopItem[]; elapsed_ms: number; prompt: string }
}

const PRESETS = [
  'Single moms in the Philippines',
  'Filipino men in their 50s struggling to lose weight',
  'Filipino dog owners with persistent flea problems',
  'OFWs supporting family back home who have never saved before',
  'Working professionals in Metro Manila with chronic back pain',
]

export default function TestProblemsPage() {
  const [targetMarket, setTargetMarket] = useState(PRESETS[0])
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState('')
  const [winner, setWinner] = useState<'production' | 'workshop' | null>(null)

  async function runComparison() {
    setRunning(true)
    setError('')
    setResult(null)
    setWinner(null)
    try {
      const res = await fetch('/api/admin/test-problems', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_market: targetMarket }),
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
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Admin · Problems Prompt A/B Test</p>
          <h1 className="text-xl font-bold text-[#1A1F36]">Step 2 Problem-Finder — Production vs Workshop</h1>
          <p className="text-sm text-gray-500 mt-1">
            Same target market, two prompts in parallel. Production = current structured 6-field prompt used in Module 1. Workshop = jon&apos;s open-prose research-question style. Same model, same temperature.
          </p>
        </div>

        {/* Inputs */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100 mb-4">
          <p className="text-xs font-semibold text-[#1A1F36] uppercase tracking-wide mb-3">Test Input</p>

          <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Target market</label>
          <input
            type="text"
            value={targetMarket}
            onChange={e => setTargetMarket(e.target.value)}
            disabled={running}
            placeholder="e.g. Single moms in the Philippines"
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white text-[#1A1F36] placeholder:text-gray-400 mb-2"
          />

          <div className="flex flex-wrap gap-1.5 mb-3">
            {PRESETS.map(p => (
              <button
                key={p}
                onClick={() => setTargetMarket(p)}
                disabled={running}
                className="text-[10px] font-medium px-2 py-1 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                {p}
              </button>
            ))}
          </div>

          <button
            onClick={runComparison}
            disabled={running || !targetMarket.trim()}
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

        {result && (
          <>
            {/* Verdict */}
            <div className="bg-white rounded-2xl p-4 border border-gray-100 mb-4 flex items-center justify-between">
              <p className="text-sm font-semibold text-[#1A1F36]">Which prompt produced better problems?</p>
              <div className="flex gap-2">
                <VerdictButton label="Production wins" active={winner === 'production'} onClick={() => setWinner('production')} />
                <VerdictButton label="Workshop wins" active={winner === 'workshop'} onClick={() => setWinner('workshop')} />
                <VerdictButton label="Tie / unclear" active={winner === null} onClick={() => setWinner(null)} muted />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ColumnPanel
                title="PRODUCTION (current)"
                color="#9ca3af"
                count={result.production.items.length}
                elapsedMs={result.production.elapsed_ms}
                isWinner={winner === 'production'}
                prompt={result.production.prompt}
              >
                {result.production.items.map(item => (
                  <ProductionCard key={item.rank} item={item} />
                ))}
              </ColumnPanel>

              <ColumnPanel
                title="WORKSHOP (open prose)"
                color="#F4B942"
                count={result.workshop.items.length}
                elapsedMs={result.workshop.elapsed_ms}
                isWinner={winner === 'workshop'}
                prompt={result.workshop.prompt}
              >
                {result.workshop.items.map(item => (
                  <WorkshopCard key={item.rank} item={item} />
                ))}
              </ColumnPanel>
            </div>

            <div className="mt-4 text-center">
              <button
                onClick={runComparison}
                disabled={running}
                className="px-6 py-2 rounded-lg text-sm font-semibold border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Run again (different output for same market)
              </button>
            </div>
          </>
        )}
      </div>
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

function ColumnPanel({ title, color, count, elapsedMs, isWinner, prompt, children }: {
  title: string
  color: string
  count: number
  elapsedMs: number
  isWinner: boolean
  prompt: string
  children: React.ReactNode
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
          <span>{count} problems</span>
          <span>·</span>
          <span>{(elapsedMs / 1000).toFixed(1)}s</span>
        </div>
      </div>

      <div className="space-y-2.5 mb-3">
        {children}
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

function ProductionCard({ item }: { item: ProductionItem }) {
  const wtpColor = item.willingness_to_pay?.toLowerCase().startsWith('high') ? '#10b981'
    : item.willingness_to_pay?.toLowerCase().startsWith('low') ? '#ef4444' : '#f59e0b'
  const easeColor = item.ease_of_selling?.toLowerCase().startsWith('easy') ? '#10b981'
    : item.ease_of_selling?.toLowerCase().startsWith('hard') ? '#ef4444' : '#f59e0b'
  return (
    <div className="bg-gray-50 border border-gray-100 rounded-xl p-3">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-[10px] font-bold text-white bg-[#1A1F36] rounded px-1.5 py-0.5">#{item.rank}</span>
        <p className="text-sm font-semibold text-[#1A1F36] flex-1">{item.problem}</p>
      </div>
      <div className="flex flex-wrap gap-1 mb-2">
        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: `${wtpColor}22`, color: wtpColor }}>
          {item.willingness_to_pay}
        </span>
        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: `${easeColor}22`, color: easeColor }}>
          {item.ease_of_selling}
        </span>
      </div>
      <p className="text-[11px] text-gray-700 leading-relaxed mb-1"><span className="font-semibold">Why urgent:</span> {item.urgency}</p>
      <p className="text-[11px] text-gray-700 leading-relaxed mb-1"><span className="font-semibold">Demand:</span> {item.proof_of_demand}</p>
      <p className="text-[11px] text-orange-600 italic leading-relaxed">&ldquo;{item.common_phrases}&rdquo;</p>
    </div>
  )
}

function WorkshopCard({ item }: { item: WorkshopItem }) {
  return (
    <div className="bg-gray-50 border border-gray-100 rounded-xl p-3">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-[10px] font-bold text-white bg-[#1A1F36] rounded px-1.5 py-0.5">#{item.rank}</span>
        <p className="text-sm font-semibold text-[#1A1F36] flex-1">{item.problem}</p>
      </div>
      <p className="text-[11px] text-gray-700 leading-relaxed">{item.insight}</p>
    </div>
  )
}
