'use client'

import GoldConfetti from '@/components/GoldConfetti'
import ModuleReviewStatus from '@/app/components/ModuleReviewStatus'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { isModuleUnlockedForStudent, getDaysUntilUnlock } from '@/lib/modules'

// ── Types ────────────────────────────────────────────────────────────────────

type Step = 'ideas' | 'format' | 'preview' | 'complete'
type Format = 'checklist' | 'quick_guide' | 'free_report'

interface Idea {
  angle: string
  description: string
  emotional_trigger: 'frustration' | 'fear' | 'desire'
  example_title: string
}

interface LeadMagnet {
  title: string
  hook: string
  introduction: string
  main_content: string
  quick_win: string
  bridge_to_ebook: string
}

interface ClarityData {
  target_market: string
  core_problem: string
  unique_mechanism: string
  full_sentence: string
}

// ── Constants ────────────────────────────────────────────────────────────────

const STEP_LABELS = ['Idea', 'Format', 'Preview']
const STEP_KEYS: Step[] = ['ideas', 'format', 'preview']

const FORMAT_OPTIONS: { key: Format; label: string; description: string }[] = [
  {
    key: 'checklist',
    label: 'Checklist',
    description: '7–10 scannable action items. Great for busy readers who want fast wins.',
  },
  {
    key: 'quick_guide',
    label: 'Quick Guide',
    description: 'A short 3–5 page how-to. Step-by-step direction on one specific problem.',
  },
  {
    key: 'free_report',
    label: 'Free Report',
    description: 'A punchy insight document. Builds authority and trust with bold observations.',
  },
]

const SECTION_LABELS: { key: keyof LeadMagnet; label: string }[] = [
  { key: 'title', label: 'Title' },
  { key: 'hook', label: 'Opening Hook' },
  { key: 'introduction', label: 'Introduction' },
  { key: 'main_content', label: 'Main Content' },
  { key: 'quick_win', label: 'Quick Win' },
  { key: 'bridge_to_ebook', label: 'Bridge to Ebook' },
]

const TRIGGER_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  frustration: { label: 'Frustration', color: '#EA580C', bg: '#FFF7ED' },
  fear:        { label: 'Urgency',     color: '#DC2626', bg: '#FEF2F2' },
  desire:      { label: 'Desire',      color: '#059669', bg: '#ECFDF5' },
}

// ── Icons ────────────────────────────────────────────────────────────────────

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
const EditIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
)

// ── Main Component ───────────────────────────────────────────────────────────

