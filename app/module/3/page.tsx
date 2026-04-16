'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import ModuleReviewStatus from '@/app/components/ModuleReviewStatus'
import GoldConfetti from '@/components/GoldConfetti'
import { isModuleUnlockedForStudent, getDaysUntilUnlock } from '@/lib/modules'

// ── Types ─────────────────────────────────────────────────────────────────────

type Step = 'foundation' | 'transformation' | 'objections' | 'bonuses' | 'price_anchor' | 'guarantee' | 'offer_statement' | 'complete'

interface ClarityData {
  target_market: string
  core_problem: string
  unique_mechanism: string
  full_sentence: string
}

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

// ── Constants ─────────────────────────────────────────────────────────────────

const STEP_LABELS = ['Foundation', 'Transformation', 'Objections', 'Bonuses', 'Price', 'Guarantee', 'Offer']
const STEP_KEYS: Step[] = ['foundation', 'transformation', 'objections', 'bonuses', 'price_anchor', 'guarantee', 'offer_statement']

const GUARANTEE_OPTIONS = [
  '30-day money-back guarantee — no questions asked',
  '7-day full refund guarantee',
  '100% satisfaction guarantee or your money back',
  'Try it for 14 days — if it doesn\'t help, get a full refund',
]

const TEXT_FORMATS = ['PDF Checklist', 'Worksheet', 'Template', 'Cheat Sheet', 'Swipe File', 'Script', 'Mini-Guide', 'Action Guide']

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
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
)

// ── Main Component ────────────────────────────────────────────────────────────

