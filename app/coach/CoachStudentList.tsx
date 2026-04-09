'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Star, CheckCircle2, Circle, Lock, Unlock } from 'lucide-react'

const MODULE_NAMES = ['Clarity', 'Ebook', 'Sales Page', 'Emails', 'Lead Magnet', 'FB Content']

const STATUS_CONFIG = {
  green:  { label: 'On Track',    badge: 'bg-green-900/40 text-green-400' },
  yellow: { label: 'At Risk',     badge: 'bg-yellow-900/40 text-yellow-400' },
  red:    { label: 'Disengaged',  badge: 'bg-red-900/40 text-red-400' },
  ghost:  { label: 'Ghost',       badge: 'bg-gray-800 text-gray-500' },
}

function daysSince(dateStr: string | null): number {
  if (!dateStr) return 999
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24))
}

function getStatus(days: number): keyof typeof STATUS_CONFIG {
  if (days <= 2) return 'green'
  if (days <= 5) return 'yellow'
  if (days <= 9) return 'red'
  return 'ghost'
}

interface Student {
  id: string
  full_name: string
  first_name: string
  email?: string
  access_level: string
  dfy_flagged: boolean
  last_active_at: string | null
  enrolled_at: string | null
  unlocked_modules: number[] | null
  completions: boolean[]
  ebookTitle?: string
}

interface Props {
  students: Student[]
}

