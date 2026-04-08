'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import GoldConfetti from '@/components/GoldConfetti'

type Step = 'objections' | 'bonuses' | 'offer' | 'salespage' | 'complete'

interface Objection {
  objection: string
  underlying_fear: string
}

interface Bonus {
  bonus_name: string
  description: string
  format: string
  value_peso: number
  objection_addressed: string
  loading?: boolean
}

interface SalesPageSections {
  headline: string
  hook: string
  analogy: string
  pain: string
  principle: string
  offer_intro: string
  objections: string
  bonuses: string
  price: string
  cta: string
}

type SectionKey = keyof SalesPageSections

const COPY_SECTIONS: { key: SectionKey; label: string; desc: string }[] = [
  { key: 'headline',   label: 'Headline',         desc: '4U Formula — the bold title at the top' },
  { key: 'hook',       label: 'Hook',             desc: 'The scroll-stopper opener' },
  { key: 'analogy',    label: 'Analogy',          desc: 'A relatable Filipino story' },
  { key: 'pain',       label: 'Pain & Frustration', desc: 'Show them you understand' },
  { key: 'principle',  label: 'Truth Reveal',     desc: 'The mindset shift' },
  { key: 'offer_intro',label: 'The Offer',        desc: 'Introduce the ebook' },
  { key: 'objections', label: 'Objections',       desc: 'Handle their doubts' },
  { key: 'bonuses',    label: 'Bonuses',          desc: 'Present the value stack' },
  { key: 'price',      label: 'Price',            desc: 'Make the price a no-brainer' },
  { key: 'cta',        label: 'Call to Action',   desc: 'How to order' },
]

interface ClarityData {
  target_market: string
  core_problem: string
  unique_mechanism: string
  full_sentence: string
}

interface HeadlineOptions {
  options: string[]
  recommended: number
  recommended_reason: string
}

const STEP_LABELS = ['Objections', 'Bonuses', 'Offer', 'Sales Page']
const STEP_KEYS: Step[] = ['objections', 'bonuses', 'offer', 'salespage']

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

const EditIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
)

const StarIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
)

const GUARANTEE_OPTIONS = [
  '30-day money-back guarantee — no questions asked',
  '7-day full refund guarantee',
  '100% satisfaction guarantee or your money back',
  "Try it for 14 days — if it doesn't help, get a full refund",
]

