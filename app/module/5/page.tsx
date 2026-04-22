'use client'

import GoldConfetti from '@/components/GoldConfetti'
import ModuleReviewStatus from '@/app/components/ModuleReviewStatus'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { isModuleUnlockedForStudent, getDaysUntilUnlock } from '@/lib/modules'

type Step = 'url' | 'emails' | 'complete'

interface Email {
  day: number
  type: 'value' | 'selling'
  subject_a: string
  subject_b: string
  body: string
  cta: string | null
  // legacy fallback
  subject?: string
}

interface ClarityData {
  target_market: string
  core_problem: string
  unique_mechanism: string
  full_sentence: string
}

const STEP_LABELS = ['Sales Page', 'Your Emails']
const STEP_KEYS: Step[] = ['url', 'emails']

// ── SVG Icons ────────────────────────────────────────────────────
const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

const BackIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6" />
  </svg>
)

const CopyIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
)

const RefreshIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10" />
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
  </svg>
)

const ChevronDownIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
)

const ChevronUpIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="18 15 12 9 6 15" />
  </svg>
)

const MailIcon = ({ selling }: { selling?: boolean }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={selling ? '#92400E' : '#6B7280'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
    <polyline points="22,6 12,13 2,6" />
  </svg>
)

export default function Module4Page() {
  const router = useRouter()
  const [showConfetti, setShowConfetti] = useState(false)
  const [step, setStep] = useState<Step>('url')
  const [clarity, setClarity] = useState<ClarityData | null>(null)
  const [ebookTitle, setEbookTitle] = useState('')
  const [clarityLoading, setClarityLoading] = useState(true)
  const [error, setError] = useState('')

  // URL step
  const [salesPageUrl, setSalesPageUrl] = useState('')

  // Emails step
  const [generatingEmails, setGeneratingEmails] = useState(false)
  const [writingDay, setWritingDay] = useState<number | null>(null)
  const [emails, setEmails] = useState<Email[]>([])
  const [reusablePrompt, setReusablePrompt] = useState('')
  const [expandedDay, setExpandedDay] = useState<number | null>(1)
  const [regeneratingDay, setRegeneratingDay] = useState<number | null>(null)
  const [copiedLabel, setCopiedLabel] = useState<string | null>(null)
  const [promptCopied, setPromptCopied] = useState(false)

  // Lock state
  const [locked, setLocked] = useState(false)
  const [daysUntilUnlock, setDaysUntilUnlock] = useState(0)
  const [nextModuleLocked, setNextModuleLocked] = useState(false)
  const [nextModuleDaysLeft, setNextModuleDaysLeft] = useState(0)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const currentStepIndex = STEP_KEYS.indexOf(step === 'complete' ? 'emails' : step)

  // ── Load data on mount ───────────────────────────────────────
  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      // ── Access check ──────────────────────────────────────────
      const { data: profile } = await supabase
        .from('profiles')
        .select('access_level, enrolled_at, unlocked_modules')
        .eq('id', user.id)
        .maybeSingle()

      if (profile) {
        const unlocked = isModuleUnlockedForStudent(profile.unlocked_modules, profile.access_level, profile.enrolled_at, 5)
        if (!unlocked) {
          setDaysUntilUnlock(profile.enrolled_at ? getDaysUntilUnlock(profile.enrolled_at, 5) : 0)
          setLocked(true)
          setClarityLoading(false)
          return
        }
        // Check if next module (6) is also unlocked — for complete screen CTA
        const next = isModuleUnlockedForStudent(profile.unlocked_modules, profile.access_level, profile.enrolled_at, 6)
        setNextModuleLocked(!next)
        if (!next && profile.enrolled_at) setNextModuleDaysLeft(getDaysUntilUnlock(profile.enrolled_at, 6))
      }

      const { data: clarityData } = await supabase
        .from('clarity_sentences')
        .select('target_market, core_problem, unique_mechanism, full_sentence')
        .eq('user_id', user.id)
        .single()

      if (!clarityData) { router.push('/module/1'); return }
      setClarity(clarityData)

      const { data: ebookData } = await supabase
        .from('ebooks')
        .select('title')
        .eq('user_id', user.id)
        .single()

      setEbookTitle(ebookData?.title || '')

      // Pre-load sales page URL from Module 3
      const { data: spData } = await supabase
        .from('sales_pages')
        .select('published_url')
        .eq('user_id', user.id)
        .single()

      if (spData?.published_url) setSalesPageUrl(spData.published_url)

      // Restore existing sequence
      const { data: seqData } = await supabase
        .from('email_sequences')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (seqData?.emails && Array.isArray(seqData.emails) && seqData.emails.length > 0) {
        setEmails(seqData.emails)
        setReusablePrompt(seqData.reusable_prompt || '')
        if (seqData.sales_page_url) setSalesPageUrl(seqData.sales_page_url)
        setStep('emails')
      }

      setClarityLoading(false)
    }
    loadData()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Generate a single email by day number ─────────────────────
  async function generateSingleEmail(day: number): Promise<Email | null> {
    if (!clarity) return null
    const res = await fetch('/api/generate/email-sequence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        target_market: clarity.target_market,
        problem: clarity.core_problem,
        mechanism: clarity.unique_mechanism,
        ebook_title: ebookTitle,
        sales_page_url: salesPageUrl || 'https://your-sales-page-url.com',
        day,
      }),
    })
    const { data, error: apiErr } = await res.json()
    if (apiErr) throw new Error(apiErr)
    return data.email || null
  }

  // ── Generate all 7 emails (one at a time) ────────────────────
  async function handleGenerateEmails() {
    if (!clarity) return
    setError('')
    setGeneratingEmails(true)
    setStep('emails')
    setEmails([])

    const builtEmails: Email[] = []

    try {
      for (let day = 1; day <= 7; day++) {
        setWritingDay(day)
        const email = await generateSingleEmail(day)
        if (email) {
          builtEmails.push(email)
          setEmails([...builtEmails])
          if (day === 1) setExpandedDay(1)
        }
      }
    } catch {
      setError('Could not generate your email sequence. Please try again.')
      if (builtEmails.length === 0) setStep('url')
    } finally {
      setGeneratingEmails(false)
      setWritingDay(null)
    }
  }

  // ── Regenerate single email ──────────────────────────────────
  async function handleRegenerateEmail(day: number) {
    if (!clarity) return
    setRegeneratingDay(day)
    setError('')
    try {
      const newEmail = await generateSingleEmail(day)
      if (newEmail) {
        setEmails(prev => prev.map(e => e.day === day ? newEmail : e))
      }
    } catch {
      setError(`Could not rewrite Day ${day}. Please try again.`)
    } finally {
      setRegeneratingDay(null)
    }
  }

  // ── Copy helpers ─────────────────────────────────────────────
  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text).catch(() => {})
    setCopiedLabel(label)
    setTimeout(() => setCopiedLabel(null), 2000)
  }

  function buildCopyAllText(): string {
    return emails.map(e => [
      `=== DAY ${e.day} — ${e.type === 'selling' ? 'SELLING EMAIL' : 'VALUE EMAIL'} ===`,
      `Subject A: ${e.subject_a || e.subject || ''}`,
      e.subject_b ? `Subject B: ${e.subject_b}` : '',
      '',
      e.body,
      e.cta ? `\nCTA: ${e.cta}` : '',
    ].filter(line => line !== '').join('\n')).join('\n\n')
  }

  // ── Save & Complete ──────────────────────────────────────────
  async function handleMarkComplete() {
    if (!clarity || emails.length === 0) return
    setError('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // email_sequences — no unique constraint on user_id, so use delete + insert
      await supabase.from('email_sequences').delete().eq('user_id', user.id)
      const { error: seqErr } = await supabase.from('email_sequences').insert({
        user_id: user.id,
        sales_page_url: salesPageUrl || null,
        emails,
        reusable_prompt: reusablePrompt,
      })
      if (seqErr) throw seqErr

      await supabase.from('module_progress').upsert(
        {
          user_id: user.id,
          module_number: 5,
          status: 'complete',
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id, module_number' }
      )

      // Auto-unlock next module for AP students (no-op for other programs)
      fetch('/api/student/complete-module', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moduleNumber: 5 }),
      }).catch(() => {})

      setShowConfetti(true)
      setStep('complete')
    } catch {
      setError('Could not save. Please try again.')
    }
  }

  // ── Progress Dots ────────────────────────────────────────────
  function ProgressDots() {
    return (
      <div className="flex items-center justify-center mb-6">
        {STEP_LABELS.map((label, i) => {
          const isDone = i < currentStepIndex
          const isActive = i === currentStepIndex
          return (
            <div key={label} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center"
                  style={{ background: isDone ? '#10B981' : isActive ? '#F4B942' : '#D1D5DB' }}
                >
                  {isDone ? (
                    <span className="text-white"><CheckIcon /></span>
                  ) : (
                    <span className="text-xs font-bold" style={{ color: isActive ? '#1A1F36' : '#9CA3AF' }}>
                      {i + 1}
                    </span>
                  )}
                </div>
                <span
                  className="text-[10px] mt-1 font-medium whitespace-nowrap"
                  style={{ color: isDone ? '#10B981' : isActive ? '#F4B942' : '#9CA3AF' }}
                >
                  {label}
                </span>
              </div>
              {i < STEP_LABELS.length - 1 && (
                <div
                  className="h-0.5 w-12 mb-4 mx-1"
                  style={{ background: i < currentStepIndex ? '#10B981' : '#D1D5DB' }}
                />
              )}
            </div>
          )
        })}
      </div>
    )
  }

  // ── Loading ──────────────────────────────────────────────────
  if (clarityLoading) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-[#F4B942] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Loading your progress…</p>
        </div>
      </div>
    )
  }

  // ── Locked Screen ────────────────────────────────────────────
  if (locked) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center px-4">
        <div className="max-w-[380px] w-full text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5" style={{ background: '#F3F4F6', border: '1px solid #e5e7eb' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <h1 className="text-lg font-bold text-[#1A1F36] mb-2">Module 5 — Not Yet Open</h1>
          <p className="text-sm text-gray-500 mb-1">The 7-Day Email Sequence opens in</p>
          <p className="text-3xl font-black mb-1" style={{ color: '#F4B942' }}>{daysUntilUnlock} {daysUntilUnlock === 1 ? 'day' : 'days'}</p>
          <p className="text-xs text-gray-500 mb-8">Your sales page is saved and ready.</p>
          <button onClick={() => router.push('/dashboard')} className="w-full py-3 rounded-xl font-bold text-sm" style={{ background: '#F4B942', color: '#1A1F36' }}>
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  // ── Complete Screen ──────────────────────────────────────────
  if (step === 'complete') {
    return (
      <>
        <GoldConfetti trigger={showConfetti} onDone={() => setShowConfetti(false)} />
        <div className="min-h-screen bg-[#F8F9FA]">
        <div className="max-w-[430px] md:max-w-3xl mx-auto px-4 pt-6 pb-32">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: '#F4B942' }}>
              <span className="font-bold text-white text-sm">4</span>
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Module 4</p>
              <h1 className="text-base font-bold text-[#1A1F36]">7-Day Email Sequence</h1>
            </div>
          </div>

          <div className="rounded-xl px-4 py-4 mb-5 flex items-start gap-3" style={{ background: '#ecfdf5', border: '1px solid #10B981' }}>
            <div className="w-6 h-6 rounded-full flex items-center justify-center mt-0.5 flex-shrink-0" style={{ background: '#10B981' }}>
              <span className="text-white"><CheckIcon /></span>
            </div>
            <div>
              <p className="font-bold text-emerald-700">Module 4 Complete!</p>
              <p className="text-sm text-emerald-700 mt-0.5">Your 7-day email sequence is saved.</p>
            </div>
          </div>

          {/* Coach review status (AP students) */}
          <ModuleReviewStatus moduleNumber={5} />

          <div className="bg-white rounded-xl p-4 mb-4 border border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Your Sequence</p>
            {emails.map(e => (
              <div key={e.day} className="flex items-center gap-3 mb-2 last:mb-0">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: e.type === 'selling' ? '#FEF3C7' : '#F3F4F6' }}
                >
                  <MailIcon selling={e.type === 'selling'} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#1A1F36] truncate">{e.subject_a || e.subject}</p>
                  <p className="text-xs text-gray-500">Day {e.day} &middot; {e.type === 'selling' ? 'Selling email' : 'Value email'}</p>
                </div>
              </div>
            ))}
          </div>

          {nextModuleLocked ? (
            <div className="rounded-xl p-4 mb-4 flex flex-col items-center gap-1" style={{ background: '#F3F4F6', border: '1px solid #e5e7eb' }}>
              <div className="flex items-center gap-2 text-gray-500 font-semibold text-sm">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                Module 6 — Lead Magnet Builder
              </div>
              <p className="text-xs text-gray-500">{nextModuleDaysLeft > 0 ? `Opens in ${nextModuleDaysLeft} day${nextModuleDaysLeft !== 1 ? 's' : ''}` : 'Coming soon'}</p>
            </div>
          ) : (
            <div className="rounded-xl p-4 mb-4" style={{ background: '#1A1F36', border: '2px solid #F4B942' }}>
              <p className="text-xs font-medium mb-1" style={{ color: '#F4B942' }}>Up Next</p>
              <p className="text-white font-bold">Module 6 — Lead Magnet Builder</p>
              <p className="text-gray-400 text-sm mt-1">Create a free lead magnet that builds your email list.</p>
              <button
                onClick={() => router.push('/module/6')}
                className="mt-3 w-full py-2.5 rounded-lg font-bold text-sm"
                style={{ background: '#F4B942', color: '#1A1F36' }}
              >
                Start Module 6
              </button>
            </div>
          )}

          <button
            onClick={() => setStep('emails')}
            className="w-full text-center text-sm text-[#F4B942] font-semibold py-2 mb-1"
          >
            Rewrite My Emails
          </button>

          <button
            onClick={() => router.push('/dashboard')}
            className="w-full text-center text-sm text-gray-500 underline py-2"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
      </>
    )
  }

  // ── Main Wizard ──────────────────────────────────────────────
  return (
    <>
      <GoldConfetti trigger={showConfetti} onDone={() => setShowConfetti(false)} />
      <div className="min-h-screen bg-[#F8F9FA]">
      <div className="max-w-[430px] md:max-w-3xl mx-auto px-4 pt-6 pb-36">

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <button
            onClick={() => {
              if (step === 'emails' && !generatingEmails) setStep('url')
              else router.push('/dashboard')
            }}
            className="w-8 h-8 flex items-center justify-center rounded-full flex-shrink-0"
            style={{ background: '#F4B942' }}
            aria-label="Go back"
          >
            <span style={{ color: '#1A1F36' }}><BackIcon /></span>
          </button>
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Module 4</p>
            <h1 className="text-base font-bold text-[#1A1F36]">7-Day Email Sequence</h1>
          </div>
        </div>

        <ProgressDots />

        {error && (
          <div className="bg-red-900/40 border border-red-700 text-red-300 text-sm rounded-lg px-4 py-3 mb-4">
            {error}
          </div>
        )}

        {/* ── URL Step ──────────────────────────────────────── */}
        {step === 'url' && (
          <div>
            <div className="bg-white rounded-xl p-4 mb-4 border border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Writing emails for</p>
              {ebookTitle && <p className="text-sm font-semibold text-[#1A1F36] mb-1">{ebookTitle}</p>}
              {clarity && <p className="text-xs text-gray-500">For: {clarity.target_market}</p>}
            </div>

            <div className="bg-white rounded-xl p-4 mb-4 border border-gray-100">
              <label className="block text-sm font-semibold text-[#1A1F36] mb-1">
                Your Sales Page URL
              </label>
              <p className="text-xs text-gray-500 mb-3">
                Emails 5–7 will link to this. You can skip it for now and add it in Systeme.io.
              </p>
              <input
                type="url"
                value={salesPageUrl}
                onChange={e => setSalesPageUrl(e.target.value)}
                className="w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400/40 bg-[#F8F9FA] text-[#1A1F36]"
                style={{ borderColor: '#e5e7eb' }}
                placeholder="https://yourpage.systeme.io/ebook"
              />
            </div>

            <div className="rounded-xl p-4" style={{ background: '#FFFBEB', borderTop: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb', borderLeft: '4px solid #F4B942' }}>
              <p className="text-xs font-semibold text-[#1A1F36] mb-1">What you&apos;ll get</p>
              <p className="text-sm text-gray-600">
                7 short, personal emails. Days 1–4 build trust with pure value. Days 5–7 gently sell your ebook — no hype, no fake urgency.
              </p>
            </div>
          </div>
        )}

        {/* ── Emails Step ───────────────────────────────────── */}
        {step === 'emails' && (
          <div>
            {/* Generating — animated progress checklist */}
            {generatingEmails && (
              <div className="py-10 px-2">
                {/* CSS animations */}
                <style>{`
                  @keyframes checkBounce {
                    0% { transform: scale(0); opacity: 0; }
                    50% { transform: scale(1.3); }
                    70% { transform: scale(0.9); }
                    100% { transform: scale(1); opacity: 1; }
                  }
                  @keyframes slideInRight {
                    0% { transform: translateX(12px); opacity: 0; }
                    100% { transform: translateX(0); opacity: 1; }
                  }
                  @keyframes typingDot {
                    0%, 60%, 100% { opacity: 0.2; transform: translateY(0); }
                    30% { opacity: 1; transform: translateY(-3px); }
                  }
                  @keyframes pulseGlow {
                    0%, 100% { box-shadow: 0 0 0 0 rgba(244, 185, 66, 0.3); }
                    50% { box-shadow: 0 0 0 6px rgba(244, 185, 66, 0); }
                  }
                  @keyframes progressFill {
                    from { width: var(--from-width); }
                    to { width: var(--to-width); }
                  }
                  .check-bounce { animation: checkBounce 0.4s ease-out forwards; }
                  .slide-in { animation: slideInRight 0.3s ease-out forwards; }
                  .typing-dot { animation: typingDot 1.4s ease-in-out infinite; }
                  .pulse-glow { animation: pulseGlow 2s ease-in-out infinite; }
                `}</style>

                {/* Header with progress bar */}
                <div className="text-center mb-6">
                  <p className="text-base font-bold text-[#1A1F36] mb-1">
                    Writing your emails
                  </p>
                  <p className="text-xs text-gray-500 mb-4">{emails.length} of 7 complete</p>

                  {/* Progress bar */}
                  <div className="w-full h-2 rounded-full overflow-hidden mx-auto" style={{ background: '#F3F4F6', maxWidth: '280px' }}>
                    <div
                      className="h-full rounded-full transition-all duration-700 ease-out"
                      style={{
                        background: 'linear-gradient(90deg, #F4B942, #f59e0b)',
                        width: `${(emails.length / 7) * 100}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Email checklist */}
                <div className="bg-white rounded-xl p-4 space-y-1" style={{ border: '1px solid #e5e7eb' }}>
                  {[1, 2, 3, 4, 5, 6, 7].map(day => {
                    const isDone = emails.some(e => e.day === day)
                    const isWriting = writingDay === day
                    const dayLabel = day <= 4 ? 'Value Email' : day === 5 ? 'Soft Sell' : day === 6 ? 'Medium Sell' : 'Final Close'

                    return (
                      <div
                        key={day}
                        className={`flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all duration-300 ${
                          isWriting ? 'bg-[#FFFBEB]' : isDone ? 'bg-[#f0fdf4]' : ''
                        }`}
                      >
                        {/* Icon */}
                        {isDone ? (
                          <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 check-bounce" style={{ background: '#10B981' }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </div>
                        ) : isWriting ? (
                          <div className="w-7 h-7 rounded-full border-2 border-[#F4B942] flex items-center justify-center flex-shrink-0 pulse-glow">
                            <div className="flex items-center gap-[3px]">
                              <span className="w-[4px] h-[4px] rounded-full bg-[#F4B942] typing-dot" style={{ animationDelay: '0s' }} />
                              <span className="w-[4px] h-[4px] rounded-full bg-[#F4B942] typing-dot" style={{ animationDelay: '0.2s' }} />
                              <span className="w-[4px] h-[4px] rounded-full bg-[#F4B942] typing-dot" style={{ animationDelay: '0.4s' }} />
                            </div>
                          </div>
                        ) : (
                          <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#F3F4F6', border: '1px solid #e5e7eb' }}>
                            <span className="text-xs text-gray-400 font-medium">{day}</span>
                          </div>
                        )}

                        {/* Label */}
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-semibold ${isDone ? 'text-[#1A1F36]' : isWriting ? 'text-[#b45309]' : 'text-gray-400'}`}>
                            Day {day} <span className="font-normal text-xs ml-1">{dayLabel}</span>
                          </p>
                          {isDone && (
                            <p className="text-xs text-gray-500 truncate slide-in">{emails.find(e => e.day === day)?.subject_a}</p>
                          )}
                          {isWriting && (
                            <p className="text-xs text-[#d97706] font-medium">Crafting your email</p>
                          )}
                        </div>

                        {/* Done badge */}
                        {isDone && (
                          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full flex-shrink-0 slide-in">
                            Done
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Emails ready */}
            {!generatingEmails && emails.length > 0 && (
              <div>
                {/* Copy all */}
                <button
                  onClick={() => copyToClipboard(buildCopyAllText(), 'all')}
                  className="w-full py-3 rounded-xl font-semibold text-sm mb-4 flex items-center justify-center gap-2 transition-all"
                  style={{
                    background: copiedLabel === 'all' ? '#ecfdf5' : '#F3F4F6',
                    color: copiedLabel === 'all' ? '#065F46' : '#F4B942',
                    border: `1px solid ${copiedLabel === 'all' ? '#10B981' : '#e5e7eb'}`,
                  }}
                >
                  <CopyIcon />
                  {copiedLabel === 'all' ? 'Copied All 7 Emails!' : 'Copy All 7 Emails'}
                </button>

                {/* Rewrite all */}
                <button
                  onClick={handleGenerateEmails}
                  className="w-full py-3 rounded-xl font-semibold text-sm mb-4 flex items-center justify-center gap-2 transition-all"
                  style={{ background: '#F3F4F6', color: '#6B7280', border: '1px solid #e5e7eb' }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="23 4 23 10 17 10" />
                    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                  </svg>
                  Rewrite All Emails
                </button>

                {/* Accordion */}
                <div className="space-y-2 mb-5">
                  {emails.map(email => {
                    const isExpanded = expandedDay === email.day
                    const isRegenerating = regeneratingDay === email.day
                    return (
                      <div
                        key={email.day}
                        className="bg-white rounded-xl overflow-hidden"
                        style={{ border: `1.5px solid ${isExpanded ? '#F4B942' : '#e5e7eb'}` }}
                      >
                        {/* Header row */}
                        <button
                          onClick={() => setExpandedDay(isExpanded ? null : email.day)}
                          className="w-full px-4 py-3 flex items-center gap-3 text-left"
                        >
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                            style={{ background: email.type === 'selling' ? '#FEF3C7' : '#F3F4F6' }}
                          >
                            <MailIcon selling={email.type === 'selling'} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-xs font-bold text-gray-500">Day {email.day}</span>
                              <span
                                className="text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide"
                                style={{
                                  background: email.type === 'selling' ? '#FEF3C7' : '#F3F4F6',
                                  color: email.type === 'selling' ? '#92400E' : '#6B7280',
                                }}
                              >
                                {email.type === 'selling' ? 'Selling' : 'Value'}
                              </span>
                            </div>
                            <p className="text-sm font-medium text-[#1A1F36] truncate pr-2">
                              {email.subject_a || email.subject || ''}
                            </p>
                          </div>
                          <span className="text-gray-500 flex-shrink-0">
                            {isExpanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
                          </span>
                        </button>

                        {/* Expanded body */}
                        {isExpanded && (
                          <div className="px-4 pb-4 border-t" style={{ borderColor: '#F4B942' }}>
                            <div className="flex items-center justify-between pt-3 mb-3">
                              <p className="text-xs text-gray-500">Subject line + body</p>
                              <div className="flex items-center gap-3">
                                <button
                                  onClick={() => handleRegenerateEmail(email.day)}
                                  disabled={regeneratingDay !== null}
                                  className="flex items-center gap-1 text-xs text-gray-400 disabled:opacity-40"
                                >
                                  <RefreshIcon />
                                  <span>{isRegenerating ? 'Rewriting…' : 'Rewrite'}</span>
                                </button>
                                <button
                                  onClick={() => copyToClipboard(
                                    [
                                      `Subject A: ${email.subject_a || email.subject || ''}`,
                                      email.subject_b ? `Subject B: ${email.subject_b}` : '',
                                      '',
                                      email.body,
                                      email.cta ? `\nCTA: ${email.cta}` : '',
                                    ].filter(l => l !== '').join('\n'),
                                    `day-${email.day}`
                                  )}
                                  className="flex items-center gap-1 text-xs"
                                  style={{ color: copiedLabel === `day-${email.day}` ? '#6EE7B7' : '#9CA3AF' }}
                                >
                                  <CopyIcon />
                                  <span>{copiedLabel === `day-${email.day}` ? 'Copied!' : 'Copy'}</span>
                                </button>
                              </div>
                            </div>

                            {isRegenerating ? (
                              <div className="flex items-center gap-2 py-4">
                                <div className="w-4 h-4 border-2 border-[#F4B942] border-t-transparent rounded-full animate-spin" />
                                <p className="text-sm text-gray-500">Rewriting Day {email.day}…</p>
                              </div>
                            ) : (
                              <>
                                {/* Subject line options */}
                                <div className="mb-3 pb-3 space-y-1.5" style={{ borderBottom: '1px solid #e5e7eb' }}>
                                  <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Subject Lines (pick one)</p>
                                  <div className="flex items-start gap-2">
                                    <span className="text-[10px] font-bold text-[#F4B942] mt-0.5 flex-shrink-0">A</span>
                                    <p className="text-sm font-semibold text-[#1A1F36]">{email.subject_a || email.subject}</p>
                                  </div>
                                  {email.subject_b && (
                                    <div className="flex items-start gap-2">
                                      <span className="text-[10px] font-bold text-gray-500 mt-0.5 flex-shrink-0">B</span>
                                      <p className="text-sm font-medium text-gray-500">{email.subject_b}</p>
                                    </div>
                                  )}
                                </div>
                                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap mb-3">
                                  {email.body}
                                </p>
                                {email.cta && (
                                  <div className="rounded-lg px-3 py-2" style={{ background: '#FFFBEB', border: '1px solid #F4B942' }}>
                                    <p className="text-xs font-semibold mb-1" style={{ color: '#F4B942' }}>CTA Link</p>
                                    <p className="text-xs text-yellow-200 break-all">{email.cta}</p>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

              </div>
            )}
          </div>
        )}

      </div>

      {/* ── Fixed Bottom Action Bar ──────────────────────────── */}
      {step !== 'complete' && (
        <div
          className="fixed bottom-0 bg-white px-4 py-4"
          style={{
            borderTop: '1px solid #e5e7eb',
            width: '100%',
            maxWidth: '430px',
            left: '50%',
            transform: 'translateX(-50%)',
          }}
        >
          {step === 'url' && (
            <button
              onClick={handleGenerateEmails}
              className="w-full py-4 rounded-xl font-bold text-base"
              style={{ background: '#F4B942', color: '#1A1F36' }}
            >
              Write My 7 Emails
            </button>
          )}

          {step === 'emails' && generatingEmails && (
            <div
              className="w-full py-4 rounded-xl font-bold text-base flex items-center justify-center gap-2 opacity-60"
              style={{ background: '#F3F4F6', color: '#9CA3AF', border: '1px solid #e5e7eb' }}
            >
              <div className="w-4 h-4 border-2 border-gray-500 border-t-transparent rounded-full animate-spin" />
              Writing Day {writingDay || 1} of 7…
            </div>
          )}

          {step === 'emails' && !generatingEmails && emails.length > 0 && (
            <button
              onClick={handleMarkComplete}
              className="w-full py-4 rounded-xl font-bold text-base"
              style={{ background: '#F4B942', color: '#1A1F36' }}
            >
              Save &amp; Complete Module 4
            </button>
          )}
        </div>
      )}
    </div>
    </>
  )
}