export default function Module3Page() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('foundation')
  const [showConfetti, setShowConfetti] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Foundation
  const [clarity, setClarity] = useState<ClarityData | null>(null)
  const [ebookTitle, setEbookTitle] = useState('')

  // Transformation
  const [studentInput, setStudentInput] = useState('')
  const [transformation, setTransformation] = useState('')
  const [transformationLoading, setTransformationLoading] = useState(false)
  const [editingTransformation, setEditingTransformation] = useState(false)

  // Objections
  const [objections, setObjections] = useState<Objection[]>([])
  const [objectionsLoading, setObjectionsLoading] = useState(false)
  const [selectedObjections, setSelectedObjections] = useState<number[]>([])

  // Bonuses
  const [bonuses, setBonuses] = useState<Bonus[]>([])
  const [bonusesLoading, setBonusesLoading] = useState(false)

  // Price Anchor
  const [ebookValuePeso, setEbookValuePeso] = useState('997')
  const [sellingPrice, setSellingPrice] = useState('297')
  const [priceJustification, setPriceJustification] = useState('')
  const [priceJustLoading, setPriceJustLoading] = useState(false)

  // Guarantee
  const [guarantee, setGuarantee] = useState(GUARANTEE_OPTIONS[0])
  const [customGuarantee, setCustomGuarantee] = useState(false)

  // Offer Statement
  const [offerStatement, setOfferStatement] = useState('')
  const [offerLoading, setOfferLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  // Module 4 lock state (shown on complete screen)
  const [module4Unlocked, setModule4Unlocked] = useState(false)
  const [module4DaysLeft, setModule4DaysLeft] = useState(0)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // ── Load data ─────────────────────────────────────────────────────────────

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
        .eq('status', 'complete')
        .order('created_at', { ascending: false })
        .limit(1)

      if (ebookData && ebookData.length > 0) {
        setEbookTitle(ebookData[0].title || '')
      }

      // Load profile for Module 4 unlock check
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
        setModule4Unlocked(unlocked)
        if (!unlocked && profile.enrolled_at) {
          setModule4DaysLeft(getDaysUntilUnlock(profile.enrolled_at, 4))
        }
      }

      // Resume from saved offer if exists
      const { data: offerData } = await supabase
        .from('offers')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)

      if (offerData && offerData.length > 0) {
        const o = offerData[0]
        if (o.offer_statement) {
          setTransformation(o.transformation || '')
          setSellingPrice(String(o.selling_price || '297'))
          setEbookValuePeso(String(o.ebook_value || '997'))
          setGuarantee(o.guarantee || GUARANTEE_OPTIONS[0])
          setOfferStatement(o.offer_statement || '')
          if (o.bonuses) setBonuses(o.bonuses)
          setStep('complete')
        }
      }

      setLoading(false)
    }
    loadData()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Stepper ────────────────────────────────────────────────────────────────

  const currentStepIndex = STEP_KEYS.indexOf(step === 'complete' ? 'offer_statement' : step)

  function goBack() {
    const prev: Partial<Record<Step, Step>> = {
      transformation: 'foundation',
      objections: 'transformation',
      bonuses: 'objections',
      price_anchor: 'bonuses',
      guarantee: 'price_anchor',
      offer_statement: 'guarantee',
    }
    const prevStep = prev[step]
    if (prevStep) setStep(prevStep)
    else router.push('/dashboard')
  }

  // ── Transformation ─────────────────────────────────────────────────────────

  async function handleGenerateTransformation(extraInput = '') {
    if (!clarity) return
    setError('')
    setTransformationLoading(true)
    setEditingTransformation(false)
    try {
      const res = await fetch('/api/generate/offer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'transformation',
          target_market: clarity.target_market,
          problem: clarity.core_problem,
          mechanism: clarity.unique_mechanism,
          ebook_title: ebookTitle,
          student_input: extraInput,
        }),
      })
      const { data, error: apiErr } = await res.json()
      if (apiErr) throw new Error(apiErr)
      setTransformation(data.statement || '')
      setEditingTransformation(false)
    } catch {
      setError('Could not generate transformation statement. Please try again.')
    } finally {
      setTransformationLoading(false)
    }
  }

  // ── Objections ─────────────────────────────────────────────────────────────

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

  // ── Bonuses ────────────────────────────────────────────────────────────────

  async function handleGenerateBonuses() {
    if (!clarity || selectedObjections.length === 0) return
    setError('')
    setBonusesLoading(true)
    setStep('bonuses')

    const skeleton: Bonus[] = selectedObjections.map(i => ({
      bonus_name: '',
      description: '',
      format: '',
      value_peso: 497,
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
        const { data } = await res.json()
        setBonuses(prev => prev.map((b, i) =>
          i === idx ? { ...data, value_peso: 497, objection_addressed: objections[objIndex].objection, loading: false } : b
        ))
      } catch {
        setBonuses(prev => prev.map((b, i) =>
          i === idx ? { ...b, bonus_name: 'Bonus', description: 'Could not generate. Please edit.', format: 'PDF Checklist', loading: false } : b
        ))
      }
    }
    setBonusesLoading(false)
  }

  async function regenerateBonus(idx: number) {
    if (!clarity) return
    const objText = bonuses[idx].objection_addressed
    setBonuses(prev => prev.map((b, i) => i === idx ? { ...b, loading: true } : b))
    try {
      const res = await fetch('/api/generate/bonus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ebook_title: ebookTitle,
          target_market: clarity.target_market,
          problem: clarity.core_problem,
          objection: objText,
        }),
      })
      const { data } = await res.json()
      setBonuses(prev => prev.map((b, i) =>
        i === idx ? { ...data, value_peso: b.value_peso || 497, objection_addressed: objText, loading: false } : b
      ))
    } catch {
      setBonuses(prev => prev.map((b, i) => i === idx ? { ...b, loading: false } : b))
    }
  }

  // ── Price Anchor ───────────────────────────────────────────────────────────

  const totalValue = (parseInt(ebookValuePeso) || 0) + bonuses.reduce((sum, b) => sum + (b.value_peso || 0), 0)

  async function handleGeneratePriceJustification() {
    if (!clarity || !sellingPrice) return
    setPriceJustLoading(true)
    setError('')
    try {
      const res = await fetch('/api/generate/offer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'price_anchor',
          target_market: clarity.target_market,
          ebook_title: ebookTitle,
          transformation,
          selling_price: sellingPrice,
          total_value: totalValue,
        }),
      })
      const { data, error: apiErr } = await res.json()
      if (apiErr) throw new Error(apiErr)
      setPriceJustification(data.justification || '')
    } catch {
      setError('Could not generate price justification. Please try again.')
    } finally {
      setPriceJustLoading(false)
    }
  }

  // ── Offer Statement ────────────────────────────────────────────────────────

  async function handleGenerateOfferStatement() {
    if (!clarity) return
    setOfferLoading(true)
    setError('')
    try {
      const res = await fetch('/api/generate/offer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'offer_statement',
          target_market: clarity.target_market,
          problem: clarity.core_problem,
          ebook_title: ebookTitle,
          transformation,
          bonuses,
          selling_price: sellingPrice,
          total_value: totalValue,
          guarantee,
        }),
      })
      const { data, error: apiErr } = await res.json()
      if (apiErr) throw new Error(apiErr)
      setOfferStatement(data.offer_statement || '')
    } catch {
      setError('Could not generate offer statement. Please try again.')
    } finally {
      setOfferLoading(false)
    }
  }

  async function handleSaveOffer() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !clarity) return

    setError('')
    try {
      // Delete existing offer first (avoids needing unique constraint)
      await supabase.from('offers').delete().eq('user_id', user.id)

      const { error: insertErr } = await supabase.from('offers').insert({
        user_id: user.id,
        target_market: clarity.target_market,
        core_problem: clarity.core_problem,
        unique_mechanism: clarity.unique_mechanism,
        ebook_title: ebookTitle,
        transformation,
        bonuses,
        selling_price: parseInt(sellingPrice) || 0,
        ebook_value: parseInt(ebookValuePeso) || 0,
        total_value: totalValue,
        price_justification: priceJustification,
        guarantee,
        offer_statement: offerStatement,
        updated_at: new Date().toISOString(),
      })

      if (insertErr) throw insertErr

      setShowConfetti(true)
      setTimeout(() => setShowConfetti(false), 3500)
      setStep('complete')
    } catch (e) {
      console.error('Save offer error:', e)
      setError('Could not save your offer. Please try again.')
    }
  }

  // ── Shared UI ──────────────────────────────────────────────────────────────

  const inputClass = "w-full bg-gray-950 text-white text-sm px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F4B942]"
  const labelClass = "block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1.5"

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#F4B942] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // ── Complete Screen ────────────────────────────────────────────────────────

  if (step === 'complete') {
    return (
      <div className="min-h-screen bg-gray-950 max-w-[430px] md:max-w-3xl mx-auto flex flex-col">
        {showConfetti && <GoldConfetti />}
        <div className="px-4 pt-6 pb-10 flex-1">
          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-full bg-[#F4B942] flex items-center justify-center mx-auto mb-4">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1A1F36" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h1 className="text-white text-xl font-bold mb-2">Your Offer is Built!</h1>
            <p className="text-gray-400 text-sm">Your irresistible offer is saved and ready to power your sales page.</p>
          </div>

          {/* Coach review status (AP students) */}
          <ModuleReviewStatus moduleNumber={3} />

          <div className="bg-gray-900 rounded-2xl p-4 mb-4" style={{ border: '1px solid #374151' }}>
            <p className="text-[10px] font-bold text-[#F4B942] uppercase tracking-wide mb-3">Your Irresistible Offer Statement</p>
            <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-line">{offerStatement}</p>
            <button
              onClick={() => {
                navigator.clipboard.writeText(offerStatement)
                setCopied(true)
                setTimeout(() => setCopied(false), 2000)
              }}
              className="flex items-center gap-2 mt-4 text-xs font-semibold text-[#F4B942]"
            >
              <CopyIcon />
              {copied ? 'Copied!' : 'Copy Offer Statement'}
            </button>
          </div>

          <div className="bg-gray-900 rounded-2xl p-4 mb-6" style={{ border: '1px solid #374151' }}>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-3">Offer Summary</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Ebook</span>
                <span className="text-white font-semibold">₱{parseInt(ebookValuePeso).toLocaleString()}</span>
              </div>
              {bonuses.map((b, i) => (
                <div key={i} className="flex justify-between">
                  <span className="text-gray-400 truncate pr-2">{b.bonus_name}</span>
                  <span className="text-white font-semibold flex-shrink-0">₱{b.value_peso.toLocaleString()}</span>
                </div>
              ))}
              <div className="border-t border-gray-800 pt-2 flex justify-between">
                <span className="text-gray-400">Total Value</span>
                <span className="text-gray-400">₱{totalValue.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#F4B942] font-bold">Your Price</span>
                <span className="text-[#F4B942] font-bold text-base">₱{parseInt(sellingPrice).toLocaleString()}</span>
              </div>
            </div>
          </div>

          {module4Unlocked ? (
            <button
              onClick={() => router.push('/module/4')}
              className="w-full py-4 rounded-xl font-bold text-sm mb-3"
              style={{ background: '#F4B942', color: '#1A1F36' }}
            >
              Next: Write My Sales Page →
            </button>
          ) : (
            <div
              className="w-full py-4 rounded-xl text-sm mb-3 flex flex-col items-center gap-1"
              style={{ background: '#111827', border: '1px solid #374151' }}
            >
              <div className="flex items-center gap-2 text-gray-400 font-semibold">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                Module 4 — Write My Sales Page
              </div>
              <p className="text-xs text-gray-500">
                {module4DaysLeft > 0 ? `Opens in ${module4DaysLeft} day${module4DaysLeft !== 1 ? 's' : ''}` : 'Coming soon'}
              </p>
            </div>
          )}
          <button
            onClick={() => router.push('/dashboard')}
            className="w-full py-3 rounded-xl font-semibold text-sm text-gray-400 mb-2"
            style={{ background: '#111827', border: '1px solid #374151' }}
          >
            Back to Dashboard
          </button>
          <button
            onClick={() => { setStep('offer_statement'); setOfferStatement('') }}
            className="w-full py-2 text-xs text-gray-600 font-semibold"
          >
            Rebuild My Offer
          </button>
        </div>
      </div>
    )
  }

  // ── Main Layout ────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-950 max-w-[430px] md:max-w-3xl mx-auto flex flex-col">

      {/* Header */}
      <div className="px-4 pt-5 pb-3 flex items-center gap-3 border-b border-gray-800">
        <button onClick={goBack} className="text-gray-400 hover:text-white transition-colors">
          <BackIcon />
        </button>
        <div className="flex-1">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Module 3</p>
          <h1 className="text-white font-bold text-base leading-tight">Irresistible Offer Builder</h1>
        </div>
      </div>

      {/* Stepper */}
      <div className="px-4 py-3 border-b border-gray-800">
        <div className="flex items-center gap-1">
          {STEP_LABELS.map((label, i) => {
            const isActive = i === currentStepIndex
            const isDone = i < currentStepIndex
            return (
              <div key={i} className="flex items-center gap-1 flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0"
                    style={{
                      background: isDone ? '#F4B942' : isActive ? '#1A1F36' : '#1f2937',
                      border: isDone ? 'none' : isActive ? '2px solid #F4B942' : '2px solid #374151',
                      color: isDone ? '#1A1F36' : isActive ? '#F4B942' : '#6b7280',
                    }}
                  >
                    {isDone ? '✓' : i + 1}
                  </div>
                  <span className={`text-[8px] mt-0.5 font-semibold ${isActive ? 'text-[#F4B942]' : isDone ? 'text-gray-400' : 'text-gray-600'}`}>
                    {label}
                  </span>
                </div>
                {i < STEP_LABELS.length - 1 && (
                  <div className="h-px flex-1 mb-3" style={{ background: isDone ? '#F4B942' : '#374151' }} />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 mt-3 text-red-400 text-xs rounded-xl px-4 py-3" style={{ background: '#1a0000', border: '1px solid #7f1d1d' }}>
          {error}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 px-4 pt-4 pb-36 overflow-y-auto">

        {/* ── STEP 1: FOUNDATION ─────────────────────────────────────────── */}
        {step === 'foundation' && (
          <div className="space-y-4">
            <div>
              <p className="text-white font-bold text-lg mb-1">Let&apos;s build your offer.</p>
              <p className="text-gray-400 text-sm">Here&apos;s what we know about you so far. Confirm these details before we start.</p>
            </div>

            <div className="bg-gray-900 rounded-2xl p-4" style={{ border: '1px solid #374151' }}>
              <p className={labelClass}>Your Ebook</p>
              <p className="text-white text-sm font-semibold">{ebookTitle || 'No completed ebook found'}</p>
            </div>

            <div className="bg-gray-900 rounded-2xl p-4" style={{ border: '1px solid #374151' }}>
              <p className={labelClass}>Your Target Market</p>
              <p className="text-white text-sm">{clarity?.target_market}</p>
            </div>

            <div className="bg-gray-900 rounded-2xl p-4" style={{ border: '1px solid #374151' }}>
              <p className={labelClass}>Problem You Solve</p>
              <p className="text-white text-sm">{clarity?.core_problem}</p>
            </div>

            <div className="bg-gray-900 rounded-2xl p-4" style={{ border: '1px solid #374151' }}>
              <p className={labelClass}>Your Unique Approach</p>
              <p className="text-white text-sm">{clarity?.unique_mechanism}</p>
            </div>

            <div className="rounded-xl px-4 py-3" style={{ background: '#1c1500', border: '1px solid #F4B942' }}>
              <p className="text-[#F4B942] text-xs font-semibold">
                If anything looks wrong, go back to Module 1 or 2 to update it first.
              </p>
            </div>
          </div>
        )}

        {/* ── STEP 2: TRANSFORMATION ──────────────────────────────────────── */}
        {step === 'transformation' && (
          <div className="space-y-4">
            <div>
              <p className="text-white font-bold text-lg mb-1">What result do they get?</p>
              <p className="text-gray-400 text-sm">Based on your ebook and clarity sentence, here&apos;s the transformation your buyer gets. Edit it if needed.</p>
            </div>

            {transformationLoading && (
              <div className="text-center py-14">
                <div className="w-10 h-10 border-4 border-[#F4B942] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-sm font-medium text-white">Writing your transformation statement…</p>
              </div>
            )}

            {!transformationLoading && transformation && !editingTransformation && (
              <div className="bg-gray-900 rounded-2xl p-4" style={{ border: '1px solid #F4B942' }}>
                <p className="text-[10px] font-bold text-[#F4B942] uppercase tracking-wide mb-2">Your Transformation Statement</p>
                <p className="text-white text-sm leading-relaxed">{transformation}</p>
                <div className="flex items-center gap-3 mt-3">
                  <button
                    onClick={() => handleGenerateTransformation()}
                    className="flex items-center gap-1.5 text-xs text-gray-400 font-semibold"
                  >
                    <RefreshIcon /> Regenerate
                  </button>
                  <button
                    onClick={() => { setStudentInput(transformation); setEditingTransformation(true) }}
                    className="flex items-center gap-1.5 text-xs text-gray-400 font-semibold"
                  >
                    ✏️ Edit manually
                  </button>
                </div>
              </div>
            )}

            {!transformationLoading && editingTransformation && (
              <div className="space-y-3">
                <div>
                  <label className={labelClass}>Edit your transformation statement</label>
                  <textarea
                    value={studentInput}
                    onChange={e => setStudentInput(e.target.value)}
                    rows={4}
                    className={`${inputClass} resize-none`}
                    style={{ border: '1px solid #374151' }}
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleGenerateTransformation(studentInput)}
                    className="flex-1 py-3 rounded-xl font-semibold text-sm"
                    style={{ background: '#1A1F36', color: '#F4B942', border: '1px solid #F4B942' }}
                  >
                    Refine with AI
                  </button>
                  <button
                    onClick={() => { setTransformation(studentInput); setEditingTransformation(false) }}
                    className="flex-1 py-3 rounded-xl font-semibold text-sm"
                    style={{ background: '#374151', color: '#fff' }}
                  >
                    Use as written
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── STEP 3: OBJECTIONS ──────────────────────────────────────────── */}
        {step === 'objections' && (
          <div className="space-y-4">
            <div>
              <p className="text-white font-bold text-lg mb-1">What holds them back?</p>
              <p className="text-gray-400 text-sm">These are doubts your buyer has about <span className="text-white font-semibold">themselves</span> — not about you. Things like &ldquo;I&apos;ve tried this before and it didn&apos;t work&rdquo; or &ldquo;What if this doesn&apos;t apply to my situation?&rdquo; Pick 3 to 5 to answer with your bonuses.</p>
            </div>

            {!objectionsLoading && objections.length === 0 && (
              <div className="text-center py-8 text-gray-500 text-sm">
                Tap below to find the real objections your buyers have.
              </div>
            )}

            {objectionsLoading && (
              <div className="text-center py-14">
                <div className="w-10 h-10 border-4 border-[#F4B942] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-sm font-medium text-white">Finding what holds your buyers back…</p>
                <p className="text-xs text-gray-400 mt-1">About 10 seconds</p>
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
                            {isSelected && <span className="text-[#1A1F36]"><CheckIcon /></span>}
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

        {/* ── STEP 4: BONUSES ─────────────────────────────────────────────── */}
        {step === 'bonuses' && (
          <div>
            <p className="text-white font-bold text-lg mb-1">Build your bonus stack.</p>
            <p className="text-gray-400 text-sm mb-4">Each bonus answers one of your buyer&apos;s doubts. All formats are text-based documents — no audio or video.</p>

            <div className="space-y-4">
              {bonuses.map((bonus, i) => (
                <div key={i} className="bg-gray-900 rounded-2xl p-4" style={{ border: '1px solid #374151' }}>
                  {bonus.loading ? (
                    <div className="flex items-center gap-3 py-2">
                      <div className="w-5 h-5 border-2 border-[#F4B942] border-t-transparent rounded-full animate-spin flex-shrink-0" />
                      <p className="text-gray-400 text-xs">Creating bonus for: &ldquo;{bonus.objection_addressed.substring(0, 50)}…&rdquo;</p>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex-1">
                          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-0.5">Answers</p>
                          <p className="text-[11px] text-gray-400 italic">&ldquo;{bonus.objection_addressed}&rdquo;</p>
                        </div>
                        <button
                          onClick={() => regenerateBonus(i)}
                          className="flex items-center gap-1 text-[10px] font-semibold text-gray-500 hover:text-[#F4B942] flex-shrink-0 mt-1"
                        >
                          <RefreshIcon /> Redo
                        </button>
                      </div>

                      <div className="mb-3">
                        <label className={labelClass}>Bonus Name</label>
                        <input
                          type="text"
                          value={bonus.bonus_name}
                          onChange={e => setBonuses(prev => prev.map((b, idx) => idx === i ? { ...b, bonus_name: e.target.value } : b))}
                          className={inputClass}
                          style={{ border: '1px solid #374151' }}
                        />
                      </div>

                      <div className="mb-3">
                        <label className={labelClass}>Description</label>
                        <input
                          type="text"
                          value={bonus.description}
                          onChange={e => setBonuses(prev => prev.map((b, idx) => idx === i ? { ...b, description: e.target.value } : b))}
                          className={inputClass}
                          style={{ border: '1px solid #374151' }}
                        />
                      </div>

                      <div className="flex gap-3">
                        <div className="flex-1">
                          <label className={labelClass}>Format</label>
                          <select
                            value={bonus.format}
                            onChange={e => setBonuses(prev => prev.map((b, idx) => idx === i ? { ...b, format: e.target.value } : b))}
                            className={inputClass}
                            style={{ border: '1px solid #374151' }}
                          >
                            {TEXT_FORMATS.map(f => <option key={f} value={f}>{f}</option>)}
                          </select>
                        </div>
                        <div className="w-28">
                          <label className={labelClass}>Value (₱)</label>
                          <input
                            type="number"
                            value={bonus.value_peso || ''}
                            onChange={e => setBonuses(prev => prev.map((b, idx) => idx === i ? { ...b, value_peso: parseInt(e.target.value) || 0 } : b))}
                            placeholder="497"
                            className={inputClass}
                            style={{ border: '1px solid #374151' }}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── STEP 5: PRICE ANCHOR ────────────────────────────────────────── */}
        {step === 'price_anchor' && (
          <div className="space-y-4">
            <div>
              <p className="text-white font-bold text-lg mb-1">Price your offer.</p>
              <p className="text-gray-400 text-sm">Set the perceived value of everything included and your selling price. Then let AI write the justification.</p>
            </div>

            <div className="bg-gray-900 rounded-2xl p-4" style={{ border: '1px solid #374151' }}>
              <p className={labelClass}>Value of Your Ebook (₱)</p>
              <input
                type="number"
                value={ebookValuePeso}
                onChange={e => setEbookValuePeso(e.target.value)}
                className={inputClass}
                style={{ border: '1px solid #374151' }}
              />
              <p className="text-gray-500 text-[11px] mt-1.5">What would this knowledge normally cost someone to learn on their own?</p>
            </div>

            <div className="bg-gray-900 rounded-2xl p-4" style={{ border: '1px solid #374151' }}>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-3">Bonus Values</p>
              {bonuses.map((b, i) => (
                <div key={i} className="flex justify-between items-center mb-2 last:mb-0">
                  <span className="text-gray-400 text-sm truncate pr-2">{b.bonus_name}</span>
                  <span className="text-white text-sm font-semibold flex-shrink-0">₱{b.value_peso.toLocaleString()}</span>
                </div>
              ))}
              <div className="border-t border-gray-800 mt-3 pt-3 flex justify-between">
                <span className="text-gray-400 text-sm font-semibold">Total Value</span>
                <span className="text-[#F4B942] font-bold">₱{totalValue.toLocaleString()}</span>
              </div>
            </div>

            <div className="bg-gray-900 rounded-2xl p-4" style={{ border: '1px solid #374151' }}>
              <p className={labelClass}>Your Selling Price (₱)</p>
              <input
                type="number"
                value={sellingPrice}
                onChange={e => setSellingPrice(e.target.value)}
                className={inputClass}
                style={{ border: '1px solid #374151' }}
              />
            </div>

            {!priceJustification && !priceJustLoading && (
              <button
                onClick={handleGeneratePriceJustification}
                disabled={!sellingPrice || parseInt(sellingPrice) <= 0}
                className="w-full py-3 rounded-xl font-semibold text-sm transition-all disabled:opacity-40"
                style={{ background: '#1A1F36', color: '#F4B942', border: '1px solid #F4B942' }}
              >
                Generate Price Justification
              </button>
            )}

            {priceJustLoading && (
              <div className="text-center py-4">
                <div className="w-6 h-6 border-2 border-[#F4B942] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-xs text-gray-400">Writing your price justification…</p>
              </div>
            )}

            {priceJustification && (
              <div className="bg-gray-900 rounded-2xl p-4" style={{ border: '1px solid #F4B942' }}>
                <p className="text-[10px] font-bold text-[#F4B942] uppercase tracking-wide mb-2">Price Justification</p>
                <p className="text-white text-sm leading-relaxed">{priceJustification}</p>
                <button
                  onClick={() => { setPriceJustification(''); handleGeneratePriceJustification() }}
                  className="flex items-center gap-1.5 mt-3 text-xs text-gray-400 font-semibold"
                >
                  <RefreshIcon /> Regenerate
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── STEP 6: GUARANTEE ───────────────────────────────────────────── */}
        {step === 'guarantee' && (
          <div className="space-y-4">
            <div>
              <p className="text-white font-bold text-lg mb-1">Remove their risk.</p>
              <p className="text-gray-400 text-sm">A guarantee tells your buyer: &ldquo;I believe in this so much, I&apos;m taking the risk for you.&rdquo; Pick one or write your own.</p>
            </div>

            <div className="space-y-2">
              {GUARANTEE_OPTIONS.map((g, i) => {
                const isSelected = !customGuarantee && guarantee === g
                return (
                  <button
                    key={i}
                    onClick={() => { setGuarantee(g); setCustomGuarantee(false) }}
                    className="w-full text-left rounded-xl p-3 transition-all"
                    style={{
                      background: isSelected ? '#1c1500' : '#111827',
                      border: `2px solid ${isSelected ? '#F4B942' : '#374151'}`,
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{
                          background: isSelected ? '#F4B942' : '#1f2937',
                          border: `2px solid ${isSelected ? '#F4B942' : '#4b5563'}`,
                        }}
                      >
                        {isSelected && <div className="w-2 h-2 rounded-full bg-[#1A1F36]" />}
                      </div>
                      <p className="text-sm text-white">{g}</p>
                    </div>
                  </button>
                )
              })}

              <button
                onClick={() => setCustomGuarantee(true)}
                className="w-full text-left rounded-xl p-3 transition-all"
                style={{
                  background: customGuarantee ? '#1c1500' : '#111827',
                  border: `2px solid ${customGuarantee ? '#F4B942' : '#374151'}`,
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{
                      background: customGuarantee ? '#F4B942' : '#1f2937',
                      border: `2px solid ${customGuarantee ? '#F4B942' : '#4b5563'}`,
                    }}
                  >
                    {customGuarantee && <div className="w-2 h-2 rounded-full bg-[#1A1F36]" />}
                  </div>
                  <p className="text-sm text-white">Write my own guarantee</p>
                </div>
              </button>
            </div>

            {customGuarantee && (
              <div>
                <label className={labelClass}>Your Guarantee</label>
                <textarea
                  value={guarantee}
                  onChange={e => setGuarantee(e.target.value)}
                  rows={3}
                  className={`${inputClass} resize-none`}
                  style={{ border: '1px solid #374151' }}
                  placeholder="e.g. If you don't get value from this in 30 days, email me and I'll give you a full refund."
                />
              </div>
            )}
          </div>
        )}

        {/* ── STEP 7: OFFER STATEMENT ──────────────────────────────────────── */}
        {step === 'offer_statement' && (
          <div className="space-y-4">
            <div>
              <p className="text-white font-bold text-lg mb-1">Your Irresistible Offer.</p>
              <p className="text-gray-400 text-sm">We&apos;ll now put everything together into one clear, compelling offer statement you can be proud of.</p>
            </div>

            {!offerStatement && !offerLoading && (
              <div className="bg-gray-900 rounded-2xl p-4 space-y-2" style={{ border: '1px solid #374151' }}>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-3">What&apos;s going in</p>
                <p className="text-sm text-gray-300"><span className="text-gray-500">Ebook:</span> {ebookTitle}</p>
                <p className="text-sm text-gray-300"><span className="text-gray-500">For:</span> {clarity?.target_market}</p>
                <p className="text-sm text-gray-300"><span className="text-gray-500">Transformation:</span> {transformation}</p>
                <p className="text-sm text-gray-300"><span className="text-gray-500">Bonuses:</span> {bonuses.length} included</p>
                <p className="text-sm text-gray-300"><span className="text-gray-500">Price:</span> ₱{parseInt(sellingPrice).toLocaleString()} (worth ₱{totalValue.toLocaleString()})</p>
                <p className="text-sm text-gray-300"><span className="text-gray-500">Guarantee:</span> {guarantee}</p>
              </div>
            )}

            {offerLoading && (
              <div className="text-center py-14">
                <div className="w-10 h-10 border-4 border-[#F4B942] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-sm font-medium text-white">Building your irresistible offer…</p>
                <p className="text-xs text-gray-400 mt-1">This takes about 10 seconds</p>
              </div>
            )}

            {offerStatement && !offerLoading && (
              <div className="bg-gray-900 rounded-2xl p-4" style={{ border: '1px solid #F4B942' }}>
                <p className="text-[10px] font-bold text-[#F4B942] uppercase tracking-wide mb-3">Your Irresistible Offer Statement</p>
                <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-line">{offerStatement}</p>
                <button
                  onClick={() => { setOfferStatement(''); handleGenerateOfferStatement() }}
                  className="flex items-center gap-1.5 mt-4 text-xs text-gray-400 font-semibold"
                >
                  <RefreshIcon /> Regenerate
                </button>
              </div>
            )}
          </div>
        )}

      </div>

      {/* ── Bottom CTA ────────────────────────────────────────────────────── */}
      <div
        className="fixed bottom-0 w-full px-4 py-4 bg-gray-950 border-t border-gray-800"
        style={{ maxWidth: '430px', left: '50%', transform: 'translateX(-50%)' }}
      >
        {/* Foundation */}
        {step === 'foundation' && (
          <button
            onClick={() => { setStep('transformation'); handleGenerateTransformation() }}
            className="w-full py-4 rounded-xl font-bold text-base"
            style={{ background: '#F4B942', color: '#1A1F36' }}
          >
            Yes, this looks right →
          </button>
        )}

        {/* Transformation */}
        {step === 'transformation' && transformation && !editingTransformation && !transformationLoading && (
          <button
            onClick={() => setStep('objections')}
            className="w-full py-4 rounded-xl font-bold text-base"
            style={{ background: '#F4B942', color: '#1A1F36' }}
          >
            This is it — Next →
          </button>
        )}

        {/* Objections — before generating */}
        {step === 'objections' && objections.length === 0 && (
          <button
            onClick={handleGenerateObjections}
            disabled={objectionsLoading}
            className="w-full py-4 rounded-xl font-bold text-base disabled:opacity-60"
            style={{ background: '#1A1F36', color: '#F4B942', border: '1px solid #F4B942' }}
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
              : 'Build My Bonuses →'}
          </button>
        )}

        {/* Bonuses */}
        {step === 'bonuses' && (
          <button
            onClick={() => {
              setError('')
              setStep('price_anchor')
            }}
            disabled={bonusesLoading || bonuses.some(b => b.loading)}
            className="w-full py-4 rounded-xl font-bold text-base disabled:opacity-60 transition-all"
            style={{ background: '#F4B942', color: '#1A1F36' }}
          >
            {bonuses.some(b => b.loading) ? 'Creating Bonuses…' : 'Set My Pricing →'}
          </button>
        )}

        {/* Price Anchor */}
        {step === 'price_anchor' && (
          <button
            onClick={() => {
              if (!sellingPrice || parseInt(sellingPrice) <= 0) { setError('Please enter a selling price.'); return }
              setError('')
              setStep('guarantee')
            }}
            disabled={!sellingPrice || parseInt(sellingPrice) <= 0}
            className="w-full py-4 rounded-xl font-bold text-base disabled:opacity-40 transition-all"
            style={{ background: '#F4B942', color: '#1A1F36' }}
          >
            Set My Guarantee →
          </button>
        )}

        {/* Guarantee */}
        {step === 'guarantee' && (
          <button
            onClick={() => {
              if (!guarantee.trim()) { setError('Please select or write a guarantee.'); return }
              setError('')
              setStep('offer_statement')
              setTimeout(handleGenerateOfferStatement, 100)
            }}
            disabled={!guarantee.trim()}
            className="w-full py-4 rounded-xl font-bold text-base disabled:opacity-40 transition-all"
            style={{ background: '#F4B942', color: '#1A1F36' }}
          >
            Build My Offer Statement →
          </button>
        )}

        {/* Offer Statement */}
        {step === 'offer_statement' && offerStatement && (
          <button
            onClick={handleSaveOffer}
            className="w-full py-4 rounded-xl font-bold text-base"
            style={{ background: '#F4B942', color: '#1A1F36' }}
          >
            Save My Offer ✓
          </button>
        )}

        {step === 'offer_statement' && !offerStatement && !offerLoading && (
          <button
            onClick={handleGenerateOfferStatement}
            className="w-full py-4 rounded-xl font-bold text-base"
            style={{ background: '#1A1F36', color: '#F4B942', border: '1px solid #F4B942' }}
          >
            Generate My Offer Statement
          </button>
        )}
      </div>
    </div>
  )
}
