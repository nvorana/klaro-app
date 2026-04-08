'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Target, BookOpen, DollarSign, Mail, Gift, Megaphone,
  CheckCircle2, Circle, Star, MessageSquare, ClipboardList, Clock, Copy, Check, Phone
} from 'lucide-react'

export const dynamic = 'force-dynamic'

const MODULE_NAMES = [
  'Clarity Builder',
  'Ebook Factory',
  'Sales Page Builder',
  'Email Sequence',
  'Lead Magnet',
  'Facebook Content',
]

const MODULE_ICON_COMPONENTS = [Target, BookOpen, DollarSign, Mail, Gift, Megaphone]

const MESSAGE_TEMPLATES = [
  { label: '🟢 On Track', message: 'Nice progress. Continue and finish this week.' },
  { label: '🟡 Slow Progress', message: "I noticed slow progress. What's blocking you?" },
  { label: '🔴 Inactive', message: "I noticed inactivity. What's stopping you right now?" },
  { label: '❓ No Reply', message: 'Reply with: Done / Stuck / Busy' },
  { label: '🏆 Great Work', message: "You're killing it. Keep this momentum going!" },
]

function daysSince(dateStr: string | null): number {
  if (!dateStr) return 999
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24))
}

function getStatus(days: number) {
  if (days <= 2) return { label: 'On Track', color: 'text-green-400', bg: 'bg-green-900/30 border-green-800' }
  if (days <= 5) return { label: 'At Risk', color: 'text-yellow-400', bg: 'bg-yellow-900/30 border-yellow-800' }
  if (days <= 9) return { label: 'Disengaged', color: 'text-red-400', bg: 'bg-red-900/30 border-red-800' }
  return { label: 'Ghost', color: 'text-gray-400', bg: 'bg-gray-800 border-gray-700' }
}

