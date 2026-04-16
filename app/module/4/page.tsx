'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import ModuleReviewStatus from '@/app/components/ModuleReviewStatus'
import GoldConfetti from '@/components/GoldConfetti'
import { isModuleUnlockedForStudent, getDaysUntilUnlock } from '@/lib/modules'

// ── Types ─────────────────────────────────────────────────────────────────────

type Step = 'intro' | 'building' | 'complete'

type SectionKey =
  | 'headline'
  | 'hook'
  | 'analogy'
  | 'pain'
  | 'principle'
  | 'offer_intro'
  | 'objections'
  | 'bonuses'
  | 'price'
  | 'cta'

interface Bonus {
  bonus_name: string
  description: string
  format: string
  value_peso: number
  objection_addressed: string
}

interface OfferData {
  target_market: string
  core_problem: string
  unique_mechanism: string
  ebook_title: string
  transformation: string
  bonuses: Bonus[]
  selling_price: number
  ebook_value: number
  total_value: number
  price_justification: string
  guarantee: string
  offer_statement: string
}

interface HeadlineData {
  options: string[]
  recommended: number
  recommended_reason: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SECTIONS: { key: SectionKey; label: string; description: string }[] = [
  { key: 'headline',   label: 'Headline',    description: 'The bold title that stops the scroll' },
  { key: 'hook',       label: 'Hook',        description: 'The emotional opener that pulls readers in' },
  { key: 'analogy',    label: 'Analogy',     description: 'A relatable Filipino story or metaphor' },
  { key: 'pain',       label: 'Pain',        description: 'Agitate the problem so they feel seen' },
  { key: 'principle',  label: 'Principle',   description: 'The truth reveal that reframes everything' },
  { key: 'offer_intro',label: 'Offer Intro', description: 'Introduce your ebook as the answer' },
  { key: 'objections', label: 'Objections',  description: 'Handle their doubts with empathy' },
  { key: 'bonuses',    label: 'Bonuses',     description: 'Present the bonus stack and total value' },
  { key: 'price',      label: 'Price',       description: 'Make the price feel like an easy yes' },
  { key: 'cta',        label: 'CTA',         description: 'How to order + closing invitation' },
]

// ── Icons ─────────────────────────────────────────────────────────────────────

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

const RefreshIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10" />
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
  </svg>
)

const CopyIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
)

const EditIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
)

// ── Main Component ────────────────────────────────────────────────────────────

