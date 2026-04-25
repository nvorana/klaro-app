'use client'

import { useEffect, useState } from 'react'

interface CohortSummary {
  program_type: 'topis' | 'accelerator'
  cohort_batch: number
  student_count: number
  current_unlocked: number[]  // most-common unlocked_modules for this cohort
}

const MODULE_NAMES = [
  'Clarity Builder',
  'Ebook Factory',
  'Offer Builder',
  'Sales Page',
  '7-Day Emails',
  'Lead Magnet',
  'FB Content',
]

export default function CohortUnlockPanel({ initialCohorts }: { initialCohorts: CohortSummary[] }) {
  const [cohorts, setCohorts] = useState(initialCohorts)
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  async function unlockUpTo(cohort: CohortSummary, upTo: number) {
    const key = `${cohort.program_type}:${cohort.cohort_batch}:${upTo}`
    setBusy(key)
    setMessage(null)
    try {
      const modules = Array.from({ length: upTo }, (_, i) => i + 1)
      const res = await fetch('/api/admin/cohort-unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          program_type: cohort.program_type,
          cohort_batch: cohort.cohort_batch,
          modules,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMessage({ kind: 'error', text: data.error ?? 'Failed to unlock' })
        return
      }
      setMessage({
        kind: 'ok',
        text: `Updated ${data.students_updated} student(s) in ${cohort.program_type.toUpperCase()} ${cohort.cohort_batch} → modules 1–${upTo} unlocked.`,
      })
      // Update local state
      setCohorts(prev => prev.map(c =>
        c.program_type === cohort.program_type && c.cohort_batch === cohort.cohort_batch
          ? { ...c, current_unlocked: modules }
          : c
      ))
    } finally {
      setBusy(null)
    }
  }

  if (!cohorts || cohorts.length === 0) {
    return null
  }

  return (
    <div className="px-4 mb-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white text-sm font-bold">Cohort Module Unlocks</h3>
          <span className="text-[10px] text-gray-500">Advances entire batch at once</span>
        </div>

        {message && (
          <div
            className={`mb-3 px-3 py-2 rounded-lg text-xs ${
              message.kind === 'ok'
                ? 'bg-green-900/30 border border-green-800 text-green-300'
                : 'bg-red-900/30 border border-red-800 text-red-300'
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="space-y-3">
          {cohorts.map(cohort => {
            const currentMax = cohort.current_unlocked.length > 0 ? Math.max(...cohort.current_unlocked) : 0
            return (
              <div key={`${cohort.program_type}-${cohort.cohort_batch}`} className="bg-gray-800/50 rounded-xl p-3 border border-gray-800">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-white text-sm font-bold">
                      {cohort.program_type.toUpperCase()} {cohort.cohort_batch}
                    </p>
                    <p className="text-gray-500 text-[10px]">
                      {cohort.student_count} student{cohort.student_count !== 1 ? 's' : ''}
                      {' · '}
                      Currently unlocked: {currentMax > 0 ? `1–${currentMax}` : 'none (drip only)'}
                    </p>
                  </div>
                </div>

                {/* Module dots */}
                <div className="flex items-center gap-1 mb-2.5">
                  {[1, 2, 3, 4, 5, 6, 7].map(n => {
                    const isUnlocked = cohort.current_unlocked.includes(n)
                    return (
                      <div
                        key={n}
                        title={`Module ${n}: ${MODULE_NAMES[n - 1]}`}
                        className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                        style={{
                          background: isUnlocked ? '#F4B942' : '#374151',
                          color: isUnlocked ? '#1A1F36' : '#6b7280',
                        }}
                      >
                        {n}
                      </div>
                    )
                  })}
                </div>

                {/* Buttons */}
                <div className="flex flex-wrap gap-1.5">
                  {[2, 3, 4, 5, 6, 7].map(n => {
                    const key = `${cohort.program_type}:${cohort.cohort_batch}:${n}`
                    const isCurrent = currentMax === n
                    const isPast = currentMax >= n
                    return (
                      <button
                        key={n}
                        onClick={() => unlockUpTo(cohort, n)}
                        disabled={busy !== null || isCurrent}
                        className="text-[11px] font-bold px-2.5 py-1 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{
                          background: isCurrent ? '#1A1F36' : isPast ? '#374151' : '#F4B942',
                          color: isCurrent ? '#F4B942' : isPast ? '#9ca3af' : '#1A1F36',
                          border: isCurrent ? '1px solid #F4B942' : 'none',
                        }}
                      >
                        {busy === key ? '…' : isCurrent ? `Now: 1-${n}` : `Unlock 1-${n}`}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        <p className="text-[10px] text-gray-500 mt-3 leading-relaxed">
          Setting modules 1–N unlocks them immediately for all enrolled students in the cohort.
          Modules beyond N continue to unlock on the weekly drip schedule.
        </p>
      </div>
    </div>
  )
}