export default function Module3Page() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('objections')
  const [showConfetti, setShowConfetti] = useState(false)
  const [clarity, setClarity] = useState<ClarityData | null>(null)
  const [ebookTitle, setEbookTitle] = useState('')
  const [clarityLoading, setClarityLoading] = useState(true)
  const [error, setError] = useState('')

  // Objections step
  const [objectionsLoading, setObjectionsLoading] = useState(false)
  const [objections, setObjections] = useState<Objection[]>([])
  const [selectedObjections, setSelectedObjections] = useState<number[]>([])

  // Bonuses step
  const [bonuses, setBonuses] = useState<Bonus[]>([])
  const [bonusesLoading, setBonusesLoading] = useState(false)
  const [ebookValuePeso, setEbookValuePeso] = useState('997')

  // Complete screen
  const [showSalesCopy, setShowSalesCopy] = useState(false)
  const [saving, setSaving] = useState(false)

  // Offer step
  const [sellingPrice, setSellingPrice] = useState('297')
  const [guarantee, setGuarantee] = useState(GUARANTEE_OPTIONS[0])
  const [customGuarantee, setCustomGuarantee] = useState(false)

  // Sales page step — section-by-section
  const [salesPage, setSalesPage] = useState<Partial<SalesPageSections>>({})
  const [editedSections, setEditedSections] = useState<Partial<SalesPageSections>>({})
  const [activeSectionIndex, setActiveSectionIndex] = useState(0)
  const [sectionGenerating, setSectionGenerating] = useState(false)
  const [editingSection, setEditingSection] = useState<SectionKey | null>(null)
  const [salesPageUrl, setSalesPageUrl] = useState('')
  const [copiedSection, setCopiedSection] = useState<string | null>(null)

  // Headline options — for the 3-card selection UI
  const [headlineOptions, setHeadlineOptions] = useState<HeadlineOptions | null>(null)
  const [selectedHeadlineIndex, setSelectedHeadlineIndex] = useState<number | null>(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // ── Load data on mount ───────────────────────────────────────
  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

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

      if (!ebookData?.title) { router.push('/module/2'); return }
      setEbookTitle(ebookData.title)

      // Restore existing offer + sales page if any
      const { data: offerData } = await supabase
        .from('offers')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (offerData) {
        setBonuses(offerData.bonuses || [])
        setSellingPrice(String(offerData.selling_price || '297'))
        setGuarantee(offerData.guarantee || GUARANTEE_OPTIONS[0])

        const { data: spData } = await supabase
          .from('sales_pages')
          .select('*')
          .eq('user_id', user.id)
          .single()

        if (spData?.full_copy) {
          const loaded: Partial<SalesPageSections> = {}
          for (const s of COPY_SECTIONS) {
            const val = spData[s.key]
            if (val) loaded[s.key] = val
          }
          setSalesPage(loaded)
          // Resume at first incomplete section
          const firstIncomplete = COPY_SECTIONS.findIndex(s => !loaded[s.key])
          setActiveSectionIndex(firstIncomplete === -1 ? COPY_SECTIONS.length - 1 : firstIncomplete)
          setSalesPageUrl(spData.published_url || '')
          setStep('salespage')
        } else {
          setStep('offer')
        }
      }

      setClarityLoading(false)
    }
    loadData()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const currentStepIndex = STEP_KEYS.indexOf(
    step === 'complete' ? 'salespage' : step
  )

  // ── Helpers ──────────────────────────────────────────────────

  function goBack() {
    const prev: Record<Step, Step | null> = {
      objections: null,
      bonuses: 'objections',
      offer: 'bonuses',
      salespage: 'offer',
      complete: 'salespage',
    }
    const prevStep = prev[step]
    if (prevStep) setStep(prevStep)
    else router.push('/dashboard')
  }

  const totalValue =
    (parseInt(ebookValuePeso) || 0) +
    bonuses.reduce((sum, b) => sum + (b.value_peso || 0), 0)

  // ── Objections ───────────────────────────────────────────────

  async function handleGenerateObjections() {
    if (!clarity) return
    setError('')
    setObjectionsLoading(true)
    try {
      const res = await fetch('/api/generate/objections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_market: clarity.target_market,
          problem: clarity.core_problem,
          mechanism: clarity.unique_mechanism,
          ebook_title: ebookTitle,
        }),
      })
      const { data, error: apiErr } = await res.json()
      if (apiErr) throw new Error(apiErr)
      setObjections(Array.isArray(data) ? data : [])
    } catch {
      setError('Could not load objections. Please try again.')
    } finally {
      setObjectionsLoading(false)
    }
  }

  function toggleObjection(index: number) {
    setSelectedObjections(prev => {
      if (prev.includes(index)) return prev.filter(i => i !== index)
      if (prev.length >= 5) return prev
      return [...prev, index]
    })
  }

  // ── Bonuses ──────────────────────────────────────────────────

  async function handleGenerateBonuses() {
    if (!clarity || selectedObjections.length === 0) return
    setError('')
    setBonusesLoading(true)
    setStep('bonuses')

    const skeleton: Bonus[] = selectedObjections.map(i => ({
      bonus_name: '',
      description: '',
      format: '',
      value_peso: 0,
      objection_addressed: objections[i].objection,
      loading: true,
    }))
    setBonuses(skeleton)

    for (let idx = 0; idx < selectedObjections.length; idx++) {
      const objIndex = selectedObjections[idx]
      try {
        const res = await fetch('/api/generate/bonus', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ebook_title: ebookTitle,
            target_market: clarity.target_market,
            problem: clarity.core_problem,
            objection: objections[objIndex].objection,
          }),
        })
        const { data, error: apiErr } = await res.json()
        if (apiErr) throw new Error(apiErr)
        setBonuses(prev => {
          const updated = [...prev]
          updated[idx] = {
            ...data,
            value_peso: 0,
            objection_addressed: objections[objIndex].objection,
            loading: false,
          }
          return updated
        })
      } catch {
        setBonuses(prev => {
          const updated = [...prev]
          updated[idx] = {
            ...updated[idx],
            bonus_name: 'Bonus Document',
            description: 'A helpful resource for your audience.',
            format: 'guide',
            loading: false,
          }
          return updated
        })
      }
    }
    setBonusesLoading(false)
  }

  function updateBonus(index: number, field: keyof Bonus, value: string | number) {
    setBonuses(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  // ── Sales Page — section-by-section ─────────────────────────

  async function handleGenerateSection(sectionKey: SectionKey) {
    if (!clarity) return
    setError('')
    setSectionGenerating(true)
    setEditingSection(null)

    // Reset headline selection state when regenerating headline
    if (sectionKey === 'headline') {
      setHeadlineOptions(null)
      setSelectedHeadlineIndex(null)
      setSalesPage(prev => { const u = { ...prev }; delete u.headline; return u })
    }

    try {
      const res = await fetch('/api/generate/sales-page/section', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section: sectionKey,
          target_market: clarity.target_market,
          problem: clarity.core_problem,
          mechanism: clarity.unique_mechanism,
          ebook_title: ebookTitle,
          bonuses: bonuses.map(b => ({
            bonus_name: b.bonus_name,
            description: b.description,
            format: b.format,
            value_peso: b.value_peso,
            objection_addressed: b.objection_addressed,
          })),
          total_value: totalValue,
          selling_price: parseInt(sellingPrice) || 297,
          guarantee,
        }),
      })
      const { data, error: apiErr } = await res.json()
      if (apiErr) throw new Error(apiErr)

      if (sectionKey === 'headline') {
        // Parse the JSON options response
        try {
          const parsed = JSON.parse(data) as HeadlineOptions
          setHeadlineOptions(parsed)
          // Don't set salesPage.headline yet — user must pick one
        } catch {
          // Fallback: treat as plain text if JSON parse fails
          setSalesPage(prev => ({ ...prev, headline: data }))
          setEditedSections(prev => { const u = { ...prev }; delete u.headline; return u })
        }
      } else {
        setSalesPage(prev => ({ ...prev, [sectionKey]: data }))
        setEditedSections(prev => { const u = { ...prev }; delete u[sectionKey]; return u })
      }
    } catch {
      setError('Could not generate this section. Please try again.')
    } finally {
      setSectionGenerating(false)
    }
  }

  function selectHeadlineOption(index: number) {
    if (!headlineOptions) return
    const chosen = headlineOptions.options[index]
    setSelectedHeadlineIndex(index)
    setSalesPage(prev => ({ ...prev, headline: chosen }))
    setEditedSections(prev => { const u = { ...prev }; delete u.headline; return u })
  }

  function getSection(key: SectionKey): string {
    return editedSections[key] ?? salesPage[key] ?? ''
  }

  function buildFullSalesPage(): string {
    return COPY_SECTIONS
      .map(s => getSection(s.key))
      .filter(Boolean)
      .join('\n\n')
  }

  const allSectionsComplete = COPY_SECTIONS.every(s => !!getSection(s.key))

  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text).catch(() => {})
    setCopiedSection(label)
    setTimeout(() => setCopiedSection(null), 2000)
  }

  // ── Mark Complete ────────────────────────────────────────────

  async function handleMarkComplete() {
    if (!clarity || !salesPage) return
    setError('')
    setSaving(true)

    const step1 = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not logged in')
      return user
    }

    const step2 = async (userId: string) => {
      await supabase.from('offers').delete().eq('user_id', userId)
      const { error } = await supabase.from('offers').insert({
        user_id: userId,
        objections: selectedObjections.map(i => objections[i]?.objection).filter(Boolean),
        bonuses,
        total_value: totalValue,
        selling_price: parseInt(sellingPrice) || 297,
        guarantee,
      })
      if (error) throw new Error(`offers insert: ${error.message} (code ${error.code})`)
    }

    const step3 = async (userId: string) => {
      const sectionData: Record<string, string> = {}
      for (const s of COPY_SECTIONS) { sectionData[s.key] = getSection(s.key) }
      const fullCopy = buildFullSalesPage()
      await supabase.from('sales_pages').delete().eq('user_id', userId)
      const { error } = await supabase.from('sales_pages').insert({
        user_id: userId,
        ...sectionData,
        full_copy: fullCopy,
        published_url: salesPageUrl || null,
      })
      if (error) throw new Error(`sales_pages insert: ${error.message} (code ${error.code})`)
    }

    const step4 = async (userId: string) => {
      const { error } = await supabase.from('module_progress').upsert(
        { user_id: userId, module_number: 3, status: 'complete',
          completed_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        { onConflict: 'user_id, module_number' }
      )
      if (error) throw new Error(`module_progress upsert: ${error.message} (code ${error.code})`)
    }

    try {
      const user = await step1()
      await step2(user.id)
      await step3(user.id)
      await step4(user.id)
      setShowConfetti(true)
      setStep('complete')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(`Could not save. Please try again. (${msg})`)
    } finally {
      setSaving(false)
    }
  }

  // ── Progress Dots Component ──────────────────────────────────

  function ProgressDots() {
    return (
      <div className="flex items-center justify-center mb-6 px-2">
        {STEP_LABELS.map((label, i) => {
          const isDone = i < currentStepIndex
          const isActive = i === currentStepIndex
          return (
            <div key={label} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center"
                  style={{ background: isDone ? '#10B981' : isActive ? '#F4B942' : '#374151' }}
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
                  className="h-0.5 w-6 mb-4 mx-1"
                  style={{ background: i < currentStepIndex ? '#10B981' : '#374151' }}
                />
              )}
            </div>
          )
        })}
      </div>
    )
  }

  // ── Loading screen ───────────────────────────────────────────

  if (clarityLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-[#F4B942] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Loading your progress…</p>
        </div>
      </div>
    )
  }

  // ── Complete Screen ──────────────────────────────────────────

  if (step === 'complete') {
    return (
      <div className="min-h-screen bg-gray-950">
        <GoldConfetti trigger={showConfetti} onDone={() => setShowConfetti(false)} />
        <div className="max-w-[430px] md:max-w-3xl mx-auto px-4 pt-6 pb-32">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: '#F4B942' }}>
              <span className="font-bold text-white text-sm">3</span>
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Module 3</p>
              <h1 className="text-base font-bold text-white">Offer &amp; Sales Page</h1>
            </div>
          </div>

          <div className="rounded-xl px-4 py-4 mb-5 flex items-start gap-3" style={{ background: '#064e3b', border: '1px solid #10B981' }}>
            <div className="w-6 h-6 rounded-full flex items-center justify-center mt-0.5 flex-shrink-0" style={{ background: '#10B981' }}>
              <span className="text-white"><CheckIcon /></span>
            </div>
            <div>
              <p className="font-bold text-emerald-300">Module 3 Complete!</p>
              <p className="text-sm text-emerald-300 mt-0.5">Your offer and sales page are saved.</p>
            </div>
          </div>

          <div className="bg-gray-900 rounded-xl p-4 mb-4" style={{ border: '1px solid #374151' }}>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Your Offer Stack</p>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-300 truncate pr-2">{ebookTitle}</span>
              <span className="text-sm font-medium text-white flex-shrink-0">₱{parseInt(ebookValuePeso).toLocaleString()}</span>
            </div>
            {bonuses.map((b, i) => (
              <div key={i} className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-300 truncate pr-2">Bonus {i + 1}: {b.bonus_name}</span>
                <span className="text-sm font-medium text-white flex-shrink-0">₱{b.value_peso.toLocaleString()}</span>
              </div>
            ))}
            <div className="border-t border-gray-800 mt-3 pt-3 flex justify-between">
              <span className="text-sm font-bold text-white">Total Value</span>
              <span className="text-sm font-bold text-white">₱{totalValue.toLocaleString()}</span>
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-sm font-bold" style={{ color: '#F4B942' }}>Your Price</span>
              <span className="text-sm font-bold" style={{ color: '#F4B942' }}>₱{parseInt(sellingPrice).toLocaleString()}</span>
            </div>
          </div>

          {/* ── Sales Copy Preview ──────────────────────────── */}
          {allSectionsComplete && (
            <div className="mb-4">
              <button
                onClick={() => setShowSalesCopy(v => !v)}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl font-semibold text-sm transition-all"
                style={{
                  background: showSalesCopy ? '#1c1500' : '#111827',
                  border: `2px solid ${showSalesCopy ? '#F4B942' : '#374151'}`,
                  color: showSalesCopy ? '#F4B942' : '#D1D5DB',
                }}
              >
                <span className="flex items-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                    <polyline points="10 9 9 9 8 9"/>
                  </svg>
                  View Your Sales Copy
                </span>
                <svg
                  width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                  style={{ transform: showSalesCopy ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
                >
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>

              {showSalesCopy && (
                <div className="mt-2 space-y-3">
                  {/* Copy All button */}
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(buildFullSalesPage()).catch(() => {})
                      setCopiedSection('all')
                      setTimeout(() => setCopiedSection(null), 2000)
                    }}
                    className="w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all"
                    style={{
                      background: copiedSection === 'all' ? '#065F46' : '#1f2937',
                      color: copiedSection === 'all' ? '#6EE7B7' : '#D1D5DB',
                      border: `1px solid ${copiedSection === 'all' ? '#10B981' : '#374151'}`,
                    }}
                  >
                    <CopyIcon />
                    {copiedSection === 'all' ? 'Copied!' : 'Copy Full Sales Page'}
                  </button>

                  {/* Individual sections */}
                  {COPY_SECTIONS.map(({ key, label }) => {
                    const text = getSection(key)
                    if (!text) return null
                    return (
                      <div key={key} className="bg-gray-900 rounded-xl p-4" style={{ border: '1px solid #374151' }}>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#F4B942' }}>{label}</p>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(text).catch(() => {})
                              setCopiedSection(key)
                              setTimeout(() => setCopiedSection(null), 2000)
                            }}
                            className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-all"
                            style={{
                              background: copiedSection === key ? '#064e3b' : '#1f2937',
                              color: copiedSection === key ? '#6EE7B7' : '#9CA3AF',
                              border: `1px solid ${copiedSection === key ? '#10B981' : '#374151'}`,
                            }}
                          >
                            <CopyIcon />
                            {copiedSection === key ? 'Copied!' : 'Copy'}
                          </button>
                        </div>
                        <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{text}</p>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          <div className="rounded-xl p-4 mb-4" style={{ background: '#1A1F36', border: '2px solid #F4B942' }}>
            <p className="text-xs font-medium mb-1" style={{ color: '#F4B942' }}>Up Next</p>
            <p className="text-white font-bold">Module 4 — 7-Day Email Sequence</p>
            <p className="text-gray-300 text-sm mt-1">Write 7 emails that warm up your audience and sell your ebook.</p>
            <button
              onClick={() => router.push('/module/4')}
              className="mt-3 w-full py-2.5 rounded-lg font-bold text-sm"
              style={{ background: '#F4B942', color: '#1A1F36' }}
            >
              Start Module 4
            </button>
          </div>

          <button
            onClick={() => router.push('/dashboard')}
            className="w-full text-center text-sm text-gray-400 underline py-2"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  // ── Main Wizard ──────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-950">
      <div className="max-w-[430px] md:max-w-3xl mx-auto px-4 pt-6 pb-36">

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <button
            onClick={goBack}
            className="w-8 h-8 flex items-center justify-center rounded-full flex-shrink-0"
            style={{ background: '#F4B942' }}
            aria-label="Go back"
          >
            <span style={{ color: '#1A1F36' }}><BackIcon /></span>
          </button>
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Module 3</p>
            <h1 className="text-base font-bold text-white">Offer &amp; Sales Page Builder</h1>
          </div>
        </div>

        <ProgressDots />

        {error && (
          <div className="bg-red-900/40 border border-red-700 text-red-300 text-sm rounded-lg px-4 py-3 mb-4">
            {error}
          </div>
        )}

        {/* ── Objections Step ────────────────────────────────── */}
        {step === 'objections' && (
          <div>
            <div className="bg-gray-900 rounded-xl p-4 mb-4" style={{ border: '1px solid #374151' }}>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Your Ebook</p>
              <p className="text-sm font-semibold text-white">{ebookTitle}</p>
              {clarity && <p className="text-xs text-gray-400 mt-0.5">For: {clarity.target_market}</p>}
            </div>

            {!objectionsLoading && objections.length === 0 && (
              <div className="text-center py-8">
                <p className="text-sm text-gray-500 mb-1">Before someone buys your ebook, they have doubts.</p>
                <p className="text-sm text-gray-500">We&apos;ll find those doubts — then build bonuses that answer them.</p>
              </div>
            )}

            {objectionsLoading && (
              <div className="text-center py-14">
                <div className="w-10 h-10 border-4 border-[#F4B942] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-sm font-medium text-white">Finding what holds your buyers back…</p>
                <p className="text-xs text-gray-400 mt-1">This takes about 10 seconds</p>
              </div>
            )}

            {!objectionsLoading && objections.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-white">Pick 3 to 5 objections</p>
                  <span
                    className="text-xs px-2 py-1 rounded-full font-medium"
                    style={{
                      background: selectedObjections.length >= 3 ? '#D1FAE5' : '#FEF3C7',
                      color: selectedObjections.length >= 3 ? '#065F46' : '#92400E',
                    }}
                  >
                    {selectedObjections.length} / 5
                  </span>
                </div>
                <div className="space-y-2">
                  {objections.map((obj, i) => {
                    const isSelected = selectedObjections.includes(i)
                    return (
                      <button
                        key={i}
                        onClick={() => toggleObjection(i)}
                        className="w-full text-left rounded-xl p-3 transition-all"
                        style={{
                          background: isSelected ? '#1c1500' : '#111827',
                          border: `2px solid ${isSelected ? '#F4B942' : '#374151'}`,
                        }}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 mt-0.5"
                            style={{
                              background: isSelected ? '#F4B942' : '#1f2937',
                              border: `2px solid ${isSelected ? '#F4B942' : '#4b5563'}`,
                            }}
                          >
                            {isSelected && <span className="text-white"><CheckIcon /></span>}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-white">{obj.objection}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{obj.underlying_fear}</p>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Bonuses Step ───────────────────────────────────── */}
        {step === 'bonuses' && (
          <div>
            <p className="text-sm text-gray-500 mb-4">
              Each bonus answers one of your buyer&apos;s doubts. Set a peso value for each — this builds your offer stack.
            </p>

            {/* Ebook value input */}
            <div className="bg-gray-900 rounded-xl p-4 mb-4" style={{ border: '1px solid #374151' }}>
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0 pr-3">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Main Ebook</p>
                  <p className="text-sm font-semibold text-white truncate">{ebookTitle}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <span className="text-sm text-gray-500">₱</span>
                  <input
                    type="number"
                    value={ebookValuePeso}
                    onChange={e => setEbookValuePeso(e.target.value)}
                    className="w-20 text-right border rounded-lg px-2 py-1.5 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-yellow-400/40"
                    style={{ borderColor: '#374151' }}
                    placeholder="997"
                  />
                </div>
              </div>
            </div>

            {/* Bonus cards */}
            <div className="space-y-4 mb-4">
              {bonuses.map((bonus, i) => (
                <div key={i} className="bg-gray-900 rounded-xl p-4" style={{ border: '1px solid #374151' }}>
                  {bonus.loading ? (
                    <div className="flex items-center gap-3 py-2">
                      <div className="w-5 h-5 border-2 border-[#F4B942] border-t-transparent rounded-full animate-spin flex-shrink-0" />
                      <p className="text-sm text-gray-400 truncate">
                        Creating bonus for: &ldquo;{bonus.objection_addressed.substring(0, 45)}…&rdquo;
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#F4B942' }}>
                          Bonus {i + 1} &middot; {bonus.format}
                        </p>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <span className="text-sm text-gray-500">₱</span>
                          <input
                            type="number"
                            value={bonus.value_peso || ''}
                            onChange={e => updateBonus(i, 'value_peso', parseInt(e.target.value) || 0)}
                            className="w-20 text-right border rounded-lg px-2 py-1.5 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-yellow-400/40"
                            style={{ borderColor: '#374151' }}
                            placeholder="0"
                          />
                        </div>
                      </div>
                      <input
                        type="text"
                        value={bonus.bonus_name}
                        onChange={e => updateBonus(i, 'bonus_name', e.target.value)}
                        className="w-full text-sm font-semibold text-white border-b border-dashed pb-1 mb-2 focus:outline-none bg-transparent"
                        style={{ borderColor: '#4B5563' }}
                      />
                      <p className="text-xs text-gray-500 mb-2">{bonus.description}</p>
                      <p className="text-xs text-gray-300 italic truncate">
                        Answers: &ldquo;{bonus.objection_addressed.substring(0, 55)}…&rdquo;
                      </p>
                    </>
                  )}
                </div>
              ))}
            </div>

            {/* Running total */}
            {!bonusesLoading && (
              <div className="rounded-xl p-4 text-center" style={{ background: '#1A1F36' }}>
                <p className="text-xs text-gray-400 mb-1">Total Perceived Value</p>
                <p className="text-2xl font-bold text-white">₱{totalValue.toLocaleString()}</p>
              </div>
            )}
          </div>
        )}

        {/* ── Offer Stack Step ───────────────────────────────── */}
        {step === 'offer' && (
          <div>
            <p className="text-sm text-gray-500 mb-4">
              Set your selling price. The bigger the gap between total value and your price, the more irresistible your offer.
            </p>

            {/* Offer summary */}
            <div className="bg-gray-900 rounded-xl p-4 mb-4" style={{ border: '1px solid #374151' }}>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Offer Summary</p>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-300 truncate pr-2">{ebookTitle}</span>
                <span className="text-sm font-medium text-white flex-shrink-0">₱{parseInt(ebookValuePeso).toLocaleString()}</span>
              </div>
              {bonuses.map((b, i) => (
                <div key={i} className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-300 truncate pr-2">Bonus {i + 1}: {b.bonus_name}</span>
                  <span className="text-sm font-medium text-white flex-shrink-0">₱{b.value_peso.toLocaleString()}</span>
                </div>
              ))}
              <div className="border-t border-gray-800 mt-3 pt-3 flex justify-between">
                <span className="text-sm font-bold text-white">Total Value</span>
                <span className="text-sm font-bold text-white">₱{totalValue.toLocaleString()}</span>
              </div>
            </div>

            {/* Selling price */}
            <div className="bg-gray-900 rounded-xl p-4 mb-4" style={{ border: '1px solid #374151' }}>
              <label className="block text-sm font-semibold text-white mb-2">Your Selling Price (₱)</label>
              <div className="flex items-center gap-2">
                <span className="text-lg text-gray-400 font-medium">₱</span>
                <input
                  type="number"
                  value={sellingPrice}
                  onChange={e => setSellingPrice(e.target.value)}
                  className="flex-1 border rounded-xl px-4 py-3 text-xl font-bold text-white focus:outline-none focus:ring-2 focus:ring-yellow-400/40"
                  style={{ borderColor: '#374151' }}
                  placeholder="297"
                />
              </div>
              {parseInt(sellingPrice) > 0 && totalValue > 0 && (
                <p className="text-xs mt-2 font-medium leading-relaxed" style={{ color: '#F4B942' }}>
                  &ldquo;Total value: ₱{totalValue.toLocaleString()} — yours today for only ₱{parseInt(sellingPrice).toLocaleString()}&rdquo;
                </p>
              )}
            </div>

            {/* Guarantee */}
            <div className="bg-gray-900 rounded-xl p-4 mb-4" style={{ border: '1px solid #374151' }}>
              <label className="block text-sm font-semibold text-white mb-3">Your Guarantee</label>
              <div className="space-y-2 mb-3">
                {GUARANTEE_OPTIONS.map(opt => (
                  <button
                    key={opt}
                    onClick={() => { setGuarantee(opt); setCustomGuarantee(false) }}
                    className="w-full text-left rounded-lg px-3 py-2.5 text-sm transition-all"
                    style={{
                      background: guarantee === opt && !customGuarantee ? '#FFFBEB' : 'white',
                      border: `1.5px solid ${guarantee === opt && !customGuarantee ? '#F4B942' : '#E5E7EB'}`,
                      color: '#374151',
                    }}
                  >
                    {opt}
                  </button>
                ))}
                <button
                  onClick={() => { setCustomGuarantee(true); setGuarantee('') }}
                  className="w-full text-left rounded-lg px-3 py-2.5 text-sm transition-all"
                  style={{
                    background: customGuarantee ? '#FFFBEB' : 'white',
                    border: `1.5px solid ${customGuarantee ? '#F4B942' : '#E5E7EB'}`,
                    color: '#374151',
                  }}
                >
                  Write my own guarantee…
                </button>
              </div>
              {customGuarantee && (
                <textarea
                  value={guarantee}
                  onChange={e => setGuarantee(e.target.value)}
                  rows={3}
                  className="w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400/40"
                  style={{ borderColor: '#F4B942' }}
                  placeholder="Describe your guarantee here…"
                />
              )}
            </div>
          </div>
        )}

        {/* ── Sales Page Step — section by section ──────────── */}
        {step === 'salespage' && (
          <div>
            {/* Section progress checklist */}
            <div className="bg-gray-900 rounded-xl p-4 mb-4" style={{ border: '1px solid #374151' }}>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                Your Sales Copy — {COPY_SECTIONS.filter(s => !!getSection(s.key)).length} of {COPY_SECTIONS.length} sections done
              </p>
              <div className="space-y-1.5">
                {COPY_SECTIONS.map((s, i) => {
                  const isDone = !!getSection(s.key)
                  const isActive = i === activeSectionIndex
                  return (
                    <button
                      key={s.key}
                      onClick={() => { setActiveSectionIndex(i); setEditingSection(null) }}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-all"
                      style={{
                        background: isActive ? '#1c1500' : 'transparent',
                        border: `1px solid ${isActive ? '#F4B942' : 'transparent'}`,
                      }}
                    >
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ background: isDone ? '#10B981' : isActive ? '#F4B942' : '#374151' }}
                      >
                        {isDone
                          ? <span className="text-white"><CheckIcon /></span>
                          : <span className="text-xs font-bold" style={{ color: isActive ? '#1A1F36' : '#9CA3AF' }}>{i + 1}</span>
                        }
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium" style={{ color: isDone ? '#10B981' : isActive ? '#F4B942' : '#D1D5DB' }}>
                          {s.label}
                        </p>
                        <p className="text-xs text-gray-500 truncate">{s.desc}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Active section workspace */}
            {(() => {
              const current = COPY_SECTIONS[activeSectionIndex]
              const text = getSection(current.key)
              return (
                <div className="bg-gray-900 rounded-xl p-4 mb-4" style={{ border: `2px solid #F4B942` }}>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                        Section {activeSectionIndex + 1} of {COPY_SECTIONS.length}
                      </p>
                      <p className="text-base font-bold text-white">{current.label}</p>
                      <p className="text-xs text-gray-500">{current.desc}</p>
                    </div>
                    {text && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setEditingSection(editingSection === current.key ? null : current.key)}
                          className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg"
                          style={{ background: '#1f2937', color: '#9CA3AF', border: '1px solid #374151' }}
                        >
                          <EditIcon />
                          {editingSection === current.key ? 'Done' : 'Edit'}
                        </button>
                        <button
                          onClick={() => copyToClipboard(text, current.key)}
                          className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg"
                          style={{
                            background: copiedSection === current.key ? '#064e3b' : '#1f2937',
                            color: copiedSection === current.key ? '#6EE7B7' : '#9CA3AF',
                            border: `1px solid ${copiedSection === current.key ? '#10B981' : '#374151'}`,
                          }}
                        >
                          <CopyIcon />
                          {copiedSection === current.key ? 'Copied!' : 'Copy'}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Content area */}
                  {sectionGenerating ? (
                    <div className="text-center py-10">
                      <div className="w-10 h-10 border-4 border-[#F4B942] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                      <p className="text-sm font-medium text-white">Writing {current.label}…</p>
                      <p className="text-xs text-gray-400 mt-1">About 10–15 seconds</p>
                    </div>
                  ) : current.key === 'headline' && headlineOptions ? (
                    /* ── Headline: 3-card selection UI ── */
                    <div>
                      <p className="text-xs text-gray-400 mb-3">Tap the headline you want to use.</p>
                      <div className="space-y-3">
                        {headlineOptions.options.map((option, idx) => {
                          const isRecommended = idx === headlineOptions.recommended
                          const isSelected = idx === selectedHeadlineIndex
                          const [line1, line2] = option.split('\n')
                          return (
                            <button
                              key={idx}
                              onClick={() => selectHeadlineOption(idx)}
                              className="w-full text-left rounded-xl p-4 transition-all"
                              style={{
                                background: isSelected ? '#1c1500' : isRecommended ? '#111827' : '#0f172a',
                                border: `2px solid ${isSelected ? '#F4B942' : isRecommended ? '#4B5563' : '#1f2937'}`,
                              }}
                            >
                              {/* Badges row */}
                              <div className="flex items-center gap-2 mb-2">
                                {isRecommended && (
                                  <span
                                    className="flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full"
                                    style={{ background: '#F4B942', color: '#1A1F36' }}
                                  >
                                    <StarIcon /> Best Pick
                                  </span>
                                )}
                                {isSelected && (
                                  <span
                                    className="flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full"
                                    style={{ background: '#10B981', color: 'white' }}
                                  >
                                    <CheckIcon /> Selected
                                  </span>
                                )}
                                {!isRecommended && !isSelected && (
                                  <span className="text-xs text-gray-500">Option {idx + 1}</span>
                                )}
                              </div>

                              {/* Headline text */}
                              <p className="text-sm font-bold leading-snug" style={{ color: isSelected ? '#F4B942' : '#F3F4F6' }}>
                                {line1}
                              </p>
                              {line2 && (
                                <p className="text-xs mt-1 leading-relaxed" style={{ color: isSelected ? '#FDE68A' : '#9CA3AF' }}>
                                  {line2}
                                </p>
                              )}

                              {/* Recommended reason — only on recommended card */}
                              {isRecommended && (
                                <p className="text-xs mt-2 italic" style={{ color: '#9CA3AF' }}>
                                  {headlineOptions.recommended_reason}
                                </p>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ) : text ? (
                    editingSection === current.key ? (
                      <textarea
                        value={getSection(current.key)}
                        onChange={e => setEditedSections(prev => ({ ...prev, [current.key]: e.target.value }))}
                        rows={8}
                        className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400/40 bg-gray-950 text-white"
                        style={{ borderColor: '#F4B942' }}
                      />
                    ) : (
                      <p className="text-sm text-white leading-relaxed whitespace-pre-wrap">{text}</p>
                    )
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-sm text-gray-500 mb-1">Ready to write the {current.label}.</p>
                      <p className="text-xs text-gray-600">{current.desc}</p>
                    </div>
                  )}

                  {/* Action buttons */}
                  {!sectionGenerating && (
                    <div className="mt-4 flex gap-2">
                      {/* Headline: options shown but none selected yet */}
                      {current.key === 'headline' && headlineOptions && !text ? (
                        <button
                          onClick={() => handleGenerateSection(current.key)}
                          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold"
                          style={{ background: '#1f2937', color: '#9CA3AF', border: '1px solid #374151' }}
                        >
                          <RefreshIcon /> Try New Options
                        </button>
                      ) : !text ? (
                        <button
                          onClick={() => handleGenerateSection(current.key)}
                          className="flex-1 py-3 rounded-xl font-bold text-sm"
                          style={{ background: '#F4B942', color: '#1A1F36' }}
                        >
                          Generate {current.label}
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => handleGenerateSection(current.key)}
                            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold"
                            style={{ background: '#1f2937', color: '#9CA3AF', border: '1px solid #374151' }}
                          >
                            <RefreshIcon /> Redo
                          </button>
                          {activeSectionIndex < COPY_SECTIONS.length - 1 ? (
                            <button
                              onClick={() => { setActiveSectionIndex(i => i + 1); setEditingSection(null) }}
                              className="flex-1 py-2.5 rounded-xl font-bold text-sm"
                              style={{ background: '#F4B942', color: '#1A1F36' }}
                            >
                              Next: {COPY_SECTIONS[activeSectionIndex + 1].label} →
                            </button>
                          ) : (
                            <button
                              onClick={() => setActiveSectionIndex(0)}
                              className="flex-1 py-2.5 rounded-xl font-bold text-sm"
                              style={{ background: '#10B981', color: 'white' }}
                            >
                              All done! Review from top
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              )
            })()}

            {/* Systeme.io URL — only shown when all sections complete */}
            {allSectionsComplete && (
              <div className="bg-gray-900 rounded-xl p-4 mb-4" style={{ border: '1px solid #374151' }}>
                <label className="block text-sm font-semibold text-white mb-1">
                  Your Systeme.io Sales Page URL
                  <span className="text-gray-400 font-normal ml-1">(optional)</span>
                </label>
                <p className="text-xs text-gray-400 mb-2">
                  Paste this after publishing. We&apos;ll use it in your email sequence.
                </p>
                <input
                  type="url"
                  value={salesPageUrl}
                  onChange={e => setSalesPageUrl(e.target.value)}
                  className="w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400/40 bg-gray-950 text-white"
                  style={{ borderColor: '#374151' }}
                  placeholder="https://yourpage.systeme.io/ebook"
                />
              </div>
            )}
          </div>
        )}

      </div>

      {/* ── Fixed Bottom Action Bar ──────────────────────────── */}
      {step !== 'complete' && (
        <div
          className="fixed bottom-0 bg-gray-900 px-4 py-4"
          style={{
            borderTop: '1px solid #E5E7EB',
            width: '100%',
            maxWidth: '430px',
            left: '50%',
            transform: 'translateX(-50%)',
          }}
        >
          {/* Objections — before generating */}
          {step === 'objections' && objections.length === 0 && (
            <button
              onClick={handleGenerateObjections}
              disabled={objectionsLoading}
              className="w-full py-4 rounded-xl font-bold text-base disabled:opacity-60 transition-all"
              style={{ background: '#1A1F36', color: '#F4B942' }}
            >
              {objectionsLoading ? 'Finding Objections…' : "Find My Buyers' Objections"}
            </button>
          )}

          {/* Objections — after generating */}
          {step === 'objections' && objections.length > 0 && (
            <button
              onClick={handleGenerateBonuses}
              disabled={selectedObjections.length < 3}
              className="w-full py-4 rounded-xl font-bold text-base disabled:opacity-40 transition-all"
              style={{
                background: selectedObjections.length >= 3 ? '#F4B942' : '#E5E7EB',
                color: '#1A1F36',
              }}
            >
              {selectedObjections.length < 3
                ? `Select ${3 - selectedObjections.length} more to continue`
                : 'Build My Bonuses Around These'}
            </button>
          )}

          {/* Bonuses */}
          {step === 'bonuses' && (
            <button
              onClick={() => {
                const allValued = bonuses.every(b => !b.loading && b.value_peso > 0)
                if (!allValued) { setError('Please set a value (₱) for each bonus.'); return }
                setError('')
                setStep('offer')
              }}
              disabled={bonusesLoading || bonuses.some(b => b.loading)}
              className="w-full py-4 rounded-xl font-bold text-base disabled:opacity-60 transition-all"
              style={{ background: '#F4B942', color: '#1A1F36' }}
            >
              {bonuses.some(b => b.loading) ? 'Creating Your Bonuses…' : 'Build My Offer Stack'}
            </button>
          )}

          {/* Offer */}
          {step === 'offer' && (
            <button
              onClick={() => { setStep('salespage'); setActiveSectionIndex(0) }}
              disabled={!sellingPrice || parseInt(sellingPrice) <= 0}
              className="w-full py-4 rounded-xl font-bold text-base disabled:opacity-40 transition-all"
              style={{ background: '#F4B942', color: '#1A1F36' }}
            >
              Write My Sales Copy →
            </button>
          )}

          {/* Sales page — save button only when all sections done */}
          {step === 'salespage' && allSectionsComplete && (
            <button
              onClick={handleMarkComplete}
              disabled={saving}
              className="w-full py-4 rounded-xl font-bold text-base transition-all flex items-center justify-center gap-2 disabled:opacity-70"
              style={{ background: '#F4B942', color: '#1A1F36' }}
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-[#1A1F36] border-t-transparent rounded-full animate-spin" />
                  Saving…
                </>
              ) : 'Save & Complete Module 3'}
            </button>
          )}

          {/* Sales page — progress indicator while writing */}
          {step === 'salespage' && !allSectionsComplete && (
            <div className="w-full py-3 rounded-xl text-center text-sm font-medium text-gray-400"
              style={{ background: '#111827', border: '1px solid #374151' }}
            >
              {COPY_SECTIONS.filter(s => !!getSection(s.key)).length} of {COPY_SECTIONS.length} sections written
            </div>
          )}
        </div>
      )}
    </div>
  )
}