export default function StudentDetail() {
  const params = useParams()
  const router = useRouter()
  const studentId = params.studentId as string

  const [student, setStudent] = useState<any>(null)
  const [outputs, setOutputs] = useState<any>({})
  const [notes, setNotes] = useState('')
  const [dfyFlagged, setDfyFlagged] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStudent()
  }, [studentId])

  async function loadStudent() {
    const res = await fetch(`/api/coach/student?id=${studentId}`)
    if (res.status === 401) { router.push('/login'); return }
    if (res.status === 403) { router.push('/dashboard'); return }
    if (!res.ok) { router.push('/coach'); return }

    const data = await res.json()
    if (!data.profile) { router.push('/coach'); return }

    setStudent(data.profile)
    setNotes(data.profile.coach_notes ?? '')
    setDfyFlagged(data.profile.dfy_flagged ?? false)
    setOutputs(data.outputs)
    setLoading(false)
  }

  async function saveNotes() {
    setSaving(true)
    await fetch(`/api/coach/student?id=${studentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes, dfy_flagged: dfyFlagged }),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  function copyMessage(msg: string, idx: number) {
    navigator.clipboard.writeText(msg)
    setCopied(idx)
    setTimeout(() => setCopied(null), 2000)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#F4B942] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!student) return null

  const completions = [
    !!outputs.clarity, !!outputs.ebook, !!outputs.salesPage,
    !!outputs.emailSeq, !!outputs.leadMagnet, !!outputs.posts,
  ]
  const doneCount = completions.filter(Boolean).length
  const days = daysSince(student.last_active_at ?? student.enrolled_at)
  const status = getStatus(days)
  const name = student.full_name || student.first_name || 'Student'

  const outputDetails = [
    { done: !!outputs.clarity, label: outputs.clarity?.full_sentence ? `"${outputs.clarity.full_sentence}"` : null },
    { done: !!outputs.ebook, label: outputs.ebook?.title ?? null },
    { done: !!outputs.salesPage, label: outputs.salesPage?.headline ?? null },
    { done: !!outputs.emailSeq, label: outputs.emailSeq ? '7 emails written' : null },
    { done: !!outputs.leadMagnet, label: outputs.leadMagnet?.title ?? null },
    { done: !!outputs.posts, label: outputs.posts ? 'Posts generated' : null },
  ]

  return (
    <div className="min-h-screen bg-gray-950 max-w-[430px] md:max-w-3xl mx-auto flex flex-col">

      {/* ── Header ───────────────────────────────────────── */}
      <div className="bg-[#1A1F36] px-5 pt-5 pb-4 flex items-center gap-3">
        <Link href="/coach" className="text-gray-400 hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-white font-bold text-lg">{name}</h1>
          <p className="text-gray-400 text-xs mb-1">
            Enrolled {student.enrolled_at ? new Date(student.enrolled_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Unknown'}
          </p>
          {student.email && (
            <div className="flex items-center gap-1 text-gray-400 text-xs">
              <Mail size={10} />
              <span>{student.email}</span>
            </div>
          )}
          {student.phone && (
            <div className="flex items-center gap-1 text-gray-400 text-xs mt-0.5">
              <Phone size={10} />
              <span>{student.phone}</span>
            </div>
          )}
        </div>
        <div className="ml-auto">
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${status.bg} ${status.color}`}>
            {status.label}
          </span>
        </div>
      </div>

      <div className="flex-1 px-4 pt-5 pb-10 space-y-4">

        {/* ── Activity Summary ─────────────────────────────── */}
        <div className="bg-gray-900 border border-[#374151] rounded-2xl p-4">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-2xl font-black text-white">{doneCount}/6</p>
              <p className="text-gray-500 text-xs">Modules Done</p>
            </div>
            <div>
              <p className={`text-2xl font-black ${days <= 2 ? 'text-green-400' : days <= 4 ? 'text-yellow-400' : 'text-red-400'}`}>
                {days === 999 ? '—' : days === 0 ? '0d' : `${days}d`}
              </p>
              <p className="text-gray-500 text-xs">Last Active</p>
            </div>
            <div>
              <p className="text-2xl font-black text-[#F4B942]">
                {Math.round((doneCount / 6) * 100)}%
              </p>
              <p className="text-gray-500 text-xs">Complete</p>
            </div>
          </div>
          {/* Progress bar */}
          <div className="mt-4 h-2 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${(doneCount / 6) * 100}%`, background: doneCount === 6 ? '#10B981' : '#F4B942' }}
            />
          </div>
        </div>

        {/* ── Module Breakdown ─────────────────────────────── */}
        <div className="bg-gray-900 border border-[#374151] rounded-2xl p-4">
          <h2 className="text-white font-bold text-sm mb-3">Module Progress</h2>
          <div className="space-y-2.5">
            {MODULE_NAMES.map((modName, i) => {
              const IconComp = MODULE_ICON_COMPONENTS[i]
              return (
              <div key={i} className="flex items-start gap-3">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${completions[i] ? 'bg-green-900/50 text-green-400' : 'bg-gray-800 text-gray-500'}`}>
                  {completions[i] ? <CheckCircle2 size={14} /> : <IconComp size={14} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${completions[i] ? 'text-white' : 'text-gray-500'}`}>{name}</p>
                  {outputDetails[i].label && (
                    <p className={`text-gray-500 text-xs mt-0.5 ${i === 0 ? 'leading-relaxed' : 'truncate'}`}>
                      {outputDetails[i].label}
                    </p>
                  )}
                  {!completions[i] && (
                    <p className="text-gray-600 text-xs mt-0.5">Not started</p>
                  )}
                </div>
                {completions[i] && (
                  <span className="text-green-400 text-xs font-bold shrink-0">Done</span>
                )}
              </div>
              )
            })}
          </div>
        </div>

        {/* ── Message Templates ────────────────────────────── */}
        <div className="bg-gray-900 border border-[#374151] rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <MessageSquare size={15} className="text-gray-400" />
            <h2 className="text-white font-bold text-sm">Message Templates</h2>
          </div>
          <div className="space-y-2">
            {MESSAGE_TEMPLATES.map((t, i) => (
              <div key={i} className="flex items-center gap-2 bg-gray-800 rounded-xl px-3 py-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-gray-400 text-xs font-semibold mb-0.5">{t.label}</p>
                  <p className="text-gray-300 text-xs leading-relaxed">"{t.message}"</p>
                </div>
                <button
                  onClick={() => copyMessage(t.message, i)}
                  className="shrink-0 p-2 rounded-lg transition-all"
                  style={{ background: copied === i ? '#064e3b' : '#374151' }}
                >
                  {copied === i
                    ? <Check size={14} className="text-green-400" />
                    : <Copy size={14} className="text-gray-400" />
                  }
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* ── DFY Flag ─────────────────────────────────────── */}
        <div className="bg-gray-900 border border-[#374151] rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-start gap-2">
              <Star size={15} className="text-[#F4B942] mt-0.5 shrink-0" />
              <div>
                <h2 className="text-white font-bold text-sm">Done-For-You (DFY) Flag</h2>
                <p className="text-gray-500 text-xs mt-0.5">Mark this student as a DFY upsell opportunity</p>
              </div>
            </div>
            <button
              onClick={() => setDfyFlagged(!dfyFlagged)}
              className={`w-12 h-6 rounded-full transition-all relative ${dfyFlagged ? 'bg-[#F4B942]' : 'bg-gray-700'}`}
            >
              <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all ${dfyFlagged ? 'left-6' : 'left-0.5'}`} />
            </button>
          </div>
          {dfyFlagged && (
            <div className="mt-3 bg-[#1c1500] border border-[#F4B942]/30 rounded-xl px-3 py-2">
              <p className="text-[#F4B942] text-xs font-semibold">⭐ Flagged for DFY upsell</p>
              <p className="text-gray-400 text-xs mt-0.5">This student will appear in the DFY list on your dashboard.</p>
            </div>
          )}
        </div>

        {/* ── Coach Notes ──────────────────────────────────── */}
        <div className="bg-gray-900 border border-[#374151] rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <ClipboardList size={15} className="text-gray-400" />
            <h2 className="text-white font-bold text-sm">Coach Notes</h2>
          </div>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Add private notes about this student's progress, blockers, or next actions..."
            rows={4}
            className="w-full bg-gray-800 border border-[#374151] rounded-xl px-3 py-2.5 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-[#F4B942] resize-none transition-colors"
          />
          <button
            onClick={saveNotes}
            disabled={saving}
            className="mt-2 w-full py-3 rounded-xl font-bold text-sm transition-all"
            style={{
              background: saved ? '#064e3b' : '#F4B942',
              color: saved ? '#34d399' : '#1A1F36',
            }}
          >
            {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Notes'}
          </button>
        </div>

      </div>
    </div>
  )
}