export default function CoachStudentList({ students }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [moduleTarget, setModuleTarget] = useState<number>(3)
  const [action, setAction] = useState<'unlock' | 'lock'>('unlock')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const selectAll = () => setSelected(new Set(students.map(s => s.id)))
  const clearAll = () => setSelected(new Set())

  const handleAction = async () => {
    if (!selected.size) return
    setLoading(true)
    const endpoint = action === 'unlock' ? '/api/coach/unlock-modules' : '/api/coach/lock-modules'
    await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentIds: Array.from(selected), moduleNumber: moduleTarget }),
    })
    setLoading(false)
    setDone(true)
    clearAll()
    setTimeout(() => { setDone(false); window.location.reload() }, 1500)
  }

  return (
    <div className="relative">

      {/* ── Select All / Clear toolbar ─────────────────────── */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-3">
          <button
            onClick={selected.size === students.length ? clearAll : selectAll}
            className="text-xs text-[#F4B942] font-semibold hover:underline"
          >
            {selected.size === students.length ? 'Deselect All' : 'Select All'}
          </button>
          {selected.size > 0 && (
            <span className="text-xs text-gray-400">{selected.size} selected</span>
          )}
        </div>
      </div>

      {/* ── Student Cards ──────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        {students.map(student => {
          const name = student.first_name || student.full_name || 'Student'
          const days = daysSince(student.last_active_at ?? student.enrolled_at)
          const status = getStatus(days)
          const config = STATUS_CONFIG[status]
          const doneCount = student.completions.filter(Boolean).length
          const isChecked = selected.has(student.id)

          return (
            <div
              key={student.id}
              className={`bg-gray-900 rounded-2xl p-4 transition-all ${
                isChecked ? 'border-2 border-[#F4B942]' : 'border border-[#374151]'
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Checkbox */}
                <button
                  onClick={() => toggleSelect(student.id)}
                  className="mt-0.5 flex-shrink-0"
                >
                  {isChecked
                    ? <CheckCircle2 size={20} className="text-[#F4B942]" />
                    : <Circle size={20} className="text-gray-600" />
                  }
                </button>

                {/* Card content — links to detail */}
                <Link href={`/coach/${student.id}`} className="flex-1 min-w-0">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-full bg-[#F4B942] flex items-center justify-center text-[#1A1F36] font-black text-sm flex-shrink-0">
                        {name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-white font-semibold text-sm">{student.full_name || name}</p>
                        {student.email && (
                          <p className="text-gray-500 text-xs">{student.email}</p>
                        )}
                        <p className="text-gray-600 text-xs">
                          {days === 999 ? 'No activity yet' : days === 0 ? 'Active today' : `${days}d ago`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap justify-end">
                      {student.access_level && !['pending'].includes(student.access_level) && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-gray-800 text-gray-400 border border-gray-700">
                          {student.access_level === 'enrolled' ? 'Enrolled' : student.access_level.toUpperCase()}
                        </span>
                      )}
                      {student.dfy_flagged && (
                        <span className="inline-flex items-center gap-1 text-xs bg-[#1c1500] text-[#F4B942] border border-[#F4B942]/40 px-2 py-0.5 rounded-full font-bold">
                          <Star size={10} />DFY
                        </span>
                      )}
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${config.badge}`}>
                        {config.label}
                      </span>
                    </div>
                  </div>

                  {/* Module dots */}
                  <div className="flex gap-1 mt-2">
                    {[1,2,3,4,5,6].map(num => {
                      const isCompleted = student.completions[num - 1]
                      const isUnlocked = student.unlocked_modules?.includes(num)
                      return (
                        <div
                          key={num}
                          title={`Module ${num}: ${MODULE_NAMES[num-1]}`}
                          className={`flex-1 h-1.5 rounded-full ${
                            isCompleted ? 'bg-emerald-500' :
                            isUnlocked ? 'bg-[#F4B942]' :
                            'bg-gray-700'
                          }`}
                        />
                      )
                    })}
                  </div>
                  <div className="flex justify-between mt-1">
                    <p className="text-gray-500 text-xs">{doneCount}/6 modules done</p>
                    <p className="text-gray-600 text-xs">
                      {student.unlocked_modules?.length ?? 0} unlocked
                    </p>
                  </div>
                </Link>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Sticky Bulk Action Bar ─────────────────────────── */}
      {selected.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-[#1A1F36] border-t border-[#F4B942]/30 px-4 py-4 z-50">
          <div className="max-w-3xl mx-auto flex items-center gap-3 flex-wrap">

            {/* Lock / Unlock toggle */}
            <div className="flex rounded-lg overflow-hidden border border-gray-700 flex-shrink-0">
              <button
                onClick={() => setAction('unlock')}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold transition-all ${
                  action === 'unlock'
                    ? 'bg-[#F4B942] text-[#1A1F36]'
                    : 'bg-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                <Unlock size={13} /> Unlock
              </button>
              <button
                onClick={() => setAction('lock')}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold transition-all ${
                  action === 'lock'
                    ? 'bg-red-500 text-white'
                    : 'bg-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                <Lock size={13} /> Lock
              </button>
            </div>

            {/* Module picker */}
            <select
              value={moduleTarget}
              onChange={e => setModuleTarget(Number(e.target.value))}
              className="bg-gray-800 text-white text-sm rounded-lg px-2 py-1.5 border border-gray-600 focus:outline-none focus:border-[#F4B942] flex-shrink-0"
            >
              {[1,2,3,4,5,6,7].map(n => (
                <option key={n} value={n}>Module {n} — {MODULE_NAMES[n-1] ?? 'Module 7'}</option>
              ))}
            </select>

            <span className="text-gray-400 text-xs flex-1">
              {selected.size} student{selected.size > 1 ? 's' : ''}
            </span>

            {/* Action button */}
            <button
              onClick={handleAction}
              disabled={loading || done}
              className="px-5 py-2.5 rounded-xl font-bold text-sm transition-all disabled:opacity-60 flex-shrink-0"
              style={{
                background: done ? '#064e3b' : action === 'lock' ? '#ef4444' : '#F4B942',
                color: done ? '#34d399' : action === 'lock' ? '#fff' : '#1A1F36',
              }}
            >
              {loading
                ? (action === 'lock' ? 'Locking…' : 'Unlocking…')
                : done ? '✓ Done'
                : (action === 'lock' ? 'Lock' : 'Unlock')}
            </button>

            <button onClick={clearAll} className="text-gray-500 text-xs hover:text-gray-300 flex-shrink-0">Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}