export default function Module4Page() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('intro')
  const [showConfetti, setShowConfetti] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Offer data loaded from Module 3
  const [offer, setOffer] = useState<OfferData | null>(null)

  // Section state
  const [currentSection, setCurrentSection] = useState(0)
  const [sectionContents, setSectionContents] = useState<Record<string, string>>({})
  const [headlineData, setHeadlineData] = useState<HeadlineData | null>(null)
  const [selectedHeadlineIndex, setSelectedHeadlineIndex] = useState<number | null>(null)
  const [generating, setGenerating] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState('')
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  // Complete step
  const [publishedUrl, setPublishedUrl] = useState('')
  const [savingComplete, setSavingComplete] = useState(false)
  const [copyAllDone, setCopyAllDone] = useState(false)

  // Lock state
  const [locked, setLocked] = useState(false)
  const [daysUntilUnlock, setDaysUntilUnlock] = useState(0)

  // Prevent double-generate
  const generatingRef = useRef(false)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // ── Load offer on mount ──────────────────────────────────────────────────
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
        const unlocked = isModuleUnlockedForStudent(
          profile.unlocked_modules,
          profile.access_level,
          profile.enrolled_at,
          4
        )
        if (!unlocked) {
          const days = profile.enrolled_at ? getDaysUntilUnlock(profile.enrolled_at, 4) : 0
          setDaysUntilUnlock(days)
          setLocked(true)
          setLoading(false)
          return
        }
      }

      const { data: offerData } = await supabase
        .from('offers')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()

      if (!offerData) { router.push('/module/3'); return }

      setOffer({
        target_market:    offerData.target_market,
        core_problem:     offerData.core_problem,
        unique_mechanism: offerData.unique_mechanism,
        ebook_title:      offerData.ebook_title,
        transformation:   offerData.transformation,
        bonuses:          offerData.bonuses || [],
        selling_price:    offerData.selling_price || 0,
        ebook_value:      offerData.ebook_value || 0,
        total_value:      offerData.total_value || 0,
        price_justification: offerData.price_justification || '',
        guarantee:        offerData.guarantee || '30-day money-back guarantee',
        offer_statement:  offerData.offer_statement || '',
      })

      // Restore existing progress from sales_pages
      const { data: spData } = await supabase
        .from('sales_pages')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()

      if (spData?.sections && typeof spData.sections === 'object') {
        setSectionContents(spData.sections as Record<string, string>)
        if (spData.published_url) setPublishedUrl(spData.published_url)
        // Restore headline data if saved
        if (spData.headline_options) {
          try {
            const hd = JSON.parse(spData.headline_options)
            setHeadlineData(hd)
          } catch { /* ignore */ }
        }
        if (spData.headline) {
          // Find which index matches the saved headline
          setSectionContents(prev => ({ ...prev, headline: spData.headline }))
        }
        // Determine which section to resume at
        const keys = SECTIONS.map(s => s.key)
        let resumeAt = 0
        for (let i = 0; i < keys.length; i++) {
          if ((spData.sections as Record<string, string>)[keys[i]]) {
            resumeAt = i + 1
          }
        }
        if (resumeAt >= SECTIONS.length) {
          setCurrentSection(SECTIONS.length - 1)
          setStep('complete')
        } else {
          setCurrentSection(Math.min(resumeAt, SECTIONS.length - 1))
          if (resumeAt > 0) setStep('building')
        }
      }

      setLoading(false)
    }
    loadData()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-generate when section changes ──────────────────────────────────
  useEffect(() => {
    if (step !== 'building' || !offer) return
    const sec = SECTIONS[currentSection]
    if (!sec) return
    // Skip if already generated
    if (sectionContents[sec.key]) return
    // Prevent double fire
    if (generatingRef.current) return
    generateSection(sec.key)
  }, [currentSection, step]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Generate a section ───────────────────────────────────────────────────
  async function generateSection(sectionKey: SectionKey) {
    if (!offer || generatingRef.current) return
    generatingRef.current = true
    setGenerating(true)
    setError('')
    setEditing(false)

    try {
      const res = await fetch('/api/generate/sales-page/section', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section: sectionKey,
          target_market: offer.target_market,
          problem:       offer.core_problem,
          mechanism:     offer.unique_mechanism,
          ebook_title:   offer.ebook_title,
          bonuses:       offer.bonuses,
          total_value:   offer.total_value,
          selling_price: offer.selling_price,
          guarantee:     offer.guarantee,
        }),
      })

      const { data, error: apiErr } = await res.json()
      if (apiErr) throw new Error(apiErr)

      if (sectionKey === 'headline') {
        // data is a JSON string
        const parsed: HeadlineData = typeof data === 'string' ? JSON.parse(data) : data
        setHeadlineData(parsed)
        setSelectedHeadlineIndex(parsed.recommended ?? 0)
      } else {
        setSectionContents(prev => ({ ...prev, [sectionKey]: data as string }))
      }
    } catch {
      setError(`Could not generate ${sectionKey} section. Please try again.`)
    } finally {
      setGenerating(false)
      generatingRef.current = false
    }
  }

  // ── Handle headline pick ─────────────────────────────────────────────────
  function confirmHeadline() {
    if (!headlineData || selectedHeadlineIndex === null) return
    const chosen = headlineData.options[selectedHeadlineIndex]
    setSectionContents(prev => ({ ...prev, headline: chosen }))
    advanceSection()
  }

  // ── Advance to next section ──────────────────────────────────────────────
  function advanceSection() {
    setEditing(false)
    setEditText('')
    if (currentSection < SECTIONS.length - 1) {
      setCurrentSection(prev => prev + 1)
    } else {
      handleComplete()
    }
  }

  // ── Save edit ────────────────────────────────────────────────────────────
  function saveEdit() {
    const key = SECTIONS[currentSection].key
    setSectionContents(prev => ({ ...prev, [key]: editText }))
    setEditing(false)
  }

  // ── Copy to clipboard ────────────────────────────────────────────────────
  function copyText(text: string, key: string) {
    navigator.clipboard.writeText(text).catch(() => {})
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 2000)
  }

  // ── Build full copy for "copy all" ───────────────────────────────────────
  function buildFullCopy(): string {
    return SECTIONS.map(s => {
      const content = sectionContents[s.key] || ''
      return `=== ${s.label.toUpperCase()} ===\n\n${content}`
    }).join('\n\n\n')
  }

  // ── Save to sales_pages + complete ───────────────────────────────────────
  async function handleComplete() {
    if (!offer) return
    setSavingComplete(true)
    setError('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const headlineChosen = sectionContents['headline'] || ''

      // Delete existing row then insert fresh (avoids needing unique constraint)
      await supabase.from('sales_pages').delete().eq('user_id', user.id)
      await supabase.from('sales_pages').insert({
        user_id:          user.id,
        headline:         headlineChosen,
        headline_options: headlineData ? JSON.stringify(headlineData) : null,
        sections:         sectionContents,
        published_url:    publishedUrl || null,
        updated_at:       new Date().toISOString(),
      })

      await supabase.from('module_progress').upsert(
        {
          user_id:      user.id,
          module_number: 4,
          status:        'complete',
          completed_at:  new Date().toISOString(),
          updated_at:    new Date().toISOString(),
        },
        { onConflict: 'user_id, module_number' }
      )

      setShowConfetti(true)
      setStep('complete')
    } catch {
      setError('Could not save. Please try again.')
    } finally {
      setSavingComplete(false)
    }
  }

  // ── Save URL on complete screen ──────────────────────────────────────────
  async function savePublishedUrl() {
    if (!publishedUrl.trim()) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('sales_pages')
      .update({ published_url: publishedUrl })
      .eq('user_id', user.id)
  }

  // ── Section progress bar (in building step) ──────────────────────────────
  function SectionProgress() {
    return (
      <div className="mb-5">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium text-gray-400">
            Section {currentSection + 1} of {SECTIONS.length}
          </span>
          <span className="text-xs font-medium" style={{ color: '#F4B942' }}>
            {SECTIONS[currentSection]?.label}
          </span>
        </div>
        <div className="w-full h-1.5 rounded-full" style={{ background: '#1f2937' }}>
          <div
            className="h-1.5 rounded-full transition-all duration-500"
            style={{
              width: `${((currentSection) / SECTIONS.length) * 100}%`,
              background: '#F4B942',
            }}
          />
        </div>
        {/* Mini section dots */}
        <div className="flex gap-1 mt-2 justify-center flex-wrap">
          {SECTIONS.map((s, i) => (
            <div
              key={s.key}
              className="w-1.5 h-1.5 rounded-full"
              style={{
                background: i < currentSection
                  ? '#10B981'
                  : i === currentSection
                  ? '#F4B942'
                  : '#374151',
              }}
            />
          ))}
        </div>
      </div>
    )
  }

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-[#F4B942] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Loading your offer data…</p>
        </div>
      </div>
    )
  }

  // ── Locked Screen ────────────────────────────────────────────────────────
  if (locked) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
        <div className="max-w-[380px] w-full text-center">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
            style={{ background: '#111827', border: '1px solid #374151' }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <h1 className="text-lg font-bold text-white mb-2">Module 4 — Not Yet Open</h1>
          <p className="text-sm text-gray-400 mb-1">The Sales Page Builder opens in</p>
          <p className="text-3xl font-black mb-1" style={{ color: '#F4B942' }}>
            {daysUntilUnlock} {daysUntilUnlock === 1 ? 'day' : 'days'}
          </p>
          <p className="text-xs text-gray-500 mb-8">
            Keep going — your offer is saved and ready.
          </p>
          <button
            onClick={() => router.push('/dashboard')}
            className="w-full py-3 rounded-xl font-bold text-sm"
            style={{ background: '#F4B942', color: '#1A1F36' }}
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  // ── Complete Screen ──────────────────────────────────────────────────────
  if (step === 'complete') {
    const allSections = SECTIONS.filter(s => sectionContents[s.key])
    return (
      <>
        <GoldConfetti trigger={showConfetti} onDone={() => setShowConfetti(false)} />
        <div className="min-h-screen bg-gray-950">
          <div className="max-w-[430px] md:max-w-3xl mx-auto px-4 pt-6 pb-32">

            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: '#F4B942' }}>
                <span className="font-bold text-[#1A1F36] text-sm">4</span>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Module 4</p>
                <h1 className="text-base font-bold text-white">The Sales Page Builder</h1>
              </div>
            </div>

            {/* Success banner */}
            <div className="rounded-xl px-4 py-4 mb-5 flex items-start gap-3" style={{ background: '#064e3b', border: '1px solid #10B981' }}>
              <div className="w-6 h-6 rounded-full flex items-center justify-center mt-0.5 flex-shrink-0" style={{ background: '#10B981' }}>
                <span className="text-white"><CheckIcon /></span>
              </div>
              <div>
                <p className="font-bold text-emerald-300">Your Sales Page Copy Is Ready!</p>
                <p className="text-sm text-emerald-300 mt-0.5">All 10 sections written. Copy them into Systeme.io or your page builder.</p>
              </div>
            </div>

            {/* Coach review status (AP students) */}
            <ModuleReviewStatus moduleNumber={4} />

            {/* Copy all */}
            <button
              onClick={() => {
                copyText(buildFullCopy(), 'all')
                setCopyAllDone(true)
                setTimeout(() => setCopyAllDone(false), 2500)
              }}
              className="w-full py-3 rounded-xl font-semibold text-sm mb-4 flex items-center justify-center gap-2"
              style={{
                background: copyAllDone ? '#065F46' : '#1f2937',
                color: copyAllDone ? '#6EE7B7' : '#F4B942',
                border: `1px solid ${copyAllDone ? '#10B981' : '#374151'}`,
              }}
            >
              <CopyIcon />
              {copyAllDone ? 'Copied All Sections!' : 'Copy All Sales Page Copy'}
            </button>

            {/* Section list */}
            <div className="space-y-3 mb-5">
              {allSections.map(s => (
                <div key={s.key} className="bg-gray-900 rounded-xl overflow-hidden" style={{ border: '1px solid #374151' }}>
                  <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid #374151' }}>
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: '#10B981' }}>
                        <span className="text-white"><CheckIcon /></span>
                      </div>
                      <span className="text-sm font-semibold text-white">{s.label}</span>
                    </div>
                    <button
                      onClick={() => copyText(sectionContents[s.key], s.key)}
                      className="flex items-center gap-1 text-xs"
                      style={{ color: copiedKey === s.key ? '#6EE7B7' : '#9CA3AF' }}
                    >
                      <CopyIcon />
                      {copiedKey === s.key ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <div className="px-4 py-3">
                    <p className="text-xs text-gray-400 leading-relaxed whitespace-pre-wrap line-clamp-3">
                      {sectionContents[s.key]}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Published URL */}
            <div className="bg-gray-900 rounded-xl p-4 mb-4" style={{ border: '1px solid #374151' }}>
              <label className="block text-sm font-semibold text-white mb-1">
                Sales Page URL <span className="text-gray-500 font-normal">(optional)</span>
              </label>
              <p className="text-xs text-gray-400 mb-3">
                Once you publish it in Systeme.io, paste the link here so Module 5 can use it.
              </p>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={publishedUrl}
                  onChange={e => setPublishedUrl(e.target.value)}
                  placeholder="https://yourpage.systeme.io/ebook"
                  className="flex-1 border rounded-xl px-3 py-2.5 text-sm bg-gray-950 text-white focus:outline-none focus:ring-2 focus:ring-yellow-400/40"
                  style={{ borderColor: '#374151' }}
                />
                <button
                  onClick={savePublishedUrl}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background: '#F4B942', color: '#1A1F36' }}
                >
                  Save
                </button>
              </div>
            </div>

            {/* Next module CTA */}
            <div className="rounded-xl p-4 mb-4" style={{ background: '#1A1F36', border: '2px solid #F4B942' }}>
              <p className="text-xs font-medium mb-1" style={{ color: '#F4B942' }}>Up Next</p>
              <p className="text-white font-bold">Module 5 — 7-Day Email Sequence</p>
              <p className="text-gray-300 text-sm mt-1">Write 7 emails that nurture readers and sell your ebook.</p>
              <button
                onClick={() => router.push('/module/5')}
                className="mt-3 w-full py-3 rounded-lg font-bold text-sm"
                style={{ background: '#F4B942', color: '#1A1F36' }}
              >
                Next: Write My Email Sequence →
              </button>
            </div>

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

  // ── Intro Screen ─────────────────────────────────────────────────────────
  if (step === 'intro') {
    return (
      <div className="min-h-screen bg-gray-950">
        <div className="max-w-[430px] md:max-w-3xl mx-auto px-4 pt-6 pb-36">

          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={() => router.push('/module/3')}
              className="w-8 h-8 flex items-center justify-center rounded-full flex-shrink-0"
              style={{ background: '#F4B942' }}
              aria-label="Go back"
            >
              <span style={{ color: '#1A1F36' }}><BackIcon /></span>
            </button>
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Module 4</p>
              <h1 className="text-base font-bold text-white">The Sales Page Builder</h1>
            </div>
          </div>

          {/* What this module does */}
          <div className="rounded-xl p-4 mb-4" style={{ background: '#1c1500', borderLeft: '4px solid #F4B942', borderTop: '1px solid #374151', borderRight: '1px solid #374151', borderBottom: '1px solid #374151' }}>
            <p className="text-sm font-semibold text-white mb-1">What you&apos;ll build</p>
            <p className="text-sm text-gray-400 leading-relaxed">
              A complete 10-section sales page in your voice — written section by section using your offer from Module 3. No blank pages, no guessing. Just review, refine, and copy into Systeme.io.
            </p>
          </div>

          {/* Section roadmap */}
          <div className="bg-gray-900 rounded-xl p-4 mb-4" style={{ border: '1px solid #374151' }}>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">The 10 sections</p>
            <div className="space-y-2">
              {SECTIONS.map((s, i) => (
                <div key={s.key} className="flex items-start gap-3">
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: '#1f2937' }}
                  >
                    <span className="text-[10px] font-bold text-gray-500">{i + 1}</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{s.label}</p>
                    <p className="text-xs text-gray-500">{s.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Offer summary from M3 */}
          {offer && (
            <div className="bg-gray-900 rounded-xl p-4 mb-4" style={{ border: '1px solid #374151' }}>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Your offer (from Module 3)</p>
              <div className="space-y-2">
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wide">Ebook</p>
                  <p className="text-sm font-semibold text-white">{offer.ebook_title}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wide">For</p>
                  <p className="text-sm text-gray-300">{offer.target_market}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wide">Price</p>
                  <p className="text-sm font-semibold text-white">₱{offer.selling_price.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wide">Guarantee</p>
                  <p className="text-sm text-gray-300">{offer.guarantee}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wide">Bonuses</p>
                  <p className="text-sm text-gray-300">{offer.bonuses.length} bonus{offer.bonuses.length !== 1 ? 'es' : ''} — total value ₱{offer.total_value.toLocaleString()}</p>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Fixed bottom CTA */}
        <div
          className="fixed bottom-0 bg-gray-900 px-4 py-4"
          style={{ borderTop: '1px solid #374151', width: '100%', maxWidth: '430px', left: '50%', transform: 'translateX(-50%)' }}
        >
          <button
            onClick={() => setStep('building')}
            className="w-full py-4 rounded-xl font-bold text-base"
            style={{ background: '#F4B942', color: '#1A1F36' }}
          >
            Start Writing My Sales Page →
          </button>
        </div>
      </div>
    )
  }

  // ── Building Screen ──────────────────────────────────────────────────────
  const sec = SECTIONS[currentSection]
  const isHeadline = sec?.key === 'headline'
  const isLastSection = currentSection === SECTIONS.length - 1
  const currentContent = sectionContents[sec?.key] || ''
  const hasContent = isHeadline ? !!headlineData : !!currentContent

  return (
    <>
      <GoldConfetti trigger={showConfetti} onDone={() => setShowConfetti(false)} />
      <div className="min-h-screen bg-gray-950">
        <div className="max-w-[430px] md:max-w-3xl mx-auto px-4 pt-6 pb-36">

          {/* Header */}
          <div className="flex items-center gap-3 mb-5">
            <button
              onClick={() => {
                if (currentSection > 0) {
                  setEditing(false)
                  setCurrentSection(prev => prev - 1)
                } else {
                  setStep('intro')
                }
              }}
              className="w-8 h-8 flex items-center justify-center rounded-full flex-shrink-0"
              style={{ background: '#F4B942' }}
              aria-label="Go back"
            >
              <span style={{ color: '#1A1F36' }}><BackIcon /></span>
            </button>
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Module 4</p>
              <h1 className="text-base font-bold text-white">The Sales Page Builder</h1>
            </div>
          </div>

          <SectionProgress />

          {error && (
            <div className="bg-red-900/40 border border-red-700 text-red-300 text-sm rounded-lg px-4 py-3 mb-4">
              {error}
              <button
                onClick={() => { setError(''); generateSection(sec.key) }}
                className="ml-2 underline text-xs"
              >
                Try again
              </button>
            </div>
          )}

          {/* Section header */}
          <div className="mb-4">
            <h2 className="text-lg font-bold text-white">{sec?.label}</h2>
            <p className="text-sm text-gray-400">{sec?.description}</p>
          </div>

          {/* ── Generating spinner ── */}
          {generating && (
            <div className="text-center py-14">
              <div className="w-12 h-12 border-4 border-[#F4B942] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-sm font-medium text-white">Writing your {sec?.label} section…</p>
              <p className="text-xs text-gray-400 mt-1">Using your offer data for context</p>
            </div>
          )}

          {/* ── Headline section ── */}
          {!generating && isHeadline && headlineData && (
            <div>
              <p className="text-xs text-gray-500 mb-3">Pick the headline that feels most like you:</p>

              {/* Recommended note */}
              <div className="rounded-lg px-3 py-2 mb-4 text-xs" style={{ background: '#1c1500', border: '1px solid #374151' }}>
                <span className="font-semibold" style={{ color: '#F4B942' }}>Recommended: </span>
                <span className="text-gray-300">{headlineData.recommended_reason}</span>
              </div>

              <div className="space-y-3 mb-4">
                {headlineData.options.map((option, i) => {
                  const lines = option.split('\n')
                  const isSelected = selectedHeadlineIndex === i
                  const isRecommended = i === headlineData.recommended
                  return (
                    <button
                      key={i}
                      onClick={() => setSelectedHeadlineIndex(i)}
                      className="w-full text-left rounded-xl p-4 transition-all"
                      style={{
                        background: isSelected ? '#1c1500' : '#111827',
                        border: `2px solid ${isSelected ? '#F4B942' : '#374151'}`,
                      }}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                            style={{ borderColor: isSelected ? '#F4B942' : '#6B7280' }}
                          >
                            {isSelected && (
                              <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#F4B942' }} />
                            )}
                          </div>
                          {isRecommended && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide" style={{ background: '#1c1500', color: '#F4B942' }}>
                              Recommended
                            </span>
                          )}
                        </div>
                        <button
                          onClick={e => { e.stopPropagation(); copyText(option, `h-${i}`) }}
                          className="text-gray-500 hover:text-gray-300 flex-shrink-0"
                        >
                          <CopyIcon />
                        </button>
                      </div>
                      <p className="text-sm font-bold text-white leading-snug">{lines[0]}</p>
                      {lines[1] && <p className="text-sm text-gray-300 mt-1 leading-snug">{lines[1]}</p>}
                    </button>
                  )
                })}
              </div>

              {/* Regenerate */}
              <button
                onClick={() => { setHeadlineData(null); generateSection('headline') }}
                className="flex items-center gap-1.5 text-sm text-gray-400 mx-auto"
              >
                <RefreshIcon />
                Generate different options
              </button>
            </div>
          )}

          {/* ── Regular section content ── */}
          {!generating && !isHeadline && currentContent && !editing && (
            <div>
              {/* Action row */}
              <div className="flex items-center gap-4 mb-3">
                <button
                  onClick={() => { generateSection(sec.key) }}
                  className="flex items-center gap-1.5 text-xs text-gray-400"
                >
                  <RefreshIcon />
                  Regenerate
                </button>
                <button
                  onClick={() => { setEditText(currentContent); setEditing(true) }}
                  className="flex items-center gap-1.5 text-xs text-gray-400"
                >
                  <EditIcon />
                  Edit
                </button>
                <button
                  onClick={() => copyText(currentContent, sec.key)}
                  className="flex items-center gap-1.5 text-xs ml-auto"
                  style={{ color: copiedKey === sec.key ? '#6EE7B7' : '#9CA3AF' }}
                >
                  <CopyIcon />
                  {copiedKey === sec.key ? 'Copied!' : 'Copy'}
                </button>
              </div>

              {/* Content */}
              <div className="bg-gray-900 rounded-xl p-4" style={{ border: '1px solid #374151' }}>
                <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{currentContent}</p>
              </div>
            </div>
          )}

          {/* ── Edit mode ── */}
          {!generating && editing && (
            <div>
              <textarea
                value={editText}
                onChange={e => setEditText(e.target.value)}
                className="w-full border rounded-xl px-3 py-3 text-sm bg-gray-950 text-white focus:outline-none focus:ring-2 focus:ring-yellow-400/40 leading-relaxed"
                style={{ borderColor: '#374151', minHeight: '240px', resize: 'vertical' }}
                autoFocus
              />
              <div className="flex gap-3 mt-3">
                <button
                  onClick={saveEdit}
                  className="flex-1 py-2.5 rounded-xl font-semibold text-sm"
                  style={{ background: '#F4B942', color: '#1A1F36' }}
                >
                  Save Edit
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="flex-1 py-2.5 rounded-xl font-semibold text-sm"
                  style={{ background: '#1f2937', color: '#9CA3AF', border: '1px solid #374151' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

        </div>

        {/* ── Fixed Bottom Bar ── */}
        {!generating && hasContent && !editing && (
          <div
            className="fixed bottom-0 bg-gray-900 px-4 py-4"
            style={{ borderTop: '1px solid #374151', width: '100%', maxWidth: '430px', left: '50%', transform: 'translateX(-50%)' }}
          >
            {isHeadline ? (
              <button
                onClick={confirmHeadline}
                disabled={selectedHeadlineIndex === null}
                className="w-full py-4 rounded-xl font-bold text-base disabled:opacity-40"
                style={{ background: '#F4B942', color: '#1A1F36' }}
              >
                Use This Headline →
              </button>
            ) : (
              <button
                onClick={advanceSection}
                disabled={savingComplete}
                className="w-full py-4 rounded-xl font-bold text-base disabled:opacity-50"
                style={{ background: '#F4B942', color: '#1A1F36' }}
              >
                {savingComplete
                  ? 'Saving…'
                  : isLastSection
                  ? 'Save & Complete Module 4 →'
                  : `Save & Write ${SECTIONS[currentSection + 1]?.label} →`}
              </button>
            )}
          </div>
        )}

        {/* Generating bottom placeholder */}
        {generating && (
          <div
            className="fixed bottom-0 bg-gray-900 px-4 py-4"
            style={{ borderTop: '1px solid #374151', width: '100%', maxWidth: '430px', left: '50%', transform: 'translateX(-50%)' }}
          >
            <div
              className="w-full py-4 rounded-xl font-bold text-base flex items-center justify-center gap-2 opacity-40"
              style={{ background: '#111827', color: '#9CA3AF', border: '1px solid #374151' }}
            >
              <div className="w-4 h-4 border-2 border-gray-500 border-t-transparent rounded-full animate-spin" />
              Writing section…
            </div>
          </div>
        )}
      </div>
    </>
  )
}
