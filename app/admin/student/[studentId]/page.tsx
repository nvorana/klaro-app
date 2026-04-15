'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Target, BookOpen, DollarSign, FileText, Mail, Gift, Megaphone,
  CheckCircle2, Download, Copy, Check, Phone, Clock, ChevronDown, ChevronUp,
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

const MODULE_ICONS = [Target, BookOpen, DollarSign, FileText, Mail, Gift, Megaphone]

function daysSince(dateStr: string | null): number {
  if (!dateStr) return 999
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24))
}

export default function AdminStudentDetail() {
  const params = useParams()
  const router = useRouter()
  const studentId = params.studentId as string

  const [student, setStudent] = useState<any>(null)
  const [outputs, setOutputs] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Record<number, boolean>>({})
  const [downloading, setDownloading] = useState<string | null>(null)

  useEffect(() => {
    loadStudent()
  }, [studentId])

  async function loadStudent() {
    const res = await fetch(`/api/coach/student?id=${studentId}`)
    if (res.status === 401) { router.push('/login'); return }
    if (res.status === 403) { router.push('/dashboard'); return }
    if (!res.ok) { router.push('/admin'); return }

    const data = await res.json()
    if (!data.profile) { router.push('/admin'); return }

    setStudent(data.profile)
    setOutputs(data.outputs)
    setLoading(false)
  }

  function copyText(text: string, key: string) {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  function toggleExpand(module: number) {
    setExpanded(prev => ({ ...prev, [module]: !prev[module] }))
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#F4B942] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!student) return null

  const name = student.full_name || student.first_name || 'Student'
  const days = daysSince(student.last_active_at ?? student.enrolled_at)

  // 90-day expiry
  const startDate = student.created_at ?? student.enrolled_at
  const daysLeft = startDate ? Math.ceil((new Date(startDate).getTime() + 90 * 24 * 60 * 60 * 1000 - Date.now()) / 86400000) : null
  const expired = daysLeft !== null && daysLeft <= 0

  // Module completions (7 modules)
  const completions = [
    !!outputs.clarity,
    !!outputs.ebook,
    !!outputs.offer,
    !!outputs.salesPage,
    !!outputs.emailSeq,
    !!outputs.leadMagnet,
    !!outputs.posts,
  ]
  const doneCount = completions.filter(Boolean).length

  // ── CopyButton helper ──
  function CopyBtn({ text, copyKey }: { text: string; copyKey: string }) {
    return (
      <button
        onClick={(e) => { e.stopPropagation(); copyText(text, copyKey) }}
        className="shrink-0 p-1.5 rounded-lg transition-all"
        style={{ background: copied === copyKey ? '#064e3b' : '#374151' }}
        title="Copy to clipboard"
      >
        {copied === copyKey
          ? <Check size={12} className="text-green-400" />
          : <Copy size={12} className="text-gray-400" />
        }
      </button>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 max-w-[430px] md:max-w-3xl mx-auto flex flex-col">

      {/* ── Header ───────────────────────────────────────── */}
      <div className="bg-[#1A1F36] px-5 pt-5 pb-4 flex items-center gap-3">
        <Link href="/admin" className="text-gray-400 hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-white font-bold text-lg truncate">{name}</h1>
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
        <div className="text-right shrink-0">
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
            student.access_level === 'full_access'
              ? 'border-green-700 text-green-400 bg-green-900/30'
              : 'border-[#F4B942]/40 text-[#F4B942] bg-[#F4B942]/10'
          }`}>
            {student.access_level === 'full_access' ? 'Full Access' : student.access_level}
          </span>
        </div>
      </div>

      <div className="flex-1 px-4 pt-5 pb-10 space-y-4">

        {/* ── Summary Stats ────────────────────────────────── */}
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
              <p className={`text-2xl font-black ${expired ? 'text-red-400' : daysLeft !== null && daysLeft <= 14 ? 'text-orange-400' : 'text-[#F4B942]'}`}>
                {daysLeft === null ? '—' : expired ? '0d' : `${daysLeft}d`}
              </p>
              <p className="text-gray-500 text-xs">Days Left</p>
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

        {/* ── Module 1: Clarity Builder ───────────────────── */}
        <ModuleCard
          index={0}
          done={completions[0]}
          expanded={!!expanded[0]}
          onToggle={() => toggleExpand(0)}
        >
          {outputs.clarity ? (
            <div className="space-y-3">
              <Field label="Target Market" value={outputs.clarity.target_market} copyKey="clarity-market" />
              <Field label="Core Problem" value={outputs.clarity.core_problem} copyKey="clarity-problem" />
              <Field label="Unique Solution" value={outputs.clarity.unique_mechanism} copyKey="clarity-mechanism" />
              <div className="bg-[#1c1500] border border-[#F4B942]/30 rounded-xl px-3 py-2.5">
                <p className="text-[10px] text-[#F4B942] font-bold uppercase tracking-wide mb-1">Clarity Sentence</p>
                <p className="text-gray-300 text-sm leading-relaxed">{outputs.clarity.full_sentence}</p>
                <div className="mt-2 flex justify-end">
                  <CopyBtn text={outputs.clarity.full_sentence} copyKey="clarity-sentence" />
                </div>
              </div>
            </div>
          ) : <EmptyState />}
        </ModuleCard>

        {/* ── Module 2: Ebook Factory ────────────────────── */}
        <ModuleCard
          index={1}
          done={completions[1]}
          expanded={!!expanded[1]}
          onToggle={() => toggleExpand(1)}
        >
          {outputs.ebook ? (
            <div className="space-y-3">
              <Field label="Title" value={outputs.ebook.title} copyKey="ebook-title" />
              {outputs.ebook.outline?.chapter_outlines && (
                <div>
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wide mb-1">Chapters</p>
                  <div className="space-y-1">
                    {outputs.ebook.outline.chapter_outlines.map((ch: any, i: number) => (
                      <p key={i} className="text-gray-400 text-xs">
                        <span className="text-gray-500 font-semibold">{i + 1}.</span> {ch.title || ch.chapter_title || `Chapter ${i + 1}`}
                      </p>
                    ))}
                  </div>
                </div>
              )}
              <button
                onClick={downloadEbook}
                disabled={downloading === 'ebook'}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold border border-[#F4B942]/40 text-[#F4B942] hover:bg-[#F4B942]/10 transition-colors disabled:opacity-50"
              >
                <Download size={14} />
                {downloading === 'ebook' ? 'Downloading...' : 'Download Ebook (.docx)'}
              </button>
            </div>
          ) : <EmptyState />}
        </ModuleCard>

        {/* ── Module 3: Irresistible Offer ────────────────── */}
        <ModuleCard
          index={2}
          done={completions[2]}
          expanded={!!expanded[2]}
          onToggle={() => toggleExpand(2)}
        >
          {outputs.offer ? (
            <div className="space-y-3">
              {outputs.offer.offer_statement && (
                <Field label="Offer Statement" value={outputs.offer.offer_statement} copyKey="offer-statement" />
              )}
              {outputs.offer.selling_price && (
                <Field label="Selling Price" value={`₱${outputs.offer.selling_price}`} copyKey="offer-price" />
              )}
              {outputs.offer.total_value && (
                <Field label="Total Value" value={`₱${outputs.offer.total_value}`} copyKey="offer-value" />
              )}
              {outputs.offer.guarantee && (
                <Field label="Guarantee" value={outputs.offer.guarantee} copyKey="offer-guarantee" />
              )}
            </div>
          ) : <EmptyState />}
        </ModuleCard>

        {/* ── Module 4: Sales Page Builder ────────────────── */}
        <ModuleCard
          index={3}
          done={completions[3]}
          expanded={!!expanded[3]}
          onToggle={() => toggleExpand(3)}
        >
          {outputs.salesPage ? (
            <div className="space-y-3">
              {outputs.salesPage.headline && (
                <Field label="Headline" value={outputs.salesPage.headline} copyKey="sp-headline" />
              )}
              {outputs.salesPage.full_copy && (
                <div>
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wide mb-1">Full Sales Copy</p>
                  <div className="bg-gray-800 rounded-xl px-3 py-2.5 max-h-60 overflow-y-auto">
                    <p className="text-gray-300 text-xs leading-relaxed whitespace-pre-wrap">{outputs.salesPage.full_copy}</p>
                  </div>
                  <div className="mt-2 flex justify-end">
                    <CopyBtn text={outputs.salesPage.full_copy} copyKey="sp-full" />
                  </div>
                </div>
              )}
            </div>
          ) : <EmptyState />}
        </ModuleCard>

        {/* ── Module 5: 7-Day Email Sequence ──────────────── */}
        <ModuleCard
          index={4}
          done={completions[4]}
          expanded={!!expanded[4]}
          onToggle={() => toggleExpand(4)}
        >
          {outputs.emailSeq ? (
            <div className="space-y-3">
              {outputs.emailSeq.emails && Array.isArray(outputs.emailSeq.emails) ? (
                outputs.emailSeq.emails.map((email: any, i: number) => (
                  <div key={i} className="bg-gray-800 rounded-xl px-3 py-2.5">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[10px] text-[#F4B942] font-bold uppercase">Day {i + 1}{email.subject ? `: ${email.subject}` : ''}</p>
                      {email.body && <CopyBtn text={email.body} copyKey={`email-${i}`} />}
                    </div>
                    {email.body && (
                      <p className="text-gray-400 text-xs leading-relaxed line-clamp-3">{email.body}</p>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-xs">7 emails written</p>
              )}
            </div>
          ) : <EmptyState />}
        </ModuleCard>

        {/* ── Module 6: Lead Magnet Builder ───────────────── */}
        <ModuleCard
          index={5}
          done={completions[5]}
          expanded={!!expanded[5]}
          onToggle={() => toggleExpand(5)}
        >
          {outputs.leadMagnet ? (
            <div className="space-y-3">
              <Field label="Title" value={outputs.leadMagnet.title} copyKey="lm-title" />
              {outputs.leadMagnet.format && (
                <Field label="Format" value={outputs.leadMagnet.format} copyKey="lm-format" />
              )}
              {outputs.leadMagnet.hook && (
                <Field label="Hook" value={outputs.leadMagnet.hook} copyKey="lm-hook" />
              )}
              <button
                onClick={downloadLeadMagnet}
                disabled={downloading === 'lead-magnet'}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold border border-[#F4B942]/40 text-[#F4B942] hover:bg-[#F4B942]/10 transition-colors disabled:opacity-50"
              >
                <Download size={14} />
                {downloading === 'lead-magnet' ? 'Downloading...' : 'Download Lead Magnet (.docx)'}
              </button>
            </div>
          ) : <EmptyState />}
        </ModuleCard>

        {/* ── Module 7: Facebook Content Engine ───────────── */}
        <ModuleCard
          index={6}
          done={completions[6]}
          expanded={!!expanded[6]}
          onToggle={() => toggleExpand(6)}
        >
          {outputs.posts ? (
            <div className="space-y-3">
              {outputs.posts.full_post ? (
                <div>
                  <div className="bg-gray-800 rounded-xl px-3 py-2.5 max-h-60 overflow-y-auto">
                    <p className="text-gray-300 text-xs leading-relaxed whitespace-pre-wrap">{outputs.posts.full_post}</p>
                  </div>
                  <div className="mt-2 flex justify-end">
                    <CopyBtn text={outputs.posts.full_post} copyKey="posts-full" />
                  </div>
                </div>
              ) : (
                <p className="text-gray-500 text-xs">Posts generated</p>
              )}
            </div>
          ) : <EmptyState />}
        </ModuleCard>

      </div>
    </div>
  )

  // ── Reusable sub-components (defined inside for access to CopyBtn) ──

  function Field({ label, value, copyKey }: { label: string; value: string; copyKey: string }) {
    if (!value) return null
    return (
      <div>
        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wide mb-1">{label}</p>
        <div className="flex items-start gap-2">
          <p className="text-gray-300 text-sm leading-relaxed flex-1">{value}</p>
          <CopyBtn text={value} copyKey={copyKey} />
        </div>
      </div>
    )
  }
}

// ── Module Card wrapper ────────────────────────────────────────────────────────

function ModuleCard({ index, done, expanded, onToggle, children }: {
  index: number
  done: boolean
  expanded: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  const IconComp = MODULE_ICONS[index]
  return (
    <div className="bg-gray-900 border border-[#374151] rounded-2xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-800/50 transition-colors"
      >
        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
          done ? 'bg-green-900/50 text-green-400' : 'bg-gray-800 text-gray-500'
        }`}>
          {done ? <CheckCircle2 size={16} /> : <IconComp size={16} />}
        </div>
        <div className="flex-1 text-left">
          <p className={`text-sm font-semibold ${done ? 'text-white' : 'text-gray-500'}`}>
            Module {index + 1}: {MODULE_NAMES[index]}
          </p>
        </div>
        {done && <span className="text-green-400 text-xs font-bold mr-1">Done</span>}
        {!done && <span className="text-gray-600 text-xs mr-1">Not started</span>}
        {expanded ? <ChevronUp size={14} className="text-gray-500" /> : <ChevronDown size={14} className="text-gray-500" />}
      </button>
      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-gray-800">
          {children}
        </div>
      )}
    </div>
  )
}

function EmptyState() {
  return (
    <p className="text-gray-600 text-xs py-2">No output yet. The student has not completed this module.</p>
  )
}
