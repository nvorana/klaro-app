'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Student {
  id: string
  name: string
  email: string
  programType: string
  cohortBatch: number | null
  accessLevel: string
  suspended: boolean
  unlockedModules: number[]
  enrolledAt: string | null
  lastActiveAt: string | null
  createdAt: string | null
  completions: boolean[]
}

interface Coach {
  id: string
  name: string
  email: string
  programType: string
}

interface Props {
  students: Student[]
  coaches: Coach[]
  adminName: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MODULE_LABELS = ['Clarity', 'Ebook', 'Offer', 'Sales Page', 'Email Seq.', 'Lead Magnet', 'FB Content']

function paymentBadge(s: Student) {
  if (s.suspended) return { label: 'Unsettled', cls: 'bg-red-900/40 text-red-400 border border-red-800' }
  if (s.accessLevel === 'full_access') return { label: 'Fully Paid', cls: 'bg-green-900/40 text-green-400 border border-green-800' }
  return { label: '2nd Pay Settled', cls: 'bg-amber-900/40 text-amber-400 border border-amber-800' }
}

function daysSince(dateStr: string | null): number {
  if (!dateStr) return 999
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
}

function accessExpiry(s: Student): { daysLeft: number; expiresOn: string; expired: boolean } {
  const startDate = s.createdAt ?? s.enrolledAt
  if (!startDate) return { daysLeft: 90, expiresOn: '—', expired: false }
  const expiryMs = new Date(startDate).getTime() + 90 * 24 * 60 * 60 * 1000
  const daysLeft = Math.ceil((expiryMs - Date.now()) / 86400000)
  const expiresOn = new Date(expiryMs).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
  return { daysLeft, expiresOn, expired: daysLeft <= 0 }
}

function activityBadge(s: Student) {
  const days = daysSince(s.lastActiveAt ?? s.enrolledAt)
  if (days <= 2)  return { label: `Active ${days}d ago`, cls: 'text-green-400' }
  if (days <= 7)  return { label: `${days}d ago`, cls: 'text-yellow-400' }
  if (days <= 14) return { label: `${days}d ago`, cls: 'text-orange-400' }
  return { label: days === 999 ? 'Never logged in' : `${days}d ago`, cls: 'text-red-400' }
}

// ─── Student Row ──────────────────────────────────────────────────────────────

function StudentRow({ student, onToggleSuspend }: { student: Student; onToggleSuspend: (id: string, suspend: boolean) => void }) {
  const payment = paymentBadge(student)
  const activity = activityBadge(student)
  const expiry = accessExpiry(student)
  const maxUnlocked = student.unlockedModules.length > 0 ? Math.max(...student.unlockedModules) : 0

  return (
    <div className={`px-4 py-3 border-b border-gray-800 last:border-0 ${student.suspended ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-3">

        {/* Left: name + email + badges */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="text-white text-sm font-semibold truncate">{student.name}</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${payment.cls}`}>{payment.label}</span>
          </div>
          <p className="text-gray-500 text-xs truncate mb-1.5">{student.email}</p>

          {/* Module dots */}
          <div className="flex items-center gap-1 mb-1.5">
            {MODULE_LABELS.map((label, i) => {
              const unlocked = student.unlockedModules.includes(i + 1)
              const done = student.completions[i]
              return (
                <div
                  key={i}
                  title={`Module ${i + 1}: ${label}${done ? ' ✓' : unlocked ? ' (unlocked)' : ' (locked)'}`}
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold border transition-colors
                    ${done
                      ? 'bg-[#F4B942] border-[#F4B942] text-[#1A1F36]'
                      : unlocked
                        ? 'border-[#F4B942] text-[#F4B942]'
                        : 'border-gray-700 text-gray-600'
                    }`}
                >
                  {done ? '✓' : i + 1}
                </div>
              )
            })}
            <span className={`text-[10px] ml-1 ${activity.cls}`}>{activity.label}</span>
          </div>

          {/* Access expiry */}
          <div className="flex items-center gap-1.5">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={expiry.expired ? '#f87171' : expiry.daysLeft <= 14 ? '#fb923c' : '#6b7280'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            {expiry.expired ? (
              <span className="text-[10px] text-red-400 font-semibold">Access expired {expiry.expiresOn}</span>
            ) : (
              <span className={`text-[10px] font-semibold ${expiry.daysLeft <= 14 ? 'text-orange-400' : 'text-gray-500'}`}>
                {expiry.daysLeft}d left · expires {expiry.expiresOn}
              </span>
            )}
          </div>
        </div>

        {/* Right: suspend toggle */}
        <button
          onClick={() => onToggleSuspend(student.id, !student.suspended)}
          className={`flex-shrink-0 text-[11px] font-bold px-3 py-1.5 rounded-lg border transition-colors ${
            student.suspended
              ? 'border-green-700 text-green-400 hover:bg-green-900/30'
              : 'border-gray-700 text-gray-400 hover:border-red-700 hover:text-red-400'
          }`}
        >
          {student.suspended ? 'Restore' : 'Suspend'}
        </button>

      </div>
    </div>
  )
}

// ─── Batch Section ─────────────────────────────────────────────────────────────

function BatchSection({ batchNumber, students, onToggleSuspend }: {
  batchNumber: number | null
  students: Student[]
  onToggleSuspend: (id: string, suspend: boolean) => void
}) {
  const [expanded, setExpanded] = useState(true)
  const [acting, setActing] = useState<number | null>(null)
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null)
  const router = useRouter()

  const active = students.filter(s => !s.suspended)
  const suspended = students.filter(s => s.suspended)

  // The consensus max = highest module unlocked across active students
  const maxUnlocked = active.length > 0
    ? Math.max(0, ...active.flatMap(s => s.unlockedModules))
    : 0

  async function handleModuleClick(n: number) {
    if (!batchNumber || !!acting) return
    setActing(n)
    setFeedback(null)

    const isLock = n === maxUnlocked   // clicking the current max → lock it
    const endpoint = isLock ? '/api/admin/batch-lock' : '/api/admin/batch-unlock'
    const body = isLock
      ? { batchNumber, fromModule: n }
      : { batchNumber, upToModule: n }

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setFeedback({
        type: 'ok',
        msg: isLock
          ? `Module ${n} locked for ${data.updated} students.`
          : `Modules 1–${n} unlocked for ${data.updated} students.`,
      })
      router.refresh()
    } catch (e: unknown) {
      setFeedback({ type: 'err', msg: e instanceof Error ? e.message : 'Something went wrong' })
    } finally {
      setActing(null)
    }
  }

  const batchLabel = batchNumber ? `Batch ${batchNumber}` : 'Unassigned'

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-2xl overflow-hidden mb-4">

      {/* Batch header */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-800/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-white font-bold text-sm">TOPIS — {batchLabel}</span>
          <span className="text-[11px] text-gray-400">{students.length} students</span>
          {suspended.length > 0 && (
            <span className="text-[11px] bg-red-900/40 text-red-400 border border-red-800 px-2 py-0.5 rounded-full">
              {suspended.length} suspended
            </span>
          )}
        </div>
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className={`text-gray-500 transition-transform ${expanded ? 'rotate-180' : ''}`}
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {expanded && (
        <>
          {/* Module toggle bar */}
          {batchNumber && (
            <div className="px-4 py-3 bg-gray-950/50 border-t border-gray-800">
              <p className="text-[11px] text-gray-500 uppercase tracking-wide font-bold mb-2">
                Module access — {active.length} active students
              </p>
              <div className="flex gap-2 flex-wrap">
                {[1, 2, 3, 4, 5, 6].map(n => {
                  const isUnlocked  = n <= maxUnlocked   // already unlocked
                  const isCurrentMax = n === maxUnlocked  // the topmost unlocked
                  const isBelow     = n < maxUnlocked     // below current max → disabled
                  const isLoading   = acting === n

                  // Style rules:
                  // below max → gold filled, disabled, no cursor
                  // at max    → gold filled, clickable (will lock on click), lock icon hint
                  // above max → gray outline, clickable (will unlock up to here)
                  const cls = isBelow
                    ? 'bg-[#F4B942]/20 border-[#F4B942]/40 text-[#F4B942]/50 cursor-not-allowed'
                    : isCurrentMax
                      ? 'bg-[#F4B942] border-[#F4B942] text-[#1A1F36] hover:bg-[#F4B942]/80'
                      : 'border-gray-700 text-gray-400 hover:border-[#F4B942] hover:text-[#F4B942]'

                  return (
                    <button
                      key={n}
                      onClick={() => !isBelow && handleModuleClick(n)}
                      disabled={isBelow || !!acting || active.length === 0}
                      title={
                        isBelow      ? 'Already unlocked — click the higher module to lock back'
                        : isCurrentMax ? `Click to lock Module ${n}`
                        : `Click to unlock Modules 1–${n}`
                      }
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${cls}`}
                    >
                      {isLoading ? '…' : isCurrentMax ? `M${n} ✓` : isBelow ? `M${n} ✓` : `M${n}`}
                    </button>
                  )
                })}
              </div>

              {/* Feedback line */}
              {feedback && (
                <p className={`text-[11px] mt-2 ${feedback.type === 'ok' ? 'text-green-400' : 'text-red-400'}`}>
                  {feedback.type === 'ok' ? '✓' : '✗'} {feedback.msg}
                </p>
              )}

              <p className="text-[10px] text-gray-600 mt-2">
                Gold = unlocked. Click the highest gold module to lock it back. Click a gray module to unlock up to that point.
              </p>
            </div>
          )}

          {/* Student list */}
          <div className="border-t border-gray-800">
            {students.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-6">No students in this batch.</p>
            ) : (
              students.map(s => (
                <StudentRow key={s.id} student={s} onToggleSuspend={onToggleSuspend} />
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

// ─── Coaches Panel ────────────────────────────────────────────────────────────

function CoachesPanel({ coaches }: { coaches: Coach[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [tempPassword, setTempPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [programType, setProgramType] = useState<'topis' | 'accelerator'>('accelerator')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)

  async function handleCreate() {
    if (!fullName.trim() || !email.trim() || !tempPassword.trim()) return
    setSubmitting(true)
    setResult(null)
    try {
      const res = await fetch('/api/admin/invite-coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName: fullName.trim(), email: email.trim(), programType, tempPassword: tempPassword.trim() }),
      })
      const data = await res.json()
      if (res.ok) {
        setResult({ ok: true, message: `Account created for ${email}.` })
        setFullName('')
        setEmail('')
        setTempPassword('')
        setShowForm(false)
        router.refresh()
      } else {
        setResult({ ok: false, message: data.error || 'Something went wrong.' })
      }
    } catch {
      setResult({ ok: false, message: 'Network error. Please try again.' })
    } finally {
      setSubmitting(false)
    }
  }

  const PROGRAM_LABELS: Record<string, string> = {
    topis: 'TOPIS',
    accelerator: 'Accelerator',
    unknown: 'Unassigned',
  }

  return (
    <div className="mx-4 mb-4 bg-gray-900 border border-gray-700 rounded-2xl overflow-hidden">

      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-800/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-white font-bold text-sm">Coaches</span>
          <span className="text-[11px] text-gray-400">{coaches.length} active</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-[#F4B942] font-bold">+ Add Coach</span>
          <svg
            width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className={`text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`}
          >
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </div>
      </button>

      {open && (
        <div className="border-t border-gray-800">

          {/* Existing coaches */}
          {coaches.length > 0 && (
            <div className="divide-y divide-gray-800">
              {coaches.map(c => (
                <div key={c.id} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-white text-sm font-medium">{c.name}</p>
                    <p className="text-gray-500 text-xs">{c.email}</p>
                  </div>
                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${
                    c.programType === 'accelerator'
                      ? 'bg-blue-900/30 text-blue-400 border-blue-800'
                      : c.programType === 'topis'
                        ? 'bg-amber-900/30 text-amber-400 border-amber-800'
                        : 'bg-gray-800 text-gray-500 border-gray-700'
                  }`}>
                    {PROGRAM_LABELS[c.programType] ?? c.programType}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Create coach form toggle */}
          {!showForm ? (
            <div className="px-4 py-3 border-t border-gray-800">
              <button
                onClick={() => { setShowForm(true); setResult(null) }}
                className="w-full bg-[#1A1F36] border border-[#F4B942]/40 text-[#F4B942] font-bold py-2.5 rounded-xl text-sm hover:border-[#F4B942] transition-colors"
              >
                + Add a New Coach
              </button>
              {result && (
                <p className={`text-xs mt-2 text-center ${result.ok ? 'text-green-400' : 'text-red-400'}`}>
                  {result.ok ? '✓' : '✗'} {result.message}
                </p>
              )}
            </div>
          ) : (
            <div className="px-4 py-4 border-t border-gray-800 space-y-3">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">New Coach Account</p>

              <input
                type="text"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="Full name (e.g. Maria Santos)"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-gray-500"
              />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Email address"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-gray-500"
              />

              {/* Temp password field */}
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={tempPassword}
                  onChange={e => setTempPassword(e.target.value)}
                  placeholder="Temporary password (min. 8 characters)"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-gray-500 pr-16"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-gray-500 hover:text-gray-300"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              <p className="text-[10px] text-gray-600 -mt-1">
                They will be required to change this on their first login.
              </p>

              <div>
                <p className="text-xs text-gray-500 mb-2">Program this coach manages:</p>
                <div className="flex gap-2">
                  {(['accelerator', 'topis'] as const).map(p => (
                    <button
                      key={p}
                      onClick={() => setProgramType(p)}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-colors ${
                        programType === p
                          ? 'bg-[#1A1F36] border-[#F4B942] text-[#F4B942]'
                          : 'border-gray-700 text-gray-500 hover:border-gray-500'
                      }`}
                    >
                      {PROGRAM_LABELS[p]}
                    </button>
                  ))}
                </div>
              </div>

              {result && !result.ok && (
                <p className="text-xs text-red-400">✗ {result.message}</p>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => { setShowForm(false); setResult(null) }}
                  className="flex-1 py-2.5 rounded-xl text-sm text-gray-400 border border-gray-700 hover:border-gray-500 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={submitting || !fullName.trim() || !email.trim() || tempPassword.trim().length < 8}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-[#F4B942] text-[#1A1F36] disabled:opacity-40 transition-opacity"
                >
                  {submitting ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdminDashboard({ students, coaches, adminName }: Props) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'topis' | 'accelerator'>('topis')
  const [signingOut, setSigningOut] = useState(false)

  async function handleSignOut() {
    setSigningOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'suspended'>('all')
  const [togglingId, setTogglingId] = useState<string | null>(null)

  // Split by program
  const topisStudents = students.filter(s => s.programType === 'topis')
  const acceleratorStudents = students.filter(s => s.programType === 'accelerator')
  const otherStudents = students.filter(s => s.programType !== 'topis' && s.programType !== 'accelerator')

  // Filter helpers
  function applyFilters(list: Student[]) {
    return list.filter(s => {
      const matchesSearch = !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.email.toLowerCase().includes(search.toLowerCase())
      const matchesStatus = filterStatus === 'all' || (filterStatus === 'suspended' ? s.suspended : !s.suspended)
      return matchesSearch && matchesStatus
    })
  }

  // Group TOPIS by batch
  const topisByBatch = useMemo(() => {
    const filtered = applyFilters(topisStudents)
    const map = new Map<number | null, Student[]>()
    for (const s of filtered) {
      const key = s.cohortBatch
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(s)
    }
    // Sort: highest batch first, null (unassigned) last
    return [...map.entries()].sort(([a], [b]) => {
      if (a === null) return 1
      if (b === null) return -1
      return b - a
    })
  }, [topisStudents, search, filterStatus])

  async function handleToggleSuspend(studentId: string, suspend: boolean) {
    setTogglingId(studentId)
    try {
      await fetch('/api/admin/toggle-suspension', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, suspend }),
      })
      router.refresh()
    } finally {
      setTogglingId(null)
    }
  }

  // Stats
  const totalStudents = students.length
  const suspended = students.filter(s => s.suspended).length
  const fullyPaid = students.filter(s => s.accessLevel === 'full_access' && !s.suspended).length

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col max-w-[430px] md:max-w-3xl mx-auto">

      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <div className="bg-[#1A1F36] px-5 pt-5 pb-5 flex items-center justify-between">
        <div>
          <p className="text-[#F4B942] text-xs font-bold uppercase tracking-widest mb-0.5">Admin</p>
          <h1 className="text-white text-lg font-bold">Student Management</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#F4B942] flex items-center justify-center text-[#1A1F36] text-sm font-bold">
            {adminName[0]}
          </div>
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className="text-[11px] font-bold text-gray-400 border border-gray-700 px-3 py-1.5 rounded-lg hover:border-gray-500 hover:text-gray-200 transition-colors disabled:opacity-40"
          >
            {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      </div>

      {/* ── Summary stats ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3 px-4 py-4">
        {[
          { label: 'Total Students', value: totalStudents, color: 'text-white' },
          { label: 'Suspended', value: suspended, color: suspended > 0 ? 'text-red-400' : 'text-gray-400' },
          { label: 'Fully Paid', value: fullyPaid, color: 'text-green-400' },
        ].map(stat => (
          <div key={stat.label} className="bg-gray-900 border border-gray-800 rounded-xl px-3 py-3 text-center">
            <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-gray-500 text-[11px] mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* ── Coaches panel ─────────────────────────────────────────────────────── */}
      <CoachesPanel coaches={coaches} />

      {/* ── Program tabs ──────────────────────────────────────────────────────── */}
      <div className="px-4 mb-4">
        <div className="flex bg-gray-900 border border-gray-800 rounded-xl p-1 gap-1">
          {([['topis', `TOPIS (${topisStudents.length})`], ['accelerator', `Accelerator (${acceleratorStudents.length})`]] as const).map(([tab, label]) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${
                activeTab === tab
                  ? 'bg-[#1A1F36] text-[#F4B942]'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Search + filter ───────────────────────────────────────────────────── */}
      <div className="px-4 mb-4 flex gap-2">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or email..."
          className="flex-1 bg-gray-900 border border-gray-800 rounded-xl px-3 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-gray-600"
        />
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value as typeof filterStatus)}
          className="bg-gray-900 border border-gray-800 rounded-xl px-3 py-2 text-sm text-gray-300 focus:outline-none"
        >
          <option value="all">All</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      {/* ── Content ───────────────────────────────────────────────────────────── */}
      <div className="px-4 pb-10 flex-1">

        {/* TOPIS tab */}
        {activeTab === 'topis' && (
          <>
            {topisByBatch.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 text-sm">No TOPIS students found.</p>
              </div>
            ) : (
              topisByBatch.map(([batch, batchStudents]) => (
                <BatchSection
                  key={batch ?? 'unassigned'}
                  batchNumber={batch}
                  students={batchStudents}
                  onToggleSuspend={handleToggleSuspend}
                />
              ))
            )}
          </>
        )}

        {/* Accelerator tab */}
        {activeTab === 'accelerator' && (
          <>
            {applyFilters(acceleratorStudents).length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 text-sm">No Accelerator students found.</p>
              </div>
            ) : (
              <div className="bg-gray-900 border border-gray-700 rounded-2xl overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-800">
                  <p className="text-white font-bold text-sm">Accelerator Students</p>
                  <p className="text-gray-500 text-xs">Each student is managed individually by their coach.</p>
                </div>
                {applyFilters(acceleratorStudents).map(s => (
                  <StudentRow key={s.id} student={s} onToggleSuspend={handleToggleSuspend} />
                ))}
              </div>
            )}
          </>
        )}

        {/* Unknown program students */}
        {otherStudents.length > 0 && (
          <div className="mt-4">
            <p className="text-gray-600 text-xs mb-2 uppercase tracking-wide">No Program Assigned ({otherStudents.length})</p>
            <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
              {applyFilters(otherStudents).map(s => (
                <StudentRow key={s.id} student={s} onToggleSuspend={handleToggleSuspend} />
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
