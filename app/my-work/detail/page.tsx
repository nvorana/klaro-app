'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createBrowserClient } from '@supabase/ssr'

interface ClarityData {
  target_market: string
  core_problem: string
  unique_mechanism: string
  full_sentence: string
  created_at: string
}

interface ChapterOutline {
  number: number
  title: string
}

interface EbookData {
  id: string
  title: string
  outline: {
    subtitle?: string
    chapter_outlines?: ChapterOutline[]
  }
  chapters: unknown[]
  created_at: string
}

interface SalesPageData {
  headline: string
  hook: string
  full_copy: string
  created_at: string
}

interface EmailSeqData {
  created_at: string
}

export default function MyWorkDetailPage() {
  const router = useRouter()
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const [clarity, setClarity] = useState<ClarityData | null>(null)
  const [ebook, setEbook] = useState<EbookData | null>(null)
  const [salesPage, setSalesPage] = useState<SalesPageData | null>(null)
  const [emailSeq, setEmailSeq] = useState<EmailSeqData | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAllChapters, setShowAllChapters] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      const uid = session.user.id
      const [clarityRes, ebookRes, salesPageRes, emailRes] = await Promise.all([
        supabase.from('clarity_sentences').select('target_market, core_problem, unique_mechanism, full_sentence, created_at').eq('user_id', uid).single(),
        supabase.from('ebooks').select('id, title, outline, chapters, created_at').eq('user_id', uid).order('created_at', { ascending: false }).limit(1).single(),
        supabase.from('sales_pages').select('headline, hook, full_copy, created_at').eq('user_id', uid).single(),
        supabase.from('module_progress').select('created_at').eq('user_id', uid).eq('module_number', 4).eq('status', 'complete').maybeSingle(),
      ])

      if (clarityRes.data) setClarity(clarityRes.data)
      if (ebookRes.data) setEbook(ebookRes.data)
      if (salesPageRes.data?.full_copy) setSalesPage(salesPageRes.data)
      if (emailRes.data) setEmailSeq(emailRes.data)
      setLoading(false)
    }
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const JOURNEY_STEPS = [
    { num: 1, label: 'Clarity',    done: !!clarity },
    { num: 2, label: 'E-Book',     done: !!ebook },
    { num: 3, label: 'Sales Page', done: !!salesPage },
    { num: 4, label: 'Launch',     done: !!emailSeq },
  ]

  const chapters = (ebook?.outline?.chapter_outlines ?? []) as ChapterOutline[]
  const CHAPTER_PREVIEW = 3
  const visibleChapters = showAllChapters ? chapters : chapters.slice(0, CHAPTER_PREVIEW)
  const hasHiddenChapters = chapters.length > CHAPTER_PREVIEW

  // Determine next incomplete step
  const nextStep = JOURNEY_STEPS.find(s => !s.done)

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-gray-500 text-sm animate-pulse">Loading…</p>
      </div>
    )
  }

  const projectName = ebook?.title || clarity?.unique_mechanism || 'My Project'

  // Where to go for the next step
  const nextStepRoute: Record<number, string> = { 1: '/module/1', 2: '/module/2', 3: '/module/3', 4: '/module/4' }
  const nextStepLabel: Record<number, string> = {
    1: 'Start Module 1 — Find Your Niche',
    2: 'Start Module 2 — Write Your E-Book',
    3: 'Start Module 3 — Build Your Sales Page',
    4: 'Start Module 4 — Write Your Email Sequence',
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      <div className="w-full max-w-[430px] md:max-w-3xl mx-auto flex flex-col min-h-screen pb-36">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="px-6 pt-8 pb-2">
          <button
            onClick={() => router.push('/my-work')}
            className="text-gray-500 hover:text-gray-300 text-sm mb-5 flex items-center gap-1"
          >
            ← My Work
          </button>
          <h1 className="text-xl font-bold text-white leading-snug">{projectName}</h1>
          {clarity?.target_market && (
            <p className="text-gray-500 text-xs mt-1">For: {clarity.target_market}</p>
          )}
        </div>

        {/* ── Journey Progress Strip ──────────────────────────────────────── */}
        <div className="px-6 pt-4 pb-5">
          <div className="flex items-start">
            {JOURNEY_STEPS.map((step, i) => (
              <div key={step.num} className="flex items-start flex-1">
                <div className="flex flex-col items-center flex-shrink-0 w-16">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                    step.done ? 'bg-yellow-400 border-yellow-400 text-black' : 'bg-gray-900 border-gray-700 text-gray-600'
                  }`}>
                    {step.done ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : step.num}
                  </div>
                  <span className={`text-[10px] mt-1.5 font-medium text-center leading-tight ${step.done ? 'text-yellow-400' : 'text-gray-600'}`}>
                    {step.label}
                  </span>
                </div>
                {i < JOURNEY_STEPS.length - 1 && (
                  <div className="flex-1 flex items-center mt-4 mx-1">
                    <div className={`h-0.5 w-full rounded-full ${
                      step.done && JOURNEY_STEPS[i + 1].done ? 'bg-yellow-400' : step.done ? 'bg-gray-700' : 'bg-gray-800'
                    }`} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── Cards ───────────────────────────────────────────────────────── */}
        <div className="px-6 space-y-4">

          {/* ── 1. Clarity ─────────────────────────────────────────────────── */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-gray-800">
              <div className="flex items-center gap-2">
                <StatusDot done={!!clarity} num={1} />
                <span className="text-white text-sm font-bold">Niche &amp; Clarity</span>
              </div>
              <button onClick={() => router.push('/module/1')} className="text-yellow-400 text-xs font-semibold">
                {clarity ? 'Edit →' : 'Start →'}
              </button>
            </div>
            {clarity ? (
              <div className="px-5 py-4">
                <p className="text-yellow-300 text-sm font-medium leading-relaxed mb-4 border-l-2 border-yellow-500 pl-3">
                  &ldquo;{clarity.full_sentence}&rdquo;
                </p>
                <div className="flex flex-wrap gap-2">
                  {([['Market', clarity.target_market], ['Problem', clarity.core_problem], ['Mechanism', clarity.unique_mechanism]] as [string, string][]).map(([label, val]) => (
                    <div key={label} className="bg-gray-800 rounded-lg px-3 py-1.5 min-w-0">
                      <p className="text-gray-500 text-[10px] uppercase tracking-wide">{label}</p>
                      <p className="text-white text-xs font-medium">{val}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <EmptyCard message="Your clarity sentence will appear here." cta="Go to Module 1" onCta={() => router.push('/module/1')} enabled />
            )}
          </div>

          {/* ── 2. E-Book ──────────────────────────────────────────────────── */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-gray-800">
              <div className="flex items-center gap-2">
                <StatusDot done={!!ebook} num={2} />
                <span className="text-white text-sm font-bold">E-Book</span>
              </div>
              <button onClick={() => router.push('/module/2')} className="text-yellow-400 text-xs font-semibold">
                {ebook ? 'Edit →' : 'Start →'}
              </button>
            </div>
            {ebook ? (
              <div className="px-5 py-4">
                <div className="mb-4">
                  <p className="text-white font-bold text-base leading-snug">{ebook.title}</p>
                  {ebook.outline?.subtitle && <p className="text-gray-400 text-xs mt-0.5 italic">{ebook.outline.subtitle}</p>}
                  <p className="text-gray-600 text-xs mt-1">{ebook.chapters?.length || 0} chapters · Saved {new Date(ebook.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                </div>
                {chapters.length > 0 && (
                  <div className="bg-gray-800/50 rounded-xl p-3">
                    <p className="text-gray-500 text-[10px] uppercase tracking-wide mb-2 font-semibold">Chapters</p>
                    <div className="space-y-1.5">
                      {visibleChapters.map(ch => (
                        <div key={ch.number} className="flex items-baseline gap-2">
                          <span className="text-yellow-500 text-[10px] font-bold w-4 flex-shrink-0">{ch.number}</span>
                          <span className="text-gray-300 text-xs leading-snug">{ch.title}</span>
                        </div>
                      ))}
                    </div>
                    {hasHiddenChapters && (
                      <button onClick={() => setShowAllChapters(v => !v)} className="mt-2.5 text-yellow-500 text-xs font-semibold flex items-center gap-1">
                        {showAllChapters ? <>Show less <span className="text-[10px]">↑</span></> : <>Show all {chapters.length} chapters <span className="text-[10px]">↓</span></>}
                      </button>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <EmptyCard message="Complete Module 1 first to write your e-book." cta="Start My E-Book →" onCta={() => router.push('/module/2')} enabled={!!clarity} />
            )}
          </div>

          {/* ── 3. Sales Page ──────────────────────────────────────────────── */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-gray-800">
              <div className="flex items-center gap-2">
                <StatusDot done={!!salesPage} num={3} />
                <span className="text-white text-sm font-bold">Sales Page</span>
              </div>
              {ebook && (
                <button onClick={() => router.push('/module/3')} className="text-yellow-400 text-xs font-semibold">
                  {salesPage ? 'Edit →' : 'Start →'}
                </button>
              )}
            </div>
            {salesPage ? (
              <div className="px-5 py-4">
                <div className="bg-gray-800/50 rounded-xl p-3 mb-3">
                  <p className="text-gray-500 text-[10px] uppercase tracking-wide mb-1 font-semibold">Headline</p>
                  <p className="text-white text-sm font-semibold leading-snug whitespace-pre-line">{salesPage.headline}</p>
                </div>
                {salesPage.hook && (
                  <div className="bg-gray-800/50 rounded-xl p-3">
                    <p className="text-gray-500 text-[10px] uppercase tracking-wide mb-1 font-semibold">Opening Hook</p>
                    <p className="text-gray-300 text-xs leading-relaxed line-clamp-3">{salesPage.hook}</p>
                  </div>
                )}
              </div>
            ) : (
              <EmptyCard
                message={ebook ? 'Turn your offer into a page that sells — section by section.' : 'Complete your e-book first to unlock this step.'}
                cta="Build My Sales Page →"
                onCta={() => router.push('/module/3')}
                enabled={!!ebook}
              />
            )}
          </div>

          {/* ── 4. Email Sequence & Launch ─────────────────────────────────── */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-gray-800">
              <div className="flex items-center gap-2">
                <StatusDot done={!!emailSeq} num={4} />
                <span className="text-white text-sm font-bold">Email Sequence &amp; Launch</span>
              </div>
              {salesPage && (
                <button onClick={() => router.push('/module/4')} className="text-yellow-400 text-xs font-semibold">
                  {emailSeq ? 'Edit →' : 'Start →'}
                </button>
              )}
            </div>
            {emailSeq ? (
              <div className="px-5 py-4">
                <p className="text-gray-400 text-sm">Your 7-day email sequence is ready.</p>
              </div>
            ) : (
              <EmptyCard
                message={salesPage ? 'Write 7 emails that warm up your audience and close the sale.' : 'Complete your sales page first to unlock this step.'}
                cta="Write My Email Sequence →"
                onCta={() => router.push('/module/4')}
                enabled={!!salesPage}
              />
            )}
          </div>

        </div>
      </div>

      {/* ── Next Step CTA — fixed bottom bar ────────────────────────────── */}
      {nextStep && !emailSeq && (
        <div
          className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] md:max-w-3xl px-4 py-4 z-30"
          style={{ background: 'linear-gradient(to top, #030712 70%, transparent)', paddingBottom: '1.5rem' }}
        >
          <div className="mb-2 text-center">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Your Next Step</p>
          </div>
          <button
            onClick={() => router.push(nextStepRoute[nextStep.num])}
            className="w-full py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
            style={{ background: '#F4B942', color: '#1A1F36' }}
          >
            {nextStepLabel[nextStep.num]}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
            </svg>
          </button>
        </div>
      )}

      {/* All steps done — no next-step bar, show bottom nav normally */}
      {emailSeq && (
        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] md:max-w-3xl bg-gray-900 border-t border-gray-800 px-2 pt-2.5 pb-6 flex justify-around items-center z-30">
          <NavBar />
        </div>
      )}
    </div>
  )
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function StatusDot({ done, num }: { done: boolean; num: number }) {
  return (
    <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${done ? 'bg-yellow-400' : 'bg-gray-800 border border-gray-700'}`}>
      {done
        ? <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
        : <span className="text-gray-500 text-[9px] font-bold">{num}</span>}
    </div>
  )
}

function EmptyCard({ message, cta, onCta, enabled }: { message: string; cta: string; onCta: () => void; enabled: boolean }) {
  return (
    <div className="px-5 py-5 text-center">
      <p className="text-gray-500 text-sm mb-4">{message}</p>
      {enabled && (
        <button onClick={onCta} className="bg-yellow-400 text-black font-bold px-5 py-2 rounded-xl text-sm">
          {cta}
        </button>
      )}
    </div>
  )
}

function NavBar() {
  return (
    <>
      <Link href="/dashboard" className="flex flex-col items-center gap-1">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
        <span className="text-[10px] font-semibold text-gray-500">Home</span>
      </Link>
      <Link href="/my-work" className="flex flex-col items-center gap-1">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#F4B942" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
        </svg>
        <span className="text-[10px] font-semibold text-yellow-400">My Work</span>
      </Link>
      <Link href="/progress" className="flex flex-col items-center gap-1">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
        </svg>
        <span className="text-[10px] font-semibold text-gray-500">Progress</span>
      </Link>
      <Link href="/profile" className="flex flex-col items-center gap-1">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
        </svg>
        <span className="text-[10px] font-semibold text-gray-500">Profile</span>
      </Link>
    </>
  )
}
