'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import ModuleReviewStatus from '@/app/components/ModuleReviewStatus'
import GoldConfetti from '@/components/GoldConfetti'

type Step = 'warning' | 'market' | 'problem' | 'solution' | 'validate' | 'complete'

interface Problem {
  rank: number
  problem: string
  urgency?: string
  proof_of_demand?: string
  willingness_to_pay?: 'Low' | 'Medium' | 'High'
  ease_of_selling?: 'Easy' | 'Moderate' | 'Hard'
  common_phrases?: string
  insight?: string // legacy fallback
}

interface Mechanism {
  name: string
  old_way_fails?: string
  new_belief?: string
  core_idea?: string
  steps?: string[]
  aha_statements?: string[]
  positioning_line?: string
  // legacy fallbacks
  common_mistake?: string
  why_it_works?: string
  analogy?: string
  description?: string
}

interface Validation {
  problem_validation: string
  market_size: string
  buying_behavior: string
  existing_solutions: string[]
  price_range: string
  urgency_score: number
  market_demand_score: number
  red_flags: string
  recommendation: 'GO' | 'REFINE'
  recommendation_reason: string
  refinement_suggestion: string
}

const FILIPINO_MARKETS = [
  'OFW wives and families',
  'Burned-out corporate employees',
  'Stay-at-home moms',
  'Freelancers and virtual assistants',
  'Small business owners (sari-sari, online shop)',
  'Teachers and educators',
  'BPO workers',
  'Overseas Filipino workers (OFW)',
  'Senior citizens and retirees',
]

const STEP_LABELS = ['Market', 'Problem', 'Solution', 'Clarity']
const STEP_KEYS: Step[] = ['market', 'problem', 'solution', 'validate']

// ── Sub-messages per loading context ─────────────────────────────────────────
const SUB_MESSAGES: Record<string, string[]> = {
  'Finding the biggest problems for your market…': [
    'Looking for problems people will actually pay to fix…',
    'Filtering out ideas your tita would say "nice lang"…',
    'Finding where people are already spending money…',
    'Avoiding "passion projects" na walang buyers…',
    'Locking in problems that hurt… (and pay)',
  ],
  'Coming up with unique solution names for you…': [
    'Turning your idea into something that doesn\'t sound like a thesis title…',
    'Making it sound like a system… not a random thought…',
    'Avoiding names like "Ultimate Guide 101"…',
    'Crafting something people can actually remember…',
    'Adding a bit of "wow, parang legit ah…"',
  ],
  'Analyzing your idea against the Philippine market…': [
    'Checking if this works sa Philippine market…',
    'Making sure it fits local income levels…',
    'Matching real buyer behavior…',
    'Removing ideas na mahirap ibenta sa tropa mo pa lang…',
    'Konting kembot na lang…',
  ],
}

function PremiumLoader({ message }: { message: string }) {
  const subs = SUB_MESSAGES[message] || ['Working on it…', 'Almost there…', 'Just a moment…']
  const [subIndex, setSubIndex] = useState(0)
  const [fadeIn, setFadeIn] = useState(true)

  useEffect(() => {
    const interval = setInterval(() => {
      setFadeIn(false)
      setTimeout(() => {
        setSubIndex(i => (i + 1) % subs.length)
        setFadeIn(true)
      }, 300)
    }, 2200)
    return () => clearInterval(interval)
  }, [subs.length])

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col items-center justify-center px-6">

      {/* Animated K logo */}
      <div className="mb-10 relative flex items-center justify-center">
        {/* Outer pulse ring */}
        <div
          className="absolute w-24 h-24 rounded-full"
          style={{
            background: 'rgba(244,185,66,0.12)',
            animation: 'kPulse 2s ease-in-out infinite',
          }}
        />
        {/* Inner ring */}
        <div
          className="absolute w-16 h-16 rounded-full"
          style={{
            background: 'rgba(244,185,66,0.18)',
            animation: 'kPulse 2s ease-in-out infinite',
            animationDelay: '0.3s',
          }}
        />
        {/* K badge */}
        <div
          className="relative w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{
            background: '#1A1F36',
            boxShadow: '0 8px 24px rgba(244,185,66,0.35)',
            animation: 'kFloat 3s ease-in-out infinite',
          }}
        >
          <img src="/Klaro_K-icon.png" alt="K" className="w-9 h-9 object-contain" />
        </div>
      </div>

      {/* Main message */}
      <p className="text-[#1A1F36] font-bold text-center text-lg leading-snug mb-3 max-w-xs">
        {message}
      </p>

      {/* Cycling sub-message */}
      <p
        className="text-[#6B7280] text-sm text-center max-w-xs"
        style={{
          opacity: fadeIn ? 1 : 0,
          transition: 'opacity 0.3s ease',
        }}
      >
        {subs[subIndex]}
      </p>

      {/* Soft progress bar */}
      <div className="mt-10 w-48 h-0.5 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-[#F4B942] rounded-full"
          style={{ animation: 'premiumProgress 2.5s ease-in-out infinite' }}
        />
      </div>

      {/* Keyframe injection */}
      <style>{`
        @keyframes kPulse {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50%       { transform: scale(1.15); opacity: 1; }
        }
        @keyframes kFloat {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-6px); }
        }
        @keyframes premiumProgress {
          0%   { width: 0%; margin-left: 0%; }
          50%  { width: 60%; margin-left: 20%; }
          100% { width: 0%; margin-left: 100%; }
        }
      `}</style>
    </div>
  )
}

