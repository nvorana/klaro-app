'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Target, BookOpen, DollarSign, FileText, Mail, Gift, Megaphone,
  CheckCircle2, Circle, Star, MessageSquare, ClipboardList, Clock, Copy, Check, Phone,
  ThumbsUp, AlertCircle, Unlock, Eye, EyeOff, Download,
} from 'lucide-react'

export const dynamic = 'force-dynamic'

const MODULE_NAMES = [
  'Clarity Builder',
  'Ebook Factory',
  'Irresistible Offer',
  'Sales Page Builder',
  '7-Day Email Sequence',
  'Lead Magnet Builder',
  'Facebook Content Engine',
]

const MODULE_ICON_COMPONENTS = [Target, BookOpen, DollarSign, FileText, Mail, Gift, Megaphone]

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
  const [reviews, setReviews] = useState<any[]>([])
  const [notes, setNotes] = useState('')
  const [dfyFlagged, setDfyFlagged] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [resetting, setResetting] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [reviewingModule, setReviewingModule] = useState<number | null>(null)
  const [revisionNote, setRevisionNote] = useState('')
  const [reviewLoading, setReviewLoading] = useState(false)
  const [expandedWork, setExpandedWork] = useState<Record<number, boolean>>({})
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [downloading, setDownloading] = useState<string | null>(null)

  function toggleWork(moduleNum: number) {
    setExpandedWork(prev => ({ ...prev, [moduleNum]: !prev[moduleNum] }))
  }

  function copyField(text: string, key: string) {
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 2000)
  }

  async function downloadEbook() {
    if (!outputs.ebook) return
    setDownloading('ebook')
    try {
      const res = await fetch('/api/export/ebook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: outputs.ebook.title,
          target_market: outputs.clarity?.target_market || '',
          outline: outputs.ebook.outline,
          chapters: outputs.ebook.chapters,
        }),
      })
      if (res.ok) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${outputs.ebook.title || 'ebook'}.docx`
        a.click()
        URL.revokeObjectURL(url)
      }
    } finally {
      setDownloading(null)
    }
  }

  async function downloadLeadMagnet() {
    if (!outputs.leadMagnet) return
    setDownloading('lead-magnet')
    try {
      const res = await fetch('/api/export/lead-magnet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: outputs.leadMagnet.title,
          format: outputs.leadMagnet.format,
          hook: outputs.leadMagnet.hook,
          introduction: outputs.leadMagnet.introduction,
          main_content: outputs.leadMagnet.main_content,
          quick_win: outputs.leadMagnet.quick_win,
          bridge_to_ebook: outputs.leadMagnet.bridge_to_ebook,
        }),
      })
      if (res.ok) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${outputs.leadMagnet.title || 'lead-magnet'}.docx`
        a.click()
        URL.revokeObjectURL(url)
      }
    } finally {
      setDownloading(null)
    }
  }

  useEffect(() => {
    loadStudent()
  }, [studentId])

  async function resetStudent() {
    setResetting(true)
    await fetch('/api/coach/reset-student', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId }),
    })
    setResetting(false)
    setShowResetConfirm(false)
    loadStudent()
  }

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
    setReviews(data.reviews ?? [])
    setLoading(false)
  }

  function getReview(moduleNumber: number) {
    return reviews.find((r: any) => r.module_number === moduleNumber) ?? null
  }

  async function submitReview(moduleNumber: number, status: 'approved' | 'needs_revision') {
    setReviewLoading(true)
    await fetch('/api/coach/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentId,
        moduleNumber,
        status,
        note: status === 'needs_revision' ? revisionNote : null,
      }),
    })
    setReviewLoading(false)
    setReviewingModule(null)
    setRevisionNote('')
    loadStudent() // Refresh to show updated review + unlocked module
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
    !!outputs.clarity, !!outputs.ebook, !!outputs.offer, !!outputs.salesPage,
    !!outputs.emailSeq, !!outputs.leadMagnet, !!outputs.posts,
  ]
  const doneCount = completions.filter(Boolean).length
  const days = daysSince(student.last_active_at ?? student.enrolled_at)
  const status = getStatus(days)
  const name = student.full_name || student.first_name || 'Student'
  const isAP = student.program_type === 'accelerator'

  const outputDetails = [
    { done: !!outputs.clarity, label: outputs.clarity?.full_sentence ? `"${outputs.clarity.full_sentence}"` : null },
    { done: !!outputs.ebook, label: outputs.ebook?.title ?? null },
    { done: !!outputs.offer, label: outputs.offer?.offer_statement ? 'Offer built' : null },
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
              <p className="text-2xl font-black text-white">{doneCount}/7</p>
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
                {Math.round((doneCount / 7) * 100)}%
              </p>
              <p className="text-gray-500 text-xs">Complete</p>
            </div>
          </div>
          {/* Progress bar */}
          <div className="mt-4 h-2 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${(doneCount / 7) * 100}%`, background: doneCount === 7 ? '#10B981' : '#F4B942' }}
            />
          </div>
        </div>

        {/* ── Module Breakdown ─────────────────────────────── */}
        <div className="bg-gray-900 border border-[#374151] rounded-2xl p-4">
          <h2 className="text-white font-bold text-sm mb-3">Module Progress</h2>
          <div className="space-y-3">
            {MODULE_NAMES.map((modName, i) => {
              const IconComp = MODULE_ICON_COMPONENTS[i]
              const moduleNum = i + 1
              const review = getReview(moduleNum)
              const isCompleted = completions[i]

              return (
              <div key={i} className="bg-gray-800/50 rounded-xl p-3">
                <div className="flex items-start gap-3">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${isCompleted ? 'bg-green-900/50 text-green-400' : 'bg-gray-800 text-gray-500'}`}>
                    {isCompleted ? <CheckCircle2 size={14} /> : <IconComp size={14} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${isCompleted ? 'text-white' : 'text-gray-500'}`}>
                      Module {moduleNum}: {modName}
                    </p>
                    {outputDetails[i].label && (
                      <p className={`text-gray-500 text-xs mt-0.5 ${i === 0 ? 'leading-relaxed' : 'truncate'}`}>
                        {outputDetails[i].label}
                      </p>
                    )}
                    {!isCompleted && (
                      <p className="text-gray-600 text-xs mt-0.5">Not started</p>
                    )}
                  </div>
                  <div className="shrink-0 flex items-center gap-1.5">
                    {isCompleted && !review && (
                      <span className="text-gray-500 text-xs font-semibold">Pending Review</span>
                    )}
                    {review?.status === 'approved' && (
                      <span className="text-green-400 text-xs font-bold flex items-center gap-1">
                        <ThumbsUp size={11} /> Approved
                      </span>
                    )}
                    {review?.status === 'needs_revision' && (
                      <span className="text-amber-400 text-xs font-bold flex items-center gap-1">
                        <AlertCircle size={11} /> Revise
                      </span>
                    )}
                    {!isCompleted && !review && (
                      <span className="text-gray-600 text-xs">—</span>
                    )}
                  </div>
                </div>

                {/* Review note display */}
                {review?.status === 'needs_revision' && review.note && (
                  <div className="mt-2 ml-10 bg-amber-900/20 border border-amber-800/40 rounded-lg px-3 py-2">
                    <p className="text-amber-300 text-xs leading-relaxed">{review.note}</p>
                  </div>
                )}

                {/* View Full Work toggle (any completed module) */}
                {isCompleted && (
                  <div className="mt-2 ml-10">
                    <button
                      onClick={() => toggleWork(moduleNum)}
                      className="flex items-center gap-1.5 text-xs text-blue-400 font-semibold hover:text-blue-300"
                    >
                      {expandedWork[moduleNum] ? <EyeOff size={12} /> : <Eye size={12} />}
                      {expandedWork[moduleNum] ? 'Hide work' : 'View full work'}
                    </button>
                  </div>
                )}

                {/* Expanded Work Content */}
                {isCompleted && expandedWork[moduleNum] && (
                  <div className="mt-3 ml-10 bg-gray-900 border border-gray-700 rounded-xl p-3">
                    {moduleNum === 1 && outputs.clarity && (
                      <div className="space-y-3">
                        <WorkField label="Target Market" value={outputs.clarity.target_market} copyKey="c-market" copiedKey={copiedKey} onCopy={copyField} />
                        <WorkField label="Core Problem" value={outputs.clarity.core_problem} copyKey="c-problem" copiedKey={copiedKey} onCopy={copyField} />
                        <WorkField label="Unique Solution" value={outputs.clarity.unique_mechanism} copyKey="c-mech" copiedKey={copiedKey} onCopy={copyField} />
                        <div className="bg-[#1c1500] border border-[#F4B942]/30 rounded-lg px-3 py-2">
                          <p className="text-[10px] text-[#F4B942] font-bold uppercase tracking-wide mb-1">Clarity Sentence</p>
                          <p className="text-gray-300 text-xs leading-relaxed">{outputs.clarity.full_sentence}</p>
                          <div className="mt-2 flex justify-end">
                            <CopyIconBtn text={outputs.clarity.full_sentence} copyKey="c-sent" copiedKey={copiedKey} onCopy={copyField} />
                          </div>
                        </div>
                      </div>
                    )}

                    {moduleNum === 2 && outputs.ebook && (
                      <div className="space-y-3">
                        <WorkField label="Ebook Title" value={outputs.ebook.title} copyKey="e-title" copiedKey={copiedKey} onCopy={copyField} />
                        {outputs.ebook.outline?.chapter_outlines && (
                          <div>
                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wide mb-1">Chapters</p>
                            <div className="space-y-1">
                              {outputs.ebook.outline.chapter_outlines.map((ch: any, idx: number) => (
                                <p key={idx} className="text-gray-400 text-xs">
                                  <span className="text-gray-500 font-semibold">{idx + 1}.</span> {ch.title || ch.chapter_title || `Chapter ${idx + 1}`}
                                </p>
                              ))}
                            </div>
                          </div>
                        )}
                        <button
                          onClick={downloadEbook}
                          disabled={downloading === 'ebook'}
                          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold border border-[#F4B942]/40 text-[#F4B942] hover:bg-[#F4B942]/10 transition-colors disabled:opacity-50"
                        >
                          <Download size={12} />
                          {downloading === 'ebook' ? 'Downloading...' : 'Download Ebook (.docx)'}
                        </button>
                      </div>
                    )}

                    {moduleNum === 3 && outputs.offer && (
                      <div className="space-y-3">
                        {outputs.offer.offer_statement && (
                          <WorkField label="Offer Statement" value={outputs.offer.offer_statement} copyKey="o-statement" copiedKey={copiedKey} onCopy={copyField} multiline />
                        )}
                        {outputs.offer.selling_price && (
                          <WorkField label="Selling Price" value={`₱${outputs.offer.selling_price}`} copyKey="o-price" copiedKey={copiedKey} onCopy={copyField} />
                        )}
                        {outputs.offer.total_value && (
                          <WorkField label="Total Value" value={`₱${outputs.offer.total_value}`} copyKey="o-value" copiedKey={copiedKey} onCopy={copyField} />
                        )}
                        {outputs.offer.guarantee && (
                          <WorkField label="Guarantee" value={outputs.offer.guarantee} copyKey="o-guarantee" copiedKey={copiedKey} onCopy={copyField} multiline />
                        )}
                      </div>
                    )}

                    {moduleNum === 4 && outputs.salesPage && (
                      <div className="space-y-3">
                        {outputs.salesPage.headline && (
                          <WorkField label="Headline" value={outputs.salesPage.headline} copyKey="sp-head" copiedKey={copiedKey} onCopy={copyField} multiline />
                        )}
                        {outputs.salesPage.full_copy && (
                          <div>
                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wide mb-1">Full Sales Copy</p>
                            <div className="bg-gray-800 rounded-lg px-3 py-2 max-h-60 overflow-y-auto">
                              <p className="text-gray-300 text-xs leading-relaxed whitespace-pre-wrap">{outputs.salesPage.full_copy}</p>
                            </div>
                            <div className="mt-1.5 flex justify-end">
                              <CopyIconBtn text={outputs.salesPage.full_copy} copyKey="sp-full" copiedKey={copiedKey} onCopy={copyField} />
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {moduleNum === 5 && outputs.emailSeq && (
                      <div className="space-y-2">
                        {Array.isArray(outputs.emailSeq.emails) ? (
                          outputs.emailSeq.emails.map((email: any, idx: number) => (
                            <div key={idx} className="bg-gray-800 rounded-lg px-3 py-2">
                              <div className="flex items-center justify-between mb-1">
                                <p className="text-[10px] text-[#F4B942] font-bold uppercase">Day {email.day ?? idx + 1}{email.subject_a ? `: ${email.subject_a}` : email.subject ? `: ${email.subject}` : ''}</p>
                                {email.body && <CopyIconBtn text={email.body} copyKey={`em-${idx}`} copiedKey={copiedKey} onCopy={copyField} />}
                              </div>
                              {email.body && (
                                <p className="text-gray-400 text-xs leading-relaxed whitespace-pre-wrap max-h-40 overflow-y-auto">{email.body}</p>
                              )}
                            </div>
                          ))
                        ) : (
                          <p className="text-gray-500 text-xs">7 emails written (no content data)</p>
                        )}
                      </div>
                    )}

                    {moduleNum === 6 && outputs.leadMagnet && (
                      <div className="space-y-3">
                        <WorkField label="Title" value={outputs.leadMagnet.title} copyKey="lm-title" copiedKey={copiedKey} onCopy={copyField} />
                        {outputs.leadMagnet.format && (
                          <WorkField label="Format" value={outputs.leadMagnet.format} copyKey="lm-format" copiedKey={copiedKey} onCopy={copyField} />
                        )}
                        {outputs.leadMagnet.hook && (
                          <WorkField label="Hook" value={outputs.leadMagnet.hook} copyKey="lm-hook" copiedKey={copiedKey} onCopy={copyField} multiline />
                        )}
                        {outputs.leadMagnet.introduction && (
                          <WorkField label="Introduction" value={outputs.leadMagnet.introduction} copyKey="lm-intro" copiedKey={copiedKey} onCopy={copyField} multiline />
                        )}
                        {outputs.leadMagnet.main_content && (
                          <div>
                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wide mb-1">Main Content</p>
                            <div className="bg-gray-800 rounded-lg px-3 py-2 max-h-60 overflow-y-auto">
                              <p className="text-gray-300 text-xs leading-relaxed whitespace-pre-wrap">{outputs.leadMagnet.main_content}</p>
                            </div>
                            <div className="mt-1.5 flex justify-end">
                              <CopyIconBtn text={outputs.leadMagnet.main_content} copyKey="lm-main" copiedKey={copiedKey} onCopy={copyField} />
                            </div>
                          </div>
                        )}
                        <button
                          onClick={downloadLeadMagnet}
                          disabled={downloading === 'lead-magnet'}
                          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold border border-[#F4B942]/40 text-[#F4B942] hover:bg-[#F4B942]/10 transition-colors disabled:opacity-50"
                        >
                          <Download size={12} />
                          {downloading === 'lead-magnet' ? 'Downloading...' : 'Download Lead Magnet (.docx)'}
                        </button>
                      </div>
                    )}

                    {moduleNum === 7 && outputs.posts && (
                      <div>
                        {outputs.posts.full_post ? (
                          <div>
                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wide mb-1">Facebook Posts</p>
                            <div className="bg-gray-800 rounded-lg px-3 py-2 max-h-60 overflow-y-auto">
                              <p className="text-gray-300 text-xs leading-relaxed whitespace-pre-wrap">{outputs.posts.full_post}</p>
                            </div>
                            <div className="mt-1.5 flex justify-end">
                              <CopyIconBtn text={outputs.posts.full_post} copyKey="p-full" copiedKey={copiedKey} onCopy={copyField} />
                            </div>
                          </div>
                        ) : (
                          <p className="text-gray-500 text-xs">Posts generated (no content data)</p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Review controls (AP students only, completed modules only) */}
                {isAP && isCompleted && (
                  <div className="mt-2 ml-10">
                    {reviewingModule === moduleNum ? (
                      /* Expanded review form */
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <button
                            onClick={() => submitReview(moduleNum, 'approved')}
                            disabled={reviewLoading}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold bg-green-800 text-green-300 hover:bg-green-700 transition-colors disabled:opacity-50"
                          >
                            <ThumbsUp size={12} /> Approve
                          </button>
                          <button
                            onClick={() => {
                              if (revisionNote.trim()) {
                                submitReview(moduleNum, 'needs_revision')
                              }
                            }}
                            disabled={reviewLoading || !revisionNote.trim()}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold bg-amber-800 text-amber-300 hover:bg-amber-700 transition-colors disabled:opacity-50"
                          >
                            <AlertCircle size={12} /> Needs Revision
                          </button>
                        </div>
                        <textarea
                          value={revisionNote}
                          onChange={e => setRevisionNote(e.target.value)}
                          placeholder="Add a note for revision (required for 'Needs Revision')..."
                          rows={2}
                          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:border-[#F4B942] resize-none"
                        />
                        <button
                          onClick={() => { setReviewingModule(null); setRevisionNote('') }}
                          className="text-gray-500 text-xs hover:text-gray-300"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      /* Review button */
                      <button
                        onClick={() => setReviewingModule(moduleNum)}
                        className="text-xs text-[#F4B942] font-semibold hover:underline"
                      >
                        {review ? 'Re-review' : 'Review this module'}
                      </button>
                    )}
                  </div>
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

        {/* ── Reset Student ─────────────────────────────────── */}
        <div className="mt-6 pt-6 border-t border-[#374151]">
          {!showResetConfirm ? (
            <button
              onClick={() => setShowResetConfirm(true)}
              className="w-full py-2.5 rounded-xl text-sm font-semibold border border-red-800 text-red-400 hover:bg-red-900/20 transition-colors"
            >
              Reset Student Progress
            </button>
          ) : (
            <div className="bg-red-900/20 border border-red-800 rounded-xl p-4">
              <p className="text-red-300 text-sm font-semibold mb-1">Are you sure?</p>
              <p className="text-red-400 text-xs mb-4">This will delete all module progress, outputs, and the clarity sentence for this student. This cannot be undone.</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={resetStudent}
                  disabled={resetting}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-red-700 text-white hover:bg-red-600 transition-colors disabled:opacity-50"
                >
                  {resetting ? 'Resetting…' : 'Yes, Reset'}
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

// ── Helper components for inline work viewer ─────────────────────────────────

function CopyIconBtn({ text, copyKey, copiedKey, onCopy }: {
  text: string
  copyKey: string
  copiedKey: string | null
  onCopy: (text: string, key: string) => void
}) {
  const isCopied = copiedKey === copyKey
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onCopy(text, copyKey) }}
      className="shrink-0 p-1 rounded-md transition-all"
      style={{ background: isCopied ? '#064e3b' : '#374151' }}
      title="Copy to clipboard"
    >
      {isCopied
        ? <Check size={11} className="text-green-400" />
        : <Copy size={11} className="text-gray-400" />
      }
    </button>
  )
}

function WorkField({ label, value, copyKey, copiedKey, onCopy, multiline }: {
  label: string
  value: string
  copyKey: string
  copiedKey: string | null
  onCopy: (text: string, key: string) => void
  multiline?: boolean
}) {
  if (!value) return null
  return (
    <div>
      <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wide mb-1">{label}</p>
      <div className="flex items-start gap-2">
        <p className={`text-gray-300 text-xs leading-relaxed flex-1 ${multiline ? 'whitespace-pre-wrap' : ''}`}>{value}</p>
        <CopyIconBtn text={value} copyKey={copyKey} copiedKey={copiedKey} onCopy={onCopy} />
      </div>
    </div>
  )
}