export default function Module6Page() {
  const router = useRouter()
  const [showConfetti, setShowConfetti] = useState(false)
  const [step, setStep] = useState<Step>('ideas')
  const [clarity, setClarity] = useState<ClarityData | null>(null)
  const [ebookTitle, setEbookTitle] = useState('')
  const [clarityLoading, setClarityLoading] = useState(true)
  const [error, setError] = useState('')

  // Lock state
  const [locked, setLocked] = useState(false)
  const [daysUntilUnlock, setDaysUntilUnlock] = useState(0)
  const [nextModuleLocked, setNextModuleLocked] = useState(false)
  const [nextModuleDaysLeft, setNextModuleDaysLeft] = useState(0)

  // Ideas step
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [ideasLoading, setIdeasLoading] = useState(false)
  const [selectedIdeaIndex, setSelectedIdeaIndex] = useState<number | null>(null)
  const ideasGeneratedRef = useRef(false)

  // Format step
  const [selectedFormat, setSelectedFormat] = useState<Format | null>(null)

  // Preview step
  const [generating, setGenerating] = useState(false)
  const [generationPhase, setGenerationPhase] = useState<'outline' | 'content' | null>(null)
  const [leadMagnet, setLeadMagnet] = useState<LeadMagnet | null>(null)
  const [editedSections, setEditedSections] = useState<Partial<LeadMagnet>>({})
  const [editingSection, setEditingSection] = useState<string | null>(null)
  const [regeneratingSection, setRegeneratingSection] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [copiedSection, setCopiedSection] = useState<string | null>(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const currentStepIndex = STEP_KEYS.indexOf(step === 'complete' ? 'preview' : step)

  // ── Load data ─────────────────────────────────────────────────
  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      // ── Access check ─────────────────────────────────────────
      const { data: profile } = await supabase
        .from('profiles')
        .select('access_level, enrolled_at, unlocked_modules, program_type')
        .eq('id', user.id)
        .maybeSingle()

      if (profile) {
        const unlocked = isModuleUnlockedForStudent(profile.unlocked_modules, profile.access_level, profile.enrolled_at, 6, profile.program_type)
        if (!unlocked) {
          setDaysUntilUnlock(profile.enrolled_at ? getDaysUntilUnlock(profile.enrolled_at, 6) : 0)
          setLocked(true)
          setClarityLoading(false)
          return
        }
        const next = isModuleUnlockedForStudent(profile.unlocked_modules, profile.access_level, profile.enrolled_at, 7, profile.program_type)
        setNextModuleLocked(!next)
        if (!next && profile.enrolled_at) setNextModuleDaysLeft(getDaysUntilUnlock(profile.enrolled_at, 7))
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

      // Resume if lead magnet already exists
      const { data: lmData } = await supabase
        .from('lead_magnets')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()

      if (lmData?.title) {
        setSelectedFormat((lmData.format as Format) || 'checklist')
        setLeadMagnet({
          title:           lmData.title || '',
          hook:            lmData.hook || '',
          introduction:    lmData.introduction || '',
          main_content:    lmData.main_content || '',
          quick_win:       lmData.quick_win || '',
          bridge_to_ebook: lmData.bridge_to_ebook || '',
        })
        setStep('preview')
      }

      setClarityLoading(false)
    }
    loadData()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-generate ideas on ideas step ────────────────────────
  useEffect(() => {
    if (step !== 'ideas' || !clarity || ideasLoading || ideas.length > 0 || ideasGeneratedRef.current) return
    generateIdeas()
  }, [step, clarity]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Generate lead magnet ideas ────────────────────────────────
  async function generateIdeas() {
    if (!clarity || ideasGeneratedRef.current) return
    ideasGeneratedRef.current = true
    setIdeasLoading(true)
    setError('')
    try {
      const res = await fetch('/api/generate/lead-magnet-ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_market: clarity.target_market,
          problem:       clarity.core_problem,
          mechanism:     clarity.unique_mechanism,
          ebook_title:   ebookTitle,
        }),
      })
      const { data, error: apiErr } = await res.json()
      if (apiErr) throw new Error(apiErr)
      setIdeas(data)
      setSelectedIdeaIndex(0)
    } catch {
      setError('Could not generate ideas. Please try again.')
    } finally {
      setIdeasLoading(false)
    }
  }

  function handleRegenerateIdeas() {
    ideasGeneratedRef.current = false
    setIdeas([])
    setSelectedIdeaIndex(null)
    generateIdeas()
  }

  // ── Generate lead magnet content (2 calls: outline → main content) ──
  async function handleGenerate() {
    if (!clarity || !selectedFormat) return
    setError('')
    setGenerating(true)
    setStep('preview')
    setLeadMagnet(null)

    const selectedIdea = selectedIdeaIndex !== null ? ideas[selectedIdeaIndex] : null
    const basePayload = {
      target_market: clarity.target_market,
      problem:       clarity.core_problem,
      mechanism:     clarity.unique_mechanism,
      ebook_title:   ebookTitle,
      format:        selectedFormat,
      idea_angle:    selectedIdea?.angle || '',
      idea_description: selectedIdea?.description || '',
      example_title: selectedIdea?.example_title || '',
      emotional_trigger: selectedIdea?.emotional_trigger || '',
    }

    try {
      // Call 1: Generate outline (title, hook, introduction, quick_win, bridge)
      setGenerationPhase('outline')
      const res1 = await fetch('/api/generate/lead-magnet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...basePayload, section: 'outline' }),
      })
      const { data: outline, error: err1 } = await res1.json()
      if (err1) throw new Error(err1)

      // Show outline immediately (main_content will be empty for now)
      setLeadMagnet({ ...outline, main_content: '' })

      // Call 2: Generate main content (pass title + hook for context)
      setGenerationPhase('content')
      const res2 = await fetch('/api/generate/lead-magnet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...basePayload,
          section: 'main_content',
          title: outline.title,
          hook: outline.hook,
        }),
      })
      const res2Json = await res2.json()
      if (res2Json.error) throw new Error(res2Json.error)
      const contentData = res2Json.data || {}
      console.log('Lead magnet main_content response:', contentData)

      setLeadMagnet({ ...outline, main_content: contentData.main_content || '' })
      setEditedSections({})
    } catch (err) {
      console.error('Lead magnet generation error:', err)
      setError('Could not generate your lead magnet. Please try again.')
      // If we have no outline at all, go back to format step
      setLeadMagnet(prev => {
        if (!prev) setStep('format')
        return prev
      })
    } finally {
      setGenerating(false)
      setGenerationPhase(null)
    }
  }

  // ── Regenerate single section ─────────────────────────────────
  async function handleRegenerateSection(sectionKey: keyof LeadMagnet) {
    if (!clarity || !selectedFormat || !leadMagnet) return
    setRegeneratingSection(sectionKey)
    setError('')
    const selectedIdea = selectedIdeaIndex !== null ? ideas[selectedIdeaIndex] : null
    const section = sectionKey === 'main_content' ? 'main_content' : 'outline'
    try {
      const res = await fetch('/api/generate/lead-magnet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_market: clarity.target_market,
          problem:       clarity.core_problem,
          mechanism:     clarity.unique_mechanism,
          ebook_title:   ebookTitle,
          format:        selectedFormat,
          section,
          idea_angle:    selectedIdea?.angle || '',
          idea_description: selectedIdea?.description || '',
          example_title: selectedIdea?.example_title || '',
          emotional_trigger: selectedIdea?.emotional_trigger || '',
          title: leadMagnet.title,
          hook: leadMagnet.hook,
        }),
      })
      const { data, error: apiErr } = await res.json()
      if (apiErr) throw new Error(apiErr)
      setLeadMagnet(prev => prev ? { ...prev, [sectionKey]: data[sectionKey] } : prev)
      setEditedSections(prev => { const u = { ...prev }; delete u[sectionKey]; return u })
    } catch {
      setError('Could not regenerate this section. Please try again.')
    } finally {
      setRegeneratingSection(null)
    }
  }

  function getSection(key: keyof LeadMagnet): string {
    return editedSections[key] ?? leadMagnet?.[key] ?? ''
  }

  // ── Download as Word doc ──────────────────────────────────────
  async function handleDownload() {
    if (!leadMagnet) return
    setDownloading(true)
    try {
      const res = await fetch('/api/export/lead-magnet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: getSection('title'),
          format: selectedFormat,
          hook: getSection('hook'),
          introduction: getSection('introduction'),
          main_content: getSection('main_content'),
          quick_win: getSection('quick_win'),
          bridge_to_ebook: getSection('bridge_to_ebook'),
        }),
      })
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${(getSection('title') || 'lead-magnet').replace(/[^a-zA-Z0-9\s-]/g, '').trim().replace(/\s+/g, '-').toLowerCase()}.docx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      setError('Could not download your lead magnet. Please try again.')
    } finally {
      setDownloading(false)
    }
  }

  // ── Copy helper ───────────────────────────────────────────────
  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text).catch(() => {})
    setCopiedSection(label)
    setTimeout(() => setCopiedSection(null), 2000)
  }

  // ── Save & Complete ───────────────────────────────────────────
  async function handleMarkComplete() {
    if (!clarity || !leadMagnet) return
    setError('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const lm = { ...leadMagnet, ...editedSections }

      await supabase.from('lead_magnets').delete().eq('user_id', user.id)
      const { error: lmErr } = await supabase.from('lead_magnets').insert({
        user_id:         user.id,
        format:          selectedFormat,
        title:           lm.title,
        hook:            lm.hook,
        introduction:    lm.introduction,
        main_content:    lm.main_content,
        quick_win:       lm.quick_win,
        bridge_to_ebook: lm.bridge_to_ebook,
        full_content:    Object.values(lm).join('\n\n'),
      })
      if (lmErr) throw lmErr

      await supabase.from('module_progress').upsert(
        { user_id: user.id, module_number: 6, status: 'complete', completed_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        { onConflict: 'user_id, module_number' }
      )

      // Auto-unlock next module for AP students (no-op for other programs)
      fetch('/api/student/complete-module', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moduleNumber: 6 }),
      }).catch(() => {})

      setShowConfetti(true)
      setStep('complete')
    } catch {
      setError('Could not save. Please try again.')
    }
  }

  // ── Progress Dots ─────────────────────────────────────────────
  function ProgressDots() {
    return (
      <div className="flex items-center justify-center mb-6">
        {STEP_LABELS.map((label, i) => {
          const isDone = i < currentStepIndex
          const isActive = i === currentStepIndex
          return (
            <div key={label} className="flex items-center">
              <div className="flex flex-col items-center">
                <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: isDone ? '#10B981' : isActive ? '#F4B942' : '#D1D5DB' }}>
                  {isDone ? <span className="text-white"><CheckIcon /></span> : <span className="text-xs font-bold" style={{ color: isActive ? '#1A1F36' : '#9CA3AF' }}>{i + 1}</span>}
                </div>
                <span className="text-[10px] mt-1 font-medium whitespace-nowrap" style={{ color: isDone ? '#10B981' : isActive ? '#F4B942' : '#9CA3AF' }}>{label}</span>
              </div>
              {i < STEP_LABELS.length - 1 && <div className="h-0.5 w-12 mb-4 mx-1" style={{ background: i < currentStepIndex ? '#10B981' : '#D1D5DB' }} />}
            </div>
          )
        })}
      </div>
    )
  }

  // ── Loading ───────────────────────────────────────────────────
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

  // ── Locked ────────────────────────────────────────────────────
  if (locked) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center px-4">
        <div className="max-w-[380px] w-full text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5" style={{ background: '#F3F4F6', border: '1px solid #e5e7eb' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <h1 className="text-lg font-bold text-[#1A1F36] mb-2">Module 6 — Not Yet Open</h1>
          <p className="text-sm text-gray-500 mb-1">The Lead Magnet Builder opens in</p>
          <p className="text-3xl font-black mb-1" style={{ color: '#F4B942' }}>{daysUntilUnlock} {daysUntilUnlock === 1 ? 'day' : 'days'}</p>
          <p className="text-xs text-gray-500 mb-8">Keep going — your email sequence is saved.</p>
          <button onClick={() => router.push('/dashboard')} className="w-full py-3 rounded-xl font-bold text-sm" style={{ background: '#F4B942', color: '#1A1F36' }}>
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  // ── Complete Screen ───────────────────────────────────────────
  if (step === 'complete') {
    return (
      <>
        <GoldConfetti trigger={showConfetti} onDone={() => setShowConfetti(false)} />
        <div className="min-h-screen bg-[#F8F9FA]">
          <div className="max-w-[430px] md:max-w-3xl mx-auto px-4 pt-6 pb-32">

            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: '#F4B942' }}>
                <span className="font-bold text-[#1A1F36] text-sm">6</span>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Module 6</p>
                <h1 className="text-base font-bold text-[#1A1F36]">Lead Magnet Builder</h1>
              </div>
            </div>

            <div className="rounded-xl px-4 py-4 mb-5 flex items-start gap-3" style={{ background: '#ecfdf5', border: '1px solid #10B981' }}>
              <div className="w-6 h-6 rounded-full flex items-center justify-center mt-0.5 flex-shrink-0" style={{ background: '#10B981' }}>
                <span className="text-white"><CheckIcon /></span>
              </div>
              <div>
                <p className="font-bold text-emerald-700">Module 6 Complete!</p>
                <p className="text-sm text-emerald-700 mt-0.5">Your lead magnet is saved and ready to share.</p>
              </div>
            </div>

            {/* Coach review status (AP students) */}
            <ModuleReviewStatus moduleNumber={6} />

            {leadMagnet && (
              <div className="bg-white rounded-xl p-4 mb-4 border border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Your Lead Magnet</p>
                <p className="text-sm font-bold text-[#1A1F36] mb-1">{getSection('title')}</p>
                <p className="text-xs text-gray-500 capitalize mb-3">{selectedFormat?.replace('_', ' ')} format</p>
                <button
                  onClick={handleDownload}
                  disabled={downloading}
                  className="w-full py-2.5 rounded-lg font-semibold text-sm flex items-center justify-center gap-2"
                  style={{ background: '#1A1F36', color: 'white' }}
                >
                  {downloading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Preparing…
                    </>
                  ) : (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                      Download as Word Doc
                    </>
                  )}
                </button>
              </div>
            )}

            {nextModuleLocked ? (
              <div className="rounded-xl p-4 mb-4 flex flex-col items-center gap-1" style={{ background: '#F3F4F6', border: '1px solid #e5e7eb' }}>
                <div className="flex items-center gap-2 text-gray-500 font-semibold text-sm">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                  Module 7 — Facebook Content Engine
                </div>
                <p className="text-xs text-gray-500">{nextModuleDaysLeft > 0 ? `Opens in ${nextModuleDaysLeft} day${nextModuleDaysLeft !== 1 ? 's' : ''}` : 'Coming soon'}</p>
              </div>
            ) : (
              <div className="rounded-xl p-4 mb-4" style={{ background: '#1A1F36', border: '2px solid #F4B942' }}>
                <p className="text-xs font-medium mb-1" style={{ color: '#F4B942' }}>Up Next</p>
                <p className="text-white font-bold">Module 7 — Facebook Content Engine</p>
                <p className="text-gray-400 text-sm mt-1">Generate Facebook posts that attract your ideal buyers.</p>
                <button onClick={() => router.push('/module/7')} className="mt-3 w-full py-2.5 rounded-lg font-bold text-sm" style={{ background: '#F4B942', color: '#1A1F36' }}>
                  Start Module 7
                </button>
              </div>
            )}

            <button onClick={() => router.push('/dashboard')} className="w-full text-center text-sm text-gray-400 underline py-2">
              Back to Dashboard
            </button>
          </div>
        </div>
      </>
    )
  }

  // ── Main Wizard ───────────────────────────────────────────────
  return (
    <>
      <GoldConfetti trigger={showConfetti} onDone={() => setShowConfetti(false)} />
      <div className="min-h-screen bg-[#F8F9FA]">
        <div className="max-w-[430px] md:max-w-3xl mx-auto px-4 pt-6 pb-36">

          {/* Header */}
          <div className="flex items-center gap-3 mb-5">
            <button
              onClick={() => {
                if (step === 'format') setStep('ideas')
                else if (step === 'preview' && !generating) setStep('format')
                else if (step === 'ideas') router.push('/dashboard')
                else router.push('/dashboard')
              }}
              className="w-8 h-8 flex items-center justify-center rounded-full flex-shrink-0"
              style={{ background: '#F4B942' }}
              aria-label="Go back"
            >
              <span style={{ color: '#1A1F36' }}><BackIcon /></span>
            </button>
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Module 6</p>
              <h1 className="text-base font-bold text-[#1A1F36]">Lead Magnet Builder</h1>
            </div>
          </div>

          <ProgressDots />

          {error && (
            <div className="text-red-600 text-sm rounded-lg px-4 py-3 mb-4" style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>
              {error}
              {step === 'ideas' && (
                <button onClick={handleRegenerateIdeas} className="ml-2 underline text-xs">Try again</button>
              )}
            </div>
          )}

          {/* ── IDEAS STEP ─────────────────────────────────────── */}
          {step === 'ideas' && (
            <div>
              <div className="mb-4">
                <h2 className="text-base font-bold text-[#1A1F36] mb-1">What will your lead magnet be about?</h2>
                <p className="text-sm text-gray-500">
                  Based on your niche, here are 3 angles — each hits a different emotion your audience feels right now. Pick the one that resonates most.
                </p>
              </div>

              {/* Loading */}
              {ideasLoading && (
                <div className="text-center py-14">
                  <div className="w-12 h-12 border-4 border-[#F4B942] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-sm font-medium text-[#1A1F36]">Finding the right angles for your audience…</p>
                  <p className="text-xs text-gray-500 mt-1">Based on your clarity data and ebook</p>
                </div>
              )}

              {/* Idea cards */}
              {!ideasLoading && ideas.length > 0 && (
                <div className="space-y-3 mb-4">
                  {ideas.map((idea, i) => {
                    const trigger = TRIGGER_LABELS[idea.emotional_trigger] || TRIGGER_LABELS.desire
                    const isSelected = selectedIdeaIndex === i
                    return (
                      <button
                        key={i}
                        onClick={() => setSelectedIdeaIndex(i)}
                        className="w-full text-left rounded-xl p-4 transition-all"
                        style={{
                          background: isSelected ? '#FFFBEB' : 'white',
                          border: `2px solid ${isSelected ? '#F4B942' : '#e5e7eb'}`,
                        }}
                      >
                        {/* Top row */}
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                              style={{ borderColor: isSelected ? '#F4B942' : '#D1D5DB' }}
                            >
                              {isSelected && <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#F4B942' }} />}
                            </div>
                            <span
                              className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide"
                              style={{ background: trigger.bg, color: trigger.color, border: `1px solid ${trigger.color}40` }}
                            >
                              {trigger.label}
                            </span>
                          </div>
                        </div>

                        {/* Angle name */}
                        <p className="text-sm font-bold text-[#1A1F36] mb-1">{idea.angle}</p>

                        {/* Description */}
                        <p className="text-xs text-gray-500 leading-relaxed mb-3">{idea.description}</p>

                        {/* Example title */}
                        <div className="rounded-lg px-3 py-2" style={{ background: isSelected ? '#FEF3C7' : '#F3F4F6' }}>
                          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Sample title</p>
                          <p className="text-xs font-medium" style={{ color: isSelected ? '#92400E' : '#4B5563' }}>
                            &ldquo;{idea.example_title}&rdquo;
                          </p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Regenerate */}
              {!ideasLoading && ideas.length > 0 && (
                <button
                  onClick={handleRegenerateIdeas}
                  className="flex items-center gap-1.5 text-sm text-gray-500 mx-auto"
                >
                  <RefreshIcon />
                  Generate different angles
                </button>
              )}
            </div>
          )}

          {/* ── FORMAT STEP ────────────────────────────────────── */}
          {step === 'format' && (
            <div>
              {/* Selected idea recap */}
              {selectedIdeaIndex !== null && ideas[selectedIdeaIndex] && (
                <div className="rounded-xl p-4 mb-4" style={{ background: '#FFFBEB', borderLeft: '4px solid #F4B942', borderTop: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>
                  <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Your chosen angle</p>
                  <p className="text-sm font-bold text-[#1A1F36] mb-0.5">{ideas[selectedIdeaIndex].angle}</p>
                  <p className="text-xs text-gray-500 italic">&ldquo;{ideas[selectedIdeaIndex].example_title}&rdquo;</p>
                </div>
              )}

              <h2 className="text-base font-bold text-[#1A1F36] mb-1">Choose your format</h2>
              <p className="text-sm text-gray-500 mb-4">How will you deliver this lead magnet?</p>

              <div className="space-y-3">
                {FORMAT_OPTIONS.map(opt => {
                  const isSelected = selectedFormat === opt.key
                  return (
                    <button
                      key={opt.key}
                      onClick={() => setSelectedFormat(opt.key)}
                      className="w-full text-left rounded-xl p-4 transition-all"
                      style={{
                        background: isSelected ? '#FFFBEB' : 'white',
                        border: `2px solid ${isSelected ? '#F4B942' : '#e5e7eb'}`,
                      }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-bold text-[#1A1F36]">{opt.label}</p>
                        {isSelected && (
                          <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: '#F4B942' }}>
                            <span className="text-[#1A1F36]"><CheckIcon /></span>
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 leading-relaxed">{opt.description}</p>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── PREVIEW STEP ───────────────────────────────────── */}
          {step === 'preview' && (
            <div>
              {/* Generating — two-phase progress */}
              {generating && (
                <div className="py-10 px-2">
                  <style>{`
                    @keyframes checkPop { 0% { transform: scale(0); } 50% { transform: scale(1.3); } 100% { transform: scale(1); } }
                    @keyframes fadeSlide { 0% { opacity: 0; transform: translateX(8px); } 100% { opacity: 1; transform: translateX(0); } }
                    @keyframes typingDotLM { 0%, 60%, 100% { opacity: 0.2; transform: translateY(0); } 30% { opacity: 1; transform: translateY(-3px); } }
                    .check-pop { animation: checkPop 0.35s ease-out forwards; }
                    .fade-slide { animation: fadeSlide 0.3s ease-out forwards; }
                    .td-lm { animation: typingDotLM 1.4s ease-in-out infinite; }
                  `}</style>

                  <div className="text-center mb-6">
                    <p className="text-base font-bold text-[#1A1F36] mb-1">Building your lead magnet</p>
                    <p className="text-xs text-gray-500">
                      {generationPhase === 'outline' ? 'Crafting your title, hook, and structure…' : 'Writing the main content…'}
                    </p>
                    {/* Progress bar */}
                    <div className="w-full h-2 rounded-full overflow-hidden mx-auto mt-4" style={{ background: '#F3F4F6', maxWidth: '280px' }}>
                      <div
                        className="h-full rounded-full transition-all duration-700 ease-out"
                        style={{
                          background: 'linear-gradient(90deg, #F4B942, #f59e0b)',
                          width: generationPhase === 'outline' ? '30%' : leadMagnet?.main_content ? '100%' : '65%',
                        }}
                      />
                    </div>
                  </div>

                  <div className="bg-white rounded-xl p-4 space-y-1" style={{ border: '1px solid #e5e7eb' }}>
                    {[
                      { key: 'outline', label: 'Title, Hook & Structure', done: generationPhase === 'content' || !generating },
                      { key: 'content', label: 'Main Content', done: false },
                    ].map(item => {
                      const isDone = item.key === 'outline' && generationPhase === 'content'
                      const isActive = item.key === generationPhase
                      return (
                        <div key={item.key} className={`flex items-center gap-3 rounded-lg px-3 py-3 transition-all duration-300 ${isActive ? 'bg-[#FFFBEB]' : isDone ? 'bg-[#f0fdf4]' : ''}`}>
                          {isDone ? (
                            <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 check-pop" style={{ background: '#10B981' }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            </div>
                          ) : isActive ? (
                            <div className="w-7 h-7 rounded-full border-2 border-[#F4B942] flex items-center justify-center flex-shrink-0">
                              <div className="flex items-center gap-[3px]">
                                <span className="w-[4px] h-[4px] rounded-full bg-[#F4B942] td-lm" style={{ animationDelay: '0s' }} />
                                <span className="w-[4px] h-[4px] rounded-full bg-[#F4B942] td-lm" style={{ animationDelay: '0.2s' }} />
                                <span className="w-[4px] h-[4px] rounded-full bg-[#F4B942] td-lm" style={{ animationDelay: '0.4s' }} />
                              </div>
                            </div>
                          ) : (
                            <div className="w-7 h-7 rounded-full flex-shrink-0" style={{ background: '#F3F4F6', border: '1px solid #e5e7eb' }} />
                          )}
                          <div className="flex-1">
                            <p className={`text-sm font-semibold ${isDone ? 'text-[#1A1F36]' : isActive ? 'text-[#b45309]' : 'text-gray-400'}`}>
                              {item.label}
                            </p>
                            {isDone && leadMagnet?.title && (
                              <p className="text-xs text-gray-500 truncate fade-slide">{leadMagnet.title}</p>
                            )}
                            {isActive && (
                              <p className="text-xs text-[#d97706] font-medium">
                                {item.key === 'outline' ? 'Crafting structure…' : 'Writing the good stuff…'}
                              </p>
                            )}
                          </div>
                          {isDone && (
                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full flex-shrink-0 fade-slide">Done</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Sections */}
              {!generating && leadMagnet && (
                <div>
                  {/* Download button */}
                  <button
                    onClick={handleDownload}
                    disabled={downloading}
                    className="w-full py-3 rounded-xl font-semibold text-sm mb-4 flex items-center justify-center gap-2 transition-all"
                    style={{ background: '#1A1F36', color: 'white' }}
                  >
                    {downloading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Preparing download…
                      </>
                    ) : (
                      <>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="7 10 12 15 17 10" />
                          <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        Download as Word Doc
                      </>
                    )}
                  </button>

                  {SECTION_LABELS.map(({ key, label }) => {
                    const isEditing = editingSection === key
                    const isRegenerating = regeneratingSection === key
                    const content = getSection(key)
                    return (
                      <div key={key} className="bg-white rounded-xl p-4 mb-3 border border-gray-100">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => setEditingSection(isEditing ? null : key)}
                              className="flex items-center gap-1 text-xs text-gray-400"
                            >
                              <EditIcon />
                              <span>{isEditing ? 'Done' : 'Edit'}</span>
                            </button>
                            <button
                              onClick={() => handleRegenerateSection(key)}
                              disabled={regeneratingSection !== null}
                              className="flex items-center gap-1 text-xs text-gray-400 disabled:opacity-40"
                            >
                              <RefreshIcon />
                              <span>{isRegenerating ? '…' : 'Redo'}</span>
                            </button>
                            <button
                              onClick={() => copyToClipboard(content, key)}
                              className="flex items-center gap-1 text-xs"
                              style={{ color: copiedSection === key ? '#6EE7B7' : '#9CA3AF' }}
                            >
                              <CopyIcon />
                              <span>{copiedSection === key ? 'Copied!' : 'Copy'}</span>
                            </button>
                          </div>
                        </div>

                        {isEditing ? (
                          <textarea
                            defaultValue={content}
                            onBlur={e => {
                              setEditedSections(prev => ({ ...prev, [key]: e.target.value }))
                              setEditingSection(null)
                            }}
                            className="w-full text-sm text-gray-700 leading-relaxed bg-[#F8F9FA] border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-yellow-400/40"
                            style={{ minHeight: '120px', resize: 'vertical' }}
                            autoFocus
                          />
                        ) : isRegenerating ? (
                          <div className="flex items-center gap-2 py-3">
                            <div className="w-4 h-4 border-2 border-[#F4B942] border-t-transparent rounded-full animate-spin" />
                            <p className="text-xs text-gray-500">Rewriting…</p>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{content}</p>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

        </div>

        {/* ── Fixed Bottom Bar ──────────────────────────────────── */}
        <div
          className="fixed bottom-0 bg-white px-4 py-4"
          style={{ borderTop: '1px solid #e5e7eb', width: '100%', maxWidth: '430px', left: '50%', transform: 'translateX(-50%)' }}
        >
          {/* Ideas step */}
          {step === 'ideas' && !ideasLoading && ideas.length > 0 && (
            <button
              onClick={() => setStep('format')}
              disabled={selectedIdeaIndex === null}
              className="w-full py-4 rounded-xl font-bold text-base disabled:opacity-40"
              style={{ background: '#F4B942', color: '#1A1F36' }}
            >
              Use This Angle →
            </button>
          )}

          {step === 'ideas' && ideasLoading && (
            <div className="w-full py-4 rounded-xl font-bold text-base flex items-center justify-center gap-2 opacity-40" style={{ background: '#F3F4F6', color: '#9CA3AF', border: '1px solid #e5e7eb' }}>
              <div className="w-4 h-4 border-2 border-gray-500 border-t-transparent rounded-full animate-spin" />
              Finding angles…
            </div>
          )}

          {/* Format step */}
          {step === 'format' && (
            <button
              onClick={handleGenerate}
              disabled={!selectedFormat}
              className="w-full py-4 rounded-xl font-bold text-base disabled:opacity-40"
              style={{ background: '#F4B942', color: '#1A1F36' }}
            >
              Generate My Lead Magnet →
            </button>
          )}

          {/* Preview step — generating */}
          {step === 'preview' && generating && (
            <div className="w-full py-4 rounded-xl font-bold text-base flex items-center justify-center gap-2 opacity-40" style={{ background: '#F3F4F6', color: '#9CA3AF', border: '1px solid #e5e7eb' }}>
              <div className="w-4 h-4 border-2 border-gray-500 border-t-transparent rounded-full animate-spin" />
              {generationPhase === 'outline' ? 'Building structure…' : 'Writing main content…'}
            </div>
          )}

          {/* Preview step — ready */}
          {step === 'preview' && !generating && leadMagnet && (
            <button
              onClick={handleMarkComplete}
              className="w-full py-4 rounded-xl font-bold text-base"
              style={{ background: '#F4B942', color: '#1A1F36' }}
            >
              Save & Complete Module 6 →
            </button>
          )}
        </div>
      </div>
    </>
  )
}