export default function Module1Page() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('market')
  const [showConfetti, setShowConfetti] = useState(false)
  const [targetMarket, setTargetMarket] = useState('')
  const [showIdeas, setShowIdeas] = useState(false)
  const [problems, setProblems] = useState<Problem[]>([])
  const [selectedProblem, setSelectedProblem] = useState<Problem | null>(null)
  const [currentSolution, setCurrentSolution] = useState('')
  const [mechanisms, setMechanisms] = useState<Mechanism[]>([])
  const [selectedMechanism, setSelectedMechanism] = useState<Mechanism | null>(null)
  const [expandedMechanismIndex, setExpandedMechanismIndex] = useState<number | null>(null)
  const [validation, setValidation] = useState<Validation | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingMessage, setLoadingMessage] = useState('')
  const [copied, setCopied] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [existingClarity, setExistingClarity] = useState<{ target_market: string; core_problem: string; unique_mechanism: string; full_sentence: string } | null>(null)
  const [module2Started, setModule2Started] = useState(false)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // ── On mount: check for existing work or resume mode ─────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const isResume = params.get('resume') === 'true'

    async function checkExisting() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data } = await supabase
        .from('clarity_sentences')
        .select('target_market, core_problem, unique_mechanism, full_sentence')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      // Check if Module 2 has been started — if so, lock the reset button
      const { data: mod2Progress } = await supabase
        .from('module_progress')
        .select('id')
        .eq('user_id', user.id)
        .eq('module_number', 2)
        .maybeSingle()
      if (mod2Progress) setModule2Started(true)

      if (data) {
        if (isResume) {
          // Resume mode — skip wizard, go straight to complete
          setTargetMarket(data.target_market)
          setSelectedProblem({ rank: 1, problem: data.core_problem })
          setSelectedMechanism({ name: data.unique_mechanism })
          setClaritySentence(data.full_sentence || `I help ${data.target_market} who struggle with ${data.core_problem} through ${data.unique_mechanism}.`)
          setStep('complete')
        } else {
          // Fresh visit but existing work found — show warning first
          setExistingClarity(data)
          setStep('warning')
        }
      }
      // No existing work — stay on 'market' step (default)
    }
    checkExisting()
  }, [])

  const currentStepIndex = STEP_KEYS.indexOf(step)
  const [claritySentence, setClaritySentence] = useState('')
  const [polishingClarity, setPolishingClarity] = useState(false)

  async function handleMarketNext() {
    if (!targetMarket.trim()) return
    setError('')
    setLoading(true)
    setLoadingMessage('Finding the biggest problems for your market…')
    try {
      const res = await fetch('/api/generate/clarity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_market: targetMarket.trim(), step: 'problems' }),
      })
      const json = await res.json()
      if (!res.ok) {
        // Show the specific message from the API (e.g. excluded market warning)
        throw new Error(json.message || json.error || 'Something went wrong.')
      }
      const { data } = json
      // data may be an array or an object wrapping an array — extract defensively
      const problems = Array.isArray(data)
        ? data
        : Array.isArray(Object.values(data || {}).find(v => Array.isArray(v)))
          ? (Object.values(data).find(v => Array.isArray(v)) as Problem[])
          : []
      setProblems(problems)
      setSelectedProblem(null)
      setStep('problem')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleProblemNext() {
    if (!selectedProblem) return
    setError('')
    setLoading(true)
    setLoadingMessage('Coming up with unique solution names for you…')
    try {
      const res = await fetch('/api/generate/clarity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_market: targetMarket.trim(),
          problem: selectedProblem.problem,
          current_solution: currentSolution.trim(),
          step: 'mechanisms',
        }),
      })
      const { data, error: apiErr } = await res.json()
      if (apiErr) throw new Error(apiErr)
      // data may be an array or an object wrapping an array — extract defensively
      const mechanisms = Array.isArray(data)
        ? data
        : Array.isArray(Object.values(data || {}).find(v => Array.isArray(v)))
          ? (Object.values(data).find(v => Array.isArray(v)) as Mechanism[])
          : []
      setMechanisms(mechanisms)
      setSelectedMechanism(null)
      setStep('solution')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleValidate() {
    if (!selectedMechanism) return
    setError('')
    setLoading(true)
    setLoadingMessage('Analyzing your idea against the Philippine market…')
    try {
      // Run validation + polish in parallel
      const [validateRes, polishRes] = await Promise.all([
        fetch('/api/generate/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            target_market: targetMarket.trim(),
            problem: selectedProblem?.problem,
            mechanism: selectedMechanism.name,
          }),
        }),
        fetch('/api/generate/clarity', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            target_market: targetMarket.trim(),
            step: 'polish',
            problem: selectedProblem?.problem,
            current_solution: selectedMechanism.name,
          }),
        }),
      ])
      const { data, error: apiErr } = await validateRes.json()
      if (apiErr) throw new Error(apiErr)
      const polished = await polishRes.json()
      // Use polished sentence if available, fall back to raw format
      setClaritySentence(
        polished.sentence ||
        `I help ${targetMarket.trim()} who struggle with ${selectedProblem?.problem} through ${selectedMechanism.name}.`
      )
      setValidation(data)
      setStep('validate')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    if (!selectedProblem || !selectedMechanism || !validation) return
    setSaving(true)
    setError('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const avgScore = Math.round((validation.urgency_score + validation.market_demand_score) / 2)

      // clarity_sentences — delete + insert (no unique constraint on user_id)
      await supabase.from('clarity_sentences').delete().eq('user_id', user.id)
      const { error: clarityErr } = await supabase.from('clarity_sentences').insert({
        user_id: user.id,
        target_market: targetMarket.trim(),
        core_problem: selectedProblem.problem,
        unique_mechanism: selectedMechanism.name,
        full_sentence: claritySentence,
        validation_score: avgScore,
        validation_feedback: validation,
        is_validated: true,
      })
      if (clarityErr) throw clarityErr

      await supabase.from('module_progress').upsert(
        {
          user_id: user.id,
          module_number: 1,
          unlocked_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,module_number' }
      )

      setShowConfetti(true)
      setStep('complete')
    } catch {
      setError('Could not save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  function handleCopy(text: string) {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleBack() {
    setError('')
    if (step === 'problem') setStep('market')
    else if (step === 'solution') setStep('problem')
    else if (step === 'validate') setStep('solution')
  }

  // ── Loading screen ────────────────────────────────────────────
  if (loading) {
    return <PremiumLoader message={loadingMessage} />
  }

  // ── Warning screen — existing project detected ────────────────
  if (step === 'warning' && existingClarity) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col">
        <div className="max-w-[430px] md:max-w-3xl mx-auto w-full flex flex-col min-h-screen px-5 pt-12 pb-10">

          {/* Icon */}
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6" style={{ background: '#2d1f00' }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>

          {/* Heading */}
          <h1 className="text-white text-xl font-bold mb-2 leading-snug">
            You already have a project in progress
          </h1>
          <p className="text-gray-400 text-sm mb-6 leading-relaxed">
            KLARO keeps you focused on one project at a time. Starting a new clarity sentence will <span className="font-semibold text-gray-200">permanently replace</span> your current work.
          </p>

          {/* Existing project card */}
          <div className="bg-gray-900 rounded-2xl p-4 mb-8" style={{ border: '1px solid #374151' }}>
            <p className="text-[10px] font-bold text-[#F4B942] uppercase tracking-wide mb-2">Your Current Project</p>
            <p className="text-gray-200 text-sm font-medium leading-relaxed mb-3">
              &ldquo;{existingClarity.full_sentence}&rdquo;
            </p>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-baseline gap-2">
                <span className="text-[9px] font-bold uppercase tracking-wide text-gray-500 w-20 flex-shrink-0">Market</span>
                <span className="text-xs text-gray-400">{existingClarity.target_market}</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-[9px] font-bold uppercase tracking-wide text-gray-500 w-20 flex-shrink-0">Problem</span>
                <span className="text-xs text-gray-400">{existingClarity.core_problem}</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-[9px] font-bold uppercase tracking-wide text-gray-500 w-20 flex-shrink-0">Mechanism</span>
                <span className="text-xs text-gray-400">{existingClarity.unique_mechanism}</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <button
            onClick={() => {
              setTargetMarket(existingClarity.target_market)
              setSelectedProblem({ rank: 1, problem: existingClarity.core_problem })
              setSelectedMechanism({ name: existingClarity.unique_mechanism })
              setClaritySentence(existingClarity.full_sentence || `I help ${existingClarity.target_market} who struggle with ${existingClarity.core_problem} through ${existingClarity.unique_mechanism}.`)
              setStep('complete')
            }}
            className="w-full bg-[#F4B942] text-[#1A1F36] font-bold py-4 rounded-xl text-sm mb-3"
          >
            Continue my current project
          </button>

          <button
            onClick={() => {
              setExistingClarity(null)
              setStep('market')
            }}
            className="w-full font-semibold py-3.5 rounded-xl text-sm text-red-400"
            style={{ background: '#1a0a0a', border: '1px solid #7f1d1d' }}
          >
            Start a new project (replaces current work)
          </button>

          <button
            onClick={() => router.push('/dashboard')}
            className="w-full text-center text-sm text-gray-500 py-3 mt-1"
          >
            Back to Dashboard
          </button>

        </div>
      </div>
    )
  }

  // ── Complete screen ───────────────────────────────────────────
  if (step === 'complete') {
    return (
      <>
        <GoldConfetti trigger={showConfetti} onDone={() => setShowConfetti(false)} />
        <div className="min-h-screen bg-[#F8F9FA]">
        <div className="max-w-[430px] md:max-w-3xl mx-auto px-4 py-10">
          {/* Success banner */}
          <div className="bg-[#10B981] rounded-2xl p-5 mb-6 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div>
              <p className="text-white font-bold text-base">Module 1 Complete!</p>
              <p className="text-white/80 text-sm">Your Clarity Sentence is saved.</p>
            </div>
          </div>

          {/* Coach review status (AP students) */}
          <ModuleReviewStatus moduleNumber={1} />

          {/* Clarity sentence card */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-5">
            <p className="text-xs font-semibold text-[#F4B942] uppercase tracking-wide mb-3">Your Clarity Sentence</p>
            <p className="text-[#1A1F36] font-semibold text-base leading-relaxed">{claritySentence}</p>
            <button
              onClick={() => handleCopy(claritySentence)}
              className="mt-4 flex items-center gap-2 text-sm text-gray-400 hover:text-[#1A1F36] transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
              </svg>
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>

          {/* Up next card */}
          <div className="bg-white rounded-2xl border border-[#F4B942]/40 shadow-sm p-5 mb-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Up Next</p>
            <p className="text-[#1A1F36] font-bold text-base mb-1">Module 2 — The Ebook Factory</p>
            <p className="text-sm text-gray-500 mb-4">
              Write and export your complete ebook using your Clarity Sentence.
            </p>
            <button
              onClick={() => router.push('/module/2')}
              className="w-full bg-[#F4B942] text-[#1A1F36] font-bold py-3.5 rounded-xl text-sm hover:bg-[#e5a832] transition-colors"
            >
              Start Module 2
            </button>
          </div>

          <button
            onClick={() => router.push('/dashboard')}
            className="w-full text-center text-sm text-gray-400 hover:text-[#1A1F36] transition-colors py-2"
          >
            Back to Dashboard
          </button>

          {!module2Started && (
            <button
              onClick={() => {
                setTargetMarket('')
                setSelectedProblem(null)
                setSelectedMechanism(null)
                setProblems([])
                setMechanisms([])
                setValidation(null)
                setCurrentSolution('')
                setError('')
                setStep('market')
              }}
              className="w-full text-center text-xs text-gray-400 hover:text-red-400 transition-colors py-1 mt-1"
            >
              ↺ Start over with a new clarity sentence
            </button>
          )}
        </div>
      </div>
      </>
    )
  }

  // ── Main wizard ───────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col">
      <GoldConfetti trigger={showConfetti} onDone={() => setShowConfetti(false)} />
      <div className="max-w-[430px] md:max-w-3xl mx-auto w-full flex flex-col min-h-screen">

        {/* Header */}
        <div className="bg-[#1A1F36] px-4 pt-12 pb-6">
          <div className="flex items-center gap-3 mb-5">
            {step !== 'market' ? (
              <button
                onClick={handleBack}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 shrink-0"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F4B942" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
            ) : (
              <button
                onClick={() => router.push('/dashboard')}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 shrink-0"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F4B942" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
            )}
            <div>
              <p className="text-[#F4B942] text-xs font-semibold uppercase tracking-wide">Module 1</p>
              <h1 className="text-white font-bold text-lg leading-tight">The Clarity Builder</h1>
            </div>
          </div>

          {/* Step progress dots */}
          <div className="flex items-center">
            {STEP_LABELS.map((label, i) => {
              const isCompleted = currentStepIndex > i
              const isActive = currentStepIndex === i
              return (
                <div key={label} className="flex items-center flex-1 last:flex-none">
                  <div className="flex flex-col items-center">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                      isCompleted ? 'bg-[#10B981]' : isActive ? 'bg-[#F4B942]' : 'bg-white/20'
                    }`}>
                      {isCompleted ? (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      ) : (
                        <span className={`text-xs font-bold ${isActive ? 'text-[#1A1F36]' : 'text-white/40'}`}>{i + 1}</span>
                      )}
                    </div>
                    <span className={`text-xs mt-1 font-medium whitespace-nowrap ${
                      isCompleted ? 'text-[#10B981]' : isActive ? 'text-[#F4B942]' : 'text-white/30'
                    }`}>{label}</span>
                  </div>
                  {i < STEP_LABELS.length - 1 && (
                    <div className={`h-0.5 flex-1 mx-1 mb-4 ${isCompleted ? 'bg-[#10B981]' : 'bg-white/20'}`} />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Step content */}
        <div className="flex-1 overflow-y-auto px-4 py-6 pb-32">

          {/* Error banner — always at top so it's never hidden below the fold */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">
              {error}
            </div>
          )}

          {/* ── Step 1: Market ── */}
          {step === 'market' && (
            <div>
              <h2 className="text-xl font-bold text-[#1A1F36] mb-1">Who do you want to help?</h2>
              <p className="text-sm text-gray-500 mb-5">
                Be specific — the more focused your market, the better your results.
              </p>

              <textarea
                value={targetMarket}
                onChange={e => setTargetMarket(e.target.value)}
                placeholder="e.g., OFW wives, burned-out corporate employees, homeschooling parents"
                rows={3}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-[#1A1F36] placeholder-gray-300 focus:outline-none focus:border-[#1A1F36] focus:ring-1 focus:ring-[#1A1F36] transition-colors bg-white resize-none"
              />

              <button
                onClick={() => setShowIdeas(!showIdeas)}
                className="mt-3 flex items-center gap-1.5 text-sm text-[#F4B942] font-semibold"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                Need ideas?
                <svg
                  width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                  className={`transition-transform ${showIdeas ? 'rotate-180' : ''}`}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {showIdeas && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {FILIPINO_MARKETS.map(market => (
                    <button
                      key={market}
                      onClick={() => { setTargetMarket(market); setShowIdeas(false) }}
                      className="px-3 py-1.5 rounded-full bg-white border border-gray-200 text-xs text-[#1A1F36] hover:border-[#F4B942] hover:bg-[#FFF8E8] transition-colors"
                    >
                      {market}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Step 2: Problem ── */}
          {step === 'problem' && (
            <div>
              <h2 className="text-xl font-bold text-[#1A1F36] mb-1">Pick their biggest problem</h2>
              <p className="text-sm text-gray-500 mb-5">
                Ranked by profitability for <strong className="text-[#1A1F36]">{targetMarket}</strong>. Pick the one that feels most urgent.
              </p>

              <div className="flex flex-col gap-3">
                {problems.map((p, i) => {
                  const isSelected = selectedProblem?.problem === p.problem
                  const payColor =
                    p.willingness_to_pay === 'High' ? 'bg-green-100 text-green-700' :
                    p.willingness_to_pay === 'Medium' ? 'bg-amber-100 text-amber-700' :
                    p.willingness_to_pay === 'Low' ? 'bg-gray-100 text-gray-500' : ''
                  const sellColor =
                    p.ease_of_selling === 'Easy' ? 'bg-blue-100 text-blue-700' :
                    p.ease_of_selling === 'Moderate' ? 'bg-purple-100 text-purple-700' :
                    p.ease_of_selling === 'Hard' ? 'bg-red-100 text-red-600' : ''
                  return (
                    <button
                      key={i}
                      onClick={() => setSelectedProblem(p)}
                      className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                        isSelected
                          ? 'border-[#F4B942] bg-[#FFF8E8]'
                          : 'border-gray-100 bg-white hover:border-gray-200'
                      }`}
                    >
                      {/* Rank + title row */}
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-start gap-2 flex-1">
                          <span className="text-[10px] font-black text-white bg-[#1A1F36] rounded-md px-1.5 py-0.5 shrink-0 mt-0.5">#{p.rank}</span>
                          <p className="text-sm font-bold text-[#1A1F36] leading-snug">{p.problem}</p>
                        </div>
                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-[#F4B942] flex items-center justify-center shrink-0 mt-0.5">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </div>
                        )}
                      </div>

                      {/* Badges */}
                      {(p.willingness_to_pay || p.ease_of_selling) && (
                        <div className="flex gap-1.5 mb-2 flex-wrap">
                          {p.willingness_to_pay && (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${payColor}`}>
                              💰 {p.willingness_to_pay}
                            </span>
                          )}
                          {p.ease_of_selling && (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${sellColor}`}>
                              📈 {p.ease_of_selling} to sell
                            </span>
                          )}
                        </div>
                      )}

                      {/* Urgency */}
                      {p.urgency && (
                        <p className="text-xs text-gray-600 leading-relaxed mb-1.5">
                          <span className="font-semibold text-[#1A1F36]">Why urgent: </span>{p.urgency}
                        </p>
                      )}

                      {/* Proof of demand */}
                      {p.proof_of_demand && (
                        <p className="text-xs text-gray-500 leading-relaxed mb-1.5">
                          <span className="font-semibold text-[#1A1F36]">Demand proof: </span>{p.proof_of_demand}
                        </p>
                      )}

                      {/* Common phrases */}
                      {p.common_phrases && (
                        <p className="text-[11px] text-[#F4B942] italic leading-relaxed">
                          &ldquo;{p.common_phrases}&rdquo;
                        </p>
                      )}

                      {/* Legacy fallback */}
                      {!p.urgency && p.insight && (
                        <p className="text-xs text-gray-500 leading-relaxed">{p.insight}</p>
                      )}
                    </button>
                  )
                })}
              </div>

              {/* Current solution input — appears once a problem is selected */}
              {selectedProblem && (
                <div className="mt-5 bg-white border border-gray-100 rounded-2xl p-4">
                  <p className="text-xs font-bold text-[#1A1F36] uppercase tracking-wide mb-1">
                    One quick question
                  </p>
                  <p className="text-sm text-gray-600 mb-3">
                    What do people <em>usually</em> do right now to solve this problem?
                  </p>
                  <textarea
                    value={currentSolution}
                    onChange={e => setCurrentSolution(e.target.value)}
                    placeholder="e.g., They Google tips, buy generic budgeting apps, or ask friends for advice..."
                    rows={2}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-[#1A1F36] placeholder-gray-300 focus:outline-none focus:border-[#F4B942] focus:ring-1 focus:ring-[#F4B942] transition-colors bg-gray-50 resize-none"
                  />
                  <p className="text-[11px] text-gray-400 mt-1.5">
                    This helps us build a mechanism that&apos;s genuinely different — not a variation of what already exists.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── Step 3: Solution name ── */}
          {step === 'solution' && (
            <div>
              <h2 className="text-xl font-bold text-[#1A1F36] mb-1">Pick your unique mechanism</h2>
              <p className="text-sm text-gray-500 mb-5">
                Each one is a fully built framework — not generic advice. Pick the one that feels most like <em>you</em>.
              </p>

              <div className="flex flex-col gap-3">
                {mechanisms.map((m, i) => {
                  const isSelected = selectedMechanism?.name === m.name
                  const isExpanded = expandedMechanismIndex === i
                  return (
                    <div
                      key={i}
                      className={`rounded-2xl border-2 bg-white overflow-hidden transition-all ${
                        isSelected
                          ? 'border-[#F4B942] shadow-sm'
                          : isExpanded
                            ? 'border-gray-300'
                            : 'border-gray-100'
                      }`}
                    >
                      {/* ── Collapsed header — always visible, tap to expand ── */}
                      <button
                        onClick={() => setExpandedMechanismIndex(isExpanded ? null : i)}
                        className="w-full text-left px-4 py-3.5 flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Selected indicator dot */}
                          <div className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-all ${
                            isSelected ? 'bg-[#F4B942] border-[#F4B942]' : 'border-gray-300'
                          }`}>
                            {isSelected && (
                              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-base font-bold text-[#1A1F36] leading-snug">{m.name}</p>
                            {m.positioning_line && !isExpanded && (
                              <p className="text-xs text-gray-500 mt-0.5 leading-relaxed line-clamp-1 italic">{m.positioning_line}</p>
                            )}
                          </div>
                        </div>
                        {/* Chevron */}
                        <svg
                          width="16" height="16" viewBox="0 0 24 24" fill="none"
                          stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                          className={`text-gray-400 shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                        >
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </button>

                      {/* ── Expanded details ── */}
                      {isExpanded && (
                        <div className="px-4 pb-4 pt-1 space-y-3 border-t border-gray-100">

                          {/* ❌ Why old way fails */}
                          {m.old_way_fails && (
                            <div className="bg-red-50 rounded-xl px-3 py-2.5">
                              <p className="text-[10px] font-bold text-red-400 uppercase tracking-wide mb-1">❌ Why the old way fails</p>
                              <p className="text-xs text-red-700 leading-relaxed">{m.old_way_fails}</p>
                            </div>
                          )}

                          {/* 💡 New belief */}
                          {m.new_belief && (
                            <div className="bg-amber-50 rounded-xl px-3 py-2.5">
                              <p className="text-[10px] font-bold text-amber-500 uppercase tracking-wide mb-1">💡 New belief</p>
                              <p className="text-xs text-amber-800 italic leading-relaxed">&ldquo;{m.new_belief}&rdquo;</p>
                            </div>
                          )}

                          {/* 🧩 How it works */}
                          {m.steps && m.steps.length > 0 && (
                            <div>
                              <p className="text-[10px] font-bold text-[#1A1F36] uppercase tracking-wide mb-1.5">🧩 How it works</p>
                              <div className="flex flex-col gap-1.5">
                                {m.steps.map((s, si) => (
                                  <div key={si} className="flex items-start gap-2">
                                    <span className="w-4 h-4 rounded-full bg-[#F4B942] text-[#1A1F36] text-[9px] font-black flex items-center justify-center shrink-0 mt-0.5">{si + 1}</span>
                                    <p className="text-xs text-gray-600 leading-relaxed">{s}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* 🔥 Aha statements */}
                          {m.aha_statements && m.aha_statements.length > 0 && (
                            <div>
                              <p className="text-[10px] font-bold text-[#1A1F36] uppercase tracking-wide mb-1.5">🔥 Aha statements</p>
                              <div className="flex flex-col gap-1">
                                {m.aha_statements.map((a, ai) => (
                                  <p key={ai} className="text-[11px] text-[#F4B942] italic leading-relaxed">&ldquo;{a}&rdquo;</p>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* 🎯 Positioning line */}
                          {m.positioning_line && (
                            <div className="bg-[#1A1F36] rounded-xl px-3 py-2.5">
                              <p className="text-[10px] font-bold text-[#F4B942] uppercase tracking-wide mb-1">🎯 Positioning</p>
                              <p className="text-xs text-white leading-relaxed italic">{m.positioning_line}</p>
                            </div>
                          )}

                          {/* Legacy fallback fields */}
                          {!m.old_way_fails && m.core_idea && (
                            <p className="text-xs text-gray-600 leading-relaxed">
                              <span className="font-semibold text-[#1A1F36]">Core idea: </span>{m.core_idea}
                            </p>
                          )}
                          {!m.old_way_fails && m.description && (
                            <p className="text-xs text-gray-500 leading-relaxed">{m.description}</p>
                          )}

                          {/* ── Choose / Unchoose button ── */}
                          <button
                            onClick={() => {
                              setSelectedMechanism(isSelected ? null : m)
                            }}
                            className={`w-full mt-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
                              isSelected
                                ? 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                : 'bg-[#F4B942] text-[#1A1F36] hover:bg-[#e5a830] active:scale-[0.98]'
                            }`}
                          >
                            {isSelected ? '✓ Selected — tap to change' : 'Choose This'}
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── Step 4: Validate ── */}
          {step === 'validate' && validation && (
            <div>
              <h2 className="text-xl font-bold text-[#1A1F36] mb-4">Your Clarity Sentence</h2>

              {/* Assembled sentence */}
              <div className="bg-[#1A1F36] rounded-2xl p-5 mb-5">
                <p className="text-white font-semibold text-base leading-relaxed">{claritySentence}</p>
                <button
                  onClick={() => handleCopy(claritySentence)}
                  className="mt-3 flex items-center gap-2 text-[#F4B942] text-xs font-semibold"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                  </svg>
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>

              {/* Scores */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-white rounded-xl border border-gray-100 p-4">
                  <p className="text-xs text-gray-400 mb-1">Urgency Score</p>
                  <p className={`text-3xl font-black ${
                    validation.urgency_score >= 7 ? 'text-[#10B981]'
                    : validation.urgency_score >= 5 ? 'text-[#F59E0B]'
                    : 'text-[#EF4444]'
                  }`}>
                    {validation.urgency_score}
                    <span className="text-sm font-normal text-gray-300">/10</span>
                  </p>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 p-4">
                  <p className="text-xs text-gray-400 mb-1">Market Demand</p>
                  <p className={`text-3xl font-black ${
                    validation.market_demand_score >= 7 ? 'text-[#10B981]'
                    : validation.market_demand_score >= 5 ? 'text-[#F59E0B]'
                    : 'text-[#EF4444]'
                  }`}>
                    {validation.market_demand_score}
                    <span className="text-sm font-normal text-gray-300">/10</span>
                  </p>
                </div>
              </div>

              {/* Recommendation badge */}
              {(() => {
                const avg = Math.round((validation.urgency_score + validation.market_demand_score) / 2)
                const isStrong = avg >= 7
                const isSolid = avg >= 5 && avg < 7
                const isWeak = avg < 5
                return (
                  <div className={`rounded-xl p-4 mb-4 ${
                    isStrong ? 'bg-[#ECFDF5] border border-[#10B981]/30'
                    : isSolid ? 'bg-[#F0FDF4] border border-[#10B981]/20'
                    : 'bg-[#FFF7ED] border border-[#F59E0B]/30'
                  }`}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-black tracking-wide ${
                        isStrong ? 'bg-[#10B981] text-white'
                        : isSolid ? 'bg-[#10B981] text-white'
                        : 'bg-[#F59E0B] text-white'
                      }`}>
                        {isStrong ? '✓ Strong Signal' : isSolid ? '✓ Solid Starting Point' : 'Rethink the Angle'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed">{validation.recommendation_reason}</p>
                  </div>
                )
              })()}

              {/* Red flags — only shown prominently for weak scores, as heads-up for solid/strong */}
              {validation.red_flags && validation.red_flags.toLowerCase() !== 'none' && (
                <div className={`rounded-xl p-4 mb-4 ${
                  Math.round((validation.urgency_score + validation.market_demand_score) / 2) < 5
                    ? 'bg-red-50 border border-red-100'
                    : 'bg-gray-50 border border-gray-100'
                }`}>
                  <p className={`text-xs font-semibold uppercase tracking-wide mb-1 ${
                    Math.round((validation.urgency_score + validation.market_demand_score) / 2) < 5
                      ? 'text-red-500' : 'text-gray-400'
                  }`}>
                    {Math.round((validation.urgency_score + validation.market_demand_score) / 2) < 5 ? 'Watch Out' : 'Heads Up'}
                  </p>
                  <p className={`text-sm leading-relaxed ${
                    Math.round((validation.urgency_score + validation.market_demand_score) / 2) < 5
                      ? 'text-red-700' : 'text-gray-600'
                  }`}>{validation.red_flags}</p>
                </div>
              )}

              {/* Refinement suggestion — only for weak scores */}
              {Math.round((validation.urgency_score + validation.market_demand_score) / 2) < 5 && validation.refinement_suggestion && (
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 mb-4">
                  <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-1">Suggestion</p>
                  <p className="text-sm text-amber-800 leading-relaxed">{validation.refinement_suggestion}</p>
                </div>
              )}

              {/* Market insights */}
              <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Market Insights</p>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Estimated Market Size</p>
                    <p className="text-sm text-[#1A1F36]">{validation.market_size}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Price Range (PH)</p>
                    <p className="text-sm text-[#1A1F36]">{validation.price_range}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Buying Behavior</p>
                    <p className="text-sm text-[#1A1F36]">{validation.buying_behavior}</p>
                  </div>
                </div>
              </div>

              {/* Nudge line */}
              <p className="text-xs text-center text-gray-400 leading-relaxed px-2 mb-2">
                The real validation happens when you put it in front of people. This score is your starting map — not the finish line.
              </p>
            </div>
          )}

        </div>

        {/* Fixed bottom action bar */}
        <div className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-100 safe-area-pb">
          <div className="max-w-[430px] md:max-w-3xl mx-auto px-4 py-4">

            {step === 'market' && (
              <button
                onClick={handleMarketNext}
                disabled={!targetMarket.trim()}
                className="w-full bg-[#1A1F36] text-white font-bold py-4 rounded-xl text-sm hover:bg-[#2d3458] active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Find Their Biggest Problems
              </button>
            )}

            {step === 'problem' && (
              <button
                onClick={handleProblemNext}
                disabled={!selectedProblem}
                className="w-full bg-[#1A1F36] text-white font-bold py-4 rounded-xl text-sm hover:bg-[#2d3458] active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Use This Problem
              </button>
            )}

            {step === 'solution' && (
              <button
                onClick={handleValidate}
                disabled={!selectedMechanism}
                className="w-full bg-[#1A1F36] text-white font-bold py-4 rounded-xl text-sm hover:bg-[#2d3458] active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Validate My Idea
              </button>
            )}

            {step === 'validate' && validation && (
              <div className="flex flex-col gap-2">
                {validation.recommendation === 'REFINE' && (
                  <button
                    onClick={() => setStep('market')}
                    className="w-full border-2 border-[#1A1F36] text-[#1A1F36] font-bold py-3.5 rounded-xl text-sm hover:bg-gray-50 active:scale-[0.98] transition-all"
                  >
                    Go Back and Adjust
                  </button>
                )}
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full bg-[#F4B942] text-[#1A1F36] font-bold py-4 rounded-xl text-sm hover:bg-[#e5a832] active:scale-[0.98] transition-all disabled:opacity-60"
                >
                  {saving ? 'Saving…' : 'Save My Clarity Sentence'}
                </button>
              </div>
            )}

          </div>
        </div>

      </div>
    </div>
  )
}
