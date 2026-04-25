'use client'

import { useState } from 'react'

interface PendingResult {
  id: string
  email: string
  full_name: string | null
  created_at: string
  status: string
  recommended_action: 'activate' | 'delete' | 'keep' | 'review'
  systeme_tags: string[]
  recommended_payload?: Record<string, unknown>
}

interface ScanResponse {
  mode: 'scan' | 'apply'
  total: number
  activate_count?: number
  delete_count?: number
  keep_count?: number
  review_count?: number
  activated?: number
  deleted?: number
  kept?: number
  skipped?: number
  errors?: { id: string; email: string; error: string }[]
  results: PendingResult[]
}

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  paid_topis:            { label: 'TOPIS (paid)',          color: '#10B981', bg: '#064e3b' },
  paid_topis_full:       { label: 'TOPIS (full pay)',      color: '#10B981', bg: '#064e3b' },
  paid_accelerator:      { label: 'AP (paid)',             color: '#3b82f6', bg: '#1e3a8a' },
  paid_accelerator_full: { label: 'AP (full pay)',         color: '#3b82f6', bg: '#1e3a8a' },
  paid_tier:             { label: 'Tier purchase',         color: '#a855f7', bg: '#581c87' },
  lead_only:             { label: 'Lead only — not paid',  color: '#ef4444', bg: '#7f1d1d' },
  not_in_systeme:        { label: 'Not in Systeme.io',     color: '#9ca3af', bg: '#374151' },
  is_test_account:       { label: 'Test account',          color: '#F4B942', bg: '#451a03' },
}

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  activate: { label: 'Activate',     color: '#10B981' },
  delete:   { label: 'Delete',       color: '#ef4444' },
  keep:     { label: 'Keep as-is',   color: '#9ca3af' },
  review:   { label: 'Review manually', color: '#F4B942' },
}

export default function PendingSweepPanel() {
  const [scanning, setScanning] = useState(false)
  const [applying, setApplying] = useState(false)
  const [scan, setScan] = useState<ScanResponse | null>(null)
  const [error, setError] = useState('')
  const [deleteLeads, setDeleteLeads] = useState(true)
  const [applyResult, setApplyResult] = useState<ScanResponse | null>(null)

  async function runScan() {
    setScanning(true)
    setError('')
    setApplyResult(null)
    try {
      const res = await fetch('/api/admin/sweep-pending', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'scan' }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Scan failed')
        return
      }
      setScan(data as ScanResponse)
    } finally {
      setScanning(false)
    }
  }

  async function applySweep() {
    if (!scan) return
    if (!confirm(`This will activate ${scan.activate_count} students and ${deleteLeads ? `delete ${scan.delete_count} lead accounts` : 'leave leads alone'}. Continue?`)) {
      return
    }
    setApplying(true)
    setError('')
    try {
      const res = await fetch('/api/admin/sweep-pending', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'apply', delete_leads: deleteLeads }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Apply failed')
        return
      }
      setApplyResult(data as ScanResponse)
      // Refresh scan after apply
      await runScan()
    } finally {
      setApplying(false)
    }
  }

  return (
    <div className="px-4 mb-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white text-sm font-bold">Pending Account Sweep</h3>
          <span className="text-[10px] text-gray-500">Cross-checks pending accounts against Systeme.io</span>
        </div>

        {!scan ? (
          <button
            onClick={runScan}
            disabled={scanning}
            className="w-full py-3 rounded-xl font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: '#F4B942', color: '#1A1F36' }}
          >
            {scanning ? (
              <>
                <div className="w-4 h-4 border-2 border-[#1A1F36] border-t-transparent rounded-full animate-spin" />
                Scanning Systeme.io…
              </>
            ) : (
              'Scan Pending Accounts'
            )}
          </button>
        ) : (
          <>
            {/* Summary chips */}
            <div className="flex flex-wrap gap-2 mb-4">
              <SummaryChip label="Total" value={scan.total} color="#9ca3af" />
              <SummaryChip label="Activate" value={scan.activate_count ?? 0} color="#10B981" />
              <SummaryChip label="Delete" value={scan.delete_count ?? 0} color="#ef4444" />
              <SummaryChip label="Keep" value={scan.keep_count ?? 0} color="#9ca3af" />
              <SummaryChip label="Review" value={scan.review_count ?? 0} color="#F4B942" />
            </div>

            {/* Apply controls */}
            {scan.total > 0 && (
              <div className="bg-gray-800/50 rounded-xl p-3 border border-gray-700 mb-3">
                <label className="flex items-center gap-2 mb-2 text-xs text-gray-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={deleteLeads}
                    onChange={e => setDeleteLeads(e.target.checked)}
                    className="rounded"
                  />
                  Also delete lead-only accounts ({scan.delete_count ?? 0})
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={runScan}
                    disabled={scanning || applying}
                    className="text-[11px] font-bold border border-gray-600 text-gray-300 px-3 py-2 rounded-lg hover:border-gray-500 disabled:opacity-50"
                  >
                    {scanning ? 'Re-scanning…' : 'Re-scan'}
                  </button>
                  <button
                    onClick={applySweep}
                    disabled={applying || (scan.activate_count === 0 && scan.delete_count === 0)}
                    className="flex-1 text-[11px] font-bold px-3 py-2 rounded-lg disabled:opacity-50"
                    style={{ background: '#F4B942', color: '#1A1F36' }}
                  >
                    {applying ? 'Applying…' : `Apply: Activate ${scan.activate_count ?? 0}${deleteLeads ? ` + Delete ${scan.delete_count ?? 0}` : ''}`}
                  </button>
                </div>
              </div>
            )}

            {/* Apply result feedback */}
            {applyResult && (
              <div className="mb-3 px-3 py-2 rounded-lg text-xs bg-green-900/30 border border-green-800 text-green-300">
                ✓ Activated {applyResult.activated} · Deleted {applyResult.deleted} · Errors: {applyResult.errors?.length ?? 0}
                {applyResult.errors && applyResult.errors.length > 0 && (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-red-400">Show errors</summary>
                    <ul className="mt-1">
                      {applyResult.errors.map((e, i) => (
                        <li key={i}>{e.email}: {e.error}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            )}

            {/* Results table */}
            <div className="space-y-1 max-h-96 overflow-y-auto">
              {scan.results.map(r => {
                const statusInfo = STATUS_LABELS[r.status] ?? { label: r.status, color: '#9ca3af', bg: '#374151' }
                const actionInfo = ACTION_LABELS[r.recommended_action] ?? { label: r.recommended_action, color: '#9ca3af' }
                return (
                  <div key={r.id} className="bg-gray-800/30 rounded-lg p-2.5 text-xs border border-gray-800">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium truncate">{r.full_name ?? 'No name'}</p>
                        <p className="text-gray-400 text-[10px] truncate">{r.email}</p>
                      </div>
                      <span
                        className="text-[9px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap"
                        style={{ background: statusInfo.bg, color: statusInfo.color }}
                      >
                        {statusInfo.label}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-gray-500">
                        {r.systeme_tags.length} tag{r.systeme_tags.length !== 1 ? 's' : ''}
                      </span>
                      <span style={{ color: actionInfo.color }} className="font-semibold">
                        → {actionInfo.label}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>

            {error && (
              <div className="mt-2 px-3 py-2 rounded-lg text-xs bg-red-900/30 border border-red-800 text-red-300">
                {error}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function SummaryChip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1.5">
      <p className="text-[9px] text-gray-500 uppercase tracking-wide leading-none">{label}</p>
      <p className="text-base font-bold leading-tight" style={{ color }}>{value}</p>
    </div>
  )
}
