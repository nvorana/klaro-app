'use client'

import GoldConfetti from '@/components/GoldConfetti'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

type Step = 'format' | 'preview' | 'complete'
type Format = 'checklist' | 'quick_guide' | 'free_report'

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

const STEP_LABELS = ['Format', 'Preview']
const STEP_KEYS: Step[] = ['format', 'preview']

const FORMAT_OPTIONS: { key: Format; label: string; description: string; icon: string }[] = [
  {
    key: 'checklist',
    label: 'Checklist',
    description: 'A quick, scannable list of action items. Great for busy readers who want fast wins.',
    icon: 'checklist',
  },
  {
    key: 'quick_guide',
    label: 'Quick Guide',
    description: 'A short 3–5 page how-to guide. Gives step-by-step direction on one specific problem.',
    icon: 'guide',
  },
  {
    key: 'free_report',
    label: 'Free Report',
    description: 'A slightly longer insight document with key findings. Builds authority and trust.',
    icon: 'report',
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

const DownloadIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
)

const ChecklistIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#F4B942" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 11 12 14 22 4" />
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
  </svg>
)

const GuideIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#F4B942" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
  </svg>
)

const ReportIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#F4B942" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
)

function FormatIcon({ format }: { format: string }) {
  if (format === 'checklist') return <ChecklistIcon />
  if (format === 'quick_guide') return <GuideIcon />
  return <ReportIcon />
}

export default function Module5Page() {
  const router = useRouter()
  const [showConfetti, setShowConfetti] = useState(false)
  const [step, setStep] = useState<Step>('format')
  const [clarity, setClarity] = useState<ClarityData | null>(null)
  const [ebookTitle, setEbookTitle] = useState('')
  const [clarityLoading, setClarityLoading] = useState(true)
  const [error, setError] = useState('')

  // Format step
  const [selectedFormat, setSelectedFormat] = useState<Format | null>(null)

  // Preview step
  const [generating, setGenerating] = useState(false)
  const [leadMagnet, setLeadMagnet] = useState<LeadMagnet | null>(null)
  const [editedSections, setEditedSections] = useState<Partial<LeadMagnet>>({})
  const [editingSection, setEditingSection] = useState<string | null>(null)
  const [regeneratingSection, setRegeneratingSection] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [exportDone, setExportDone] = useState(false)
  const [copiedSection, setCopiedSection] = useState<string | null>(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const currentStepIndex = STEP_KEYS.indexOf(step === 'complete' ? 'preview' : step)

  // ── Load data ────────────────────────────────────────────────
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

      setEbookTitle(ebookData?.title || '')

      // Restore existing lead magnet
      const { data: lmData } = await supabase
        .from('lead_magnets')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (lmData?.title) {
        setSelectedFormat((lmData.format as Format) || 'checklist')
        setLeadMagnet({
          title: lmData.title || '',
          hook: lmData.hook || '',
          introduction: lmData.introduction || '',
          main_content: lmData.main_content || '',
          quick_win: lmData.quick_win || '',
          bridge_to_ebook: lmData.bridge_to_ebook || '',
        })
        setStep('preview')
      }

      setClarityLoading(false)
    }
    loadData()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Generate ─────────────────────────────────────────────────
  async function handleGenerate() {
    if (!clarity || !selectedFormat) return
    setError('')
    setGenerating(true)
    setStep('preview')

    try {
      const res = await fetch('/api/generate/lead-magnet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_market: clarity.target_market,
          problem: clarity.core_problem,
          mechanism: clarity.unique_mechanism,
          ebook_title: ebookTitle,
          format: selectedFormat,
        }),
      })
      const { data, error: apiErr } = await res.json()
      if (apiErr) throw new Error(apiErr)
      setLeadMagnet(data)
      setEditedSections({})
    } catch {
      setError('Could not generate your lead magnet. Please try again.')
      setStep('format')
    } finally {
      setGenerating(false)
    }
  }

  // ── Regenerate single section ────────────────────────────────
  async function handleRegenerateSection(sectionKey: keyof LeadMagnet) {
    if (!clarity || !selectedFormat) return
    setRegeneratingSection(sectionKey)
    setError('')
    try {
      const res = await fetch('/api/generate/lead-magnet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_market: clarity.target_market,
          problem: clarity.core_problem,
          mechanism: clarity.unique_mechanism,
          ebook_title: ebookTitle,
          format: selectedFormat,
        }),
      })
      const { data, error: apiErr } = await res.json()
      if (apiErr) throw new Error(apiErr)
      setLeadMagnet(prev => prev ? { ...prev, [sectionKey]: data[sectionKey] } : prev)
      setEditedSections(prev => {
        const updated = { ...prev }
        delete updated[sectionKey]
        return updated
      })
    } catch {
      setError('Could not regenerate this section. Please try again.')
    } finally {
      setRegeneratingSection(null)
    }
  }

  function getSection(key: keyof LeadMagnet): string {
    return editedSections[key] ?? leadMagnet?.[key] ?? ''
  }

  // ── Export ───────────────────────────────────────────────────
  async function handleExport() {
    if (!leadMagnet) return
    setExporting(true)
    setError('')
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
      const safeTitle = getSection('title').replace(/[^a-zA-Z0-9\s-]/g, '').trim().replace(/\s+/g, '-').toLowerCase()
      a.download = `${safeTitle || 'lead-magnet'}.docx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setExportDone(true)
    } catch {
      setError('Export failed. Please try again.')
    } finally {
      setExporting(false)
    }
  }

  // ── Copy helper ──────────────────────────────────────────────
  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text).catch(() => {})
    setCopiedSection(label)
    setTimeout(() => setCopiedSection(null), 2000)
  }

  // ── Save & Complete ──────────────────────────────────────────
  async function handleMarkComplete() {
    if (!clarity || !leadMagnet) return
    setError('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const lm = { ...leadMagnet, ...editedSections }

      // lead_magnets — no unique constraint on user_id, so use delete + insert
      await supabase.from('lead_magnets').delete().eq('user_id', user.id)
      const { error: lmErr } = await supabase.from('lead_magnets').insert({
        user_id: user.id,
        format: selectedFormat,
        title: lm.title,
        hook: lm.hook,
        introduction: lm.introduction,
        main_content: lm.main_content,
        quick_win: lm.quick_win,
        bridge_to_ebook: lm.bridge_to_ebook,
        full_content: Object.values(lm).join('\n\n'),
      })
      if (lmErr) throw lmErr

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
                  className="h-0.5 w-16 mb-4 mx-1"
                  style={{ background: i < currentStepIndex ? '#10B981' : '#374151' }}
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
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-[#F4B942] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-400">Loading your progress…</p>
        </div>
      </div>
    )
  }

  // ── Complete Screen ──────────────────────────────────────────
  if (step === 'complete') {
    return (
      <>
        <GoldConfetti trigger={showConfetti} onDone={() => setShowConfetti(false)} />
        <div className="min-h-screen bg-gray-950">
        <div className="max-w-[430px] md:max-w-3xl mx-auto px-4 pt-6 pb-32">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: '#F4B942' }}>
              <span className="font-bold text-[#1A1F36] text-sm">5</span>
            </div>
            <div>
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Module 5</p>
              <h1 className="text-base font-bold text-white">Lead Magnet Builder</h1>
            </div>
          </div>

          <div className="rounded-xl px-4 py-4 mb-5 flex items-start gap-3" style={{ background: '#064e3b', border: '1px solid #10B981' }}>
            <div className="w-6 h-6 rounded-full flex items-center justify-center mt-0.5 flex-shrink-0" style={{ background: '#10B981' }}>
              <span className="text-white"><CheckIcon /></span>
            </div>
            <div>
              <p className="font-bold text-emerald-300">Module 5 Complete!</p>
              <p className="text-sm text-emerald-300 mt-0.5">Your lead magnet is saved.</p>
            </div>
          </div>

          {leadMagnet && (
            <div className="bg-gray-900 rounded-xl p-4 mb-4" style={{ border: '1px solid #374151' }}>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Your Lead Magnet</p>
              <p className="text-sm font-bold text-white mb-1">{getSection('title')}</p>
              <p className="text-xs text-gray-400 capitalize">{selectedFormat?.replace('_', ' ')} format</p>
            </div>
          )}

          <div className="rounded-xl p-4 mb-4" style={{ background: '#1A1F36', border: '2px solid #F4B942' }}>
            <p className="text-xs font-medium mb-1" style={{ color: '#F4B942' }}>Up Next</p>
            <p className="text-white font-bold">Module 6 — Facebook Content Engine</p>
            <p className="text-gray-300 text-sm mt-1">Generate Facebook posts that attract your ideal buyers.</p>
            <button
              onClick={() => router.push('/module/6')}
              className="mt-3 w-full py-2.5 rounded-lg font-bold text-sm"
              style={{ background: '#F4B942', color: '#1A1F36' }}
            >
              Start Module 6
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
      </>
    )
  }

  // ── Main Wizard ──────────────────────────────────────────────
  return (
    <>
      <GoldConfetti trigger={showConfetti} onDone={() => setShowConfetti(false)} />
      <div className="min-h-screen bg-gray-950">
      <div className="max-w-[430px] md:max-w-3xl mx-auto px-4 pt-6 pb-36">

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <button
            onClick={() => {
              if (step === 'preview' && !generating) setStep('format')
              else router.push('/dashboard')
            }}
            className="w-8 h-8 flex items-center justify-center rounded-full flex-shrink-0"
            style={{ background: '#F4B942' }}
            aria-label="Go back"
          >
            <span style={{ color: '#1A1F36' }}><BackIcon /></span>
          </button>
          <div>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Module 5</p>
            <h1 className="text-base font-bold text-white">Lead Magnet Builder</h1>
          </div>
        </div>

        <ProgressDots />

        {error && (
          <div className="text-red-400 text-sm rounded-lg px-4 py-3 mb-4" style={{ background: '#1a0000', border: '1px solid #7f1d1d' }}>
            {error}
          </div>
        )}

        {/* ── Format Step ───────────────────────────────────── */}
        {step === 'format' && (
          <div>
            <p className="text-sm text-gray-400 mb-4">
              Choose the format for your free lead magnet. This will be the gift you offer in exchange for someone&apos;s email.
            </p>

            <div className="space-y-3">
              {FORMAT_OPTIONS.map(opt => {
                const isSelected = selectedFormat === opt.key
                return (
                  <button
                    key={opt.key}
                    onClick={() => setSelectedFormat(opt.key)}
                    className="w-full text-left rounded-xl p-4 transition-all"
                    style={{
                      background: isSelected ? '#1c1500' : '#111827',
                      border: `2px solid ${isSelected ? '#F4B942' : '#374151'}`,
                    }}
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 mt-0.5">
                        <FormatIcon format={opt.key} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-bold text-white">{opt.label}</p>
                          {isSelected && (
                            <div
                              className="w-5 h-5 rounded-full flex items-center justify-center"
                              style={{ background: '#F4B942' }}
                            >
                              <span className="text-[#1A1F36]"><CheckIcon /></span>
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 leading-relaxed">{opt.description}</p>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>

            {clarity && (
              <div className="bg-gray-900 rounded-xl p-4 mt-4" style={{ borderTop: '1px solid #374151', borderRight: '1px solid #374151', borderBottom: '1px solid #374151', borderLeft: '4px solid #F4B942' }}>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Writing for</p>
                <p className="text-sm text-gray-200">{clarity.target_market}</p>
              </div>
            )}
          </div>
        )}

        {/* ── Preview Step ──────────────────────────────────── */}
        {step === 'preview' && (
          <div>
            {/* Generating */}
            {generating && (
              <div className="text-center py-16">
                <div className="w-12 h-12 border-4 border-[#F4B942] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-sm font-medium text-white">Creating your lead magnet…</p>
                <p className="text-xs text-gray-400 mt-1">Making sure it&apos;s useful enough to share, irresistible enough to download</p>
              </div>
            )}

            {/* Sections */}
            {!generating && leadMagnet && (
              <div>
                {SECTION_LABELS.map(({ key, label }) => (
                  <div key={key} className="bg-gray-900 rounded-xl p-4 mb-3" style={{ border: '1px solid #374151' }}>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</p>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setEditingSection(editingSection === key ? null : key)}
                          className="flex items-center gap-1 text-xs text-gray-400 hover:text-white"
                        >
                          <EditIcon />
                          <span>{editingSection === key ? 'Done' : 'Edit'}</span>
                        </button>
                        <button
                          onClick={() => handleRegenerateSection(key)}
                          disabled={regeneratingSection !== null}
                          className="flex items-center gap-1 text-xs text-gray-400 hover:text-[#F4B942] disabled:opacity-40"
                        >
                          <RefreshIcon />
                          <span>{regeneratingSection === key ? '…' : 'Redo'}</span>
                        </button>
                        <button
                          onClick={() => copyToClipboard(getSection(key), key)}
                          className="flex items-center gap-1 text-xs text-gray-400 hover:text-white"
                        >
                          <CopyIcon />
                          <span>{copiedSection === key ? 'Copied!' : 'Copy'}</span>
                        </button>
                      </div>
                    </div>

                    {regeneratingSection === key ? (
                      <div className="flex items-center gap-2 py-3">
                        <div className="w-4 h-4 border-2 border-[#F4B942] border-t-transparent rounded-full animate-spin" />
                        <p className="text-sm text-gray-400">Rewriting {label.toLowerCase()}…</p>
                      </div>
                    ) : editingSection === key ? (
                      <textarea
                        value={getSection(key)}
                        onChange={e => setEditedSections(prev => ({ ...prev, [key]: e.target.value }))}
                        rows={key === 'main_content' ? 10 : 4}
                        className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 bg-gray-950 text-white"
                        style={{ borderColor: '#F4B942' }}
                      />
                    ) : (
                      <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
                        {getSection(key)}
                      </p>
                    )}
                  </div>
                ))}

                {/* Export button */}
                <button
                  onClick={handleExport}
                  disabled={exporting}
                  className="w-full py-3 rounded-xl font-semibold text-sm mb-3 flex items-center justify-center gap-2 transition-all disabled:opacity-60"
                  style={{
                    background: exportDone ? '#10B981' : '#1A1F36',
                    color: exportDone ? 'white' : '#F4B942',
                  }}
                >
                  <DownloadIcon />
                  {exporting ? 'Exporting…' : exportDone ? 'Downloaded!' : 'Export as Word Document (.docx)'}
                </button>

                {/* PDF tip */}
                {exportDone && (
                  <div
                    className="rounded-xl p-3 mb-3 text-sm"
                    style={{ background: '#1c1500', border: '1px solid #92400E' }}
                  >
                    <p className="font-semibold text-yellow-300 mb-1">Next step: Save as PDF</p>
                    <p className="text-xs text-yellow-500">
                      Open the downloaded file in Word → File → Save As → PDF. Share the PDF version with your audience.
                    </p>
                  </div>
                )}
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
            borderTop: '1px solid #374151',
            width: '100%',
            maxWidth: '430px',
            left: '50%',
            transform: 'translateX(-50%)',
          }}
        >
          {step === 'format' && (
            <button
              onClick={handleGenerate}
              disabled={!selectedFormat}
              className="w-full py-4 rounded-xl font-bold text-base disabled:opacity-40 transition-all"
              style={{ background: selectedFormat ? '#F4B942' : '#374151', color: selectedFormat ? '#1A1F36' : '#9CA3AF' }}
            >
              {selectedFormat
                ? `Generate My ${FORMAT_OPTIONS.find(f => f.key === selectedFormat)?.label}`
                : 'Pick a Format to Continue'}
            </button>
          )}

          {step === 'preview' && generating && (
            <div
              className="w-full py-4 rounded-xl font-bold text-base flex items-center justify-center gap-2 opacity-60"
              style={{ background: '#374151', color: '#9CA3AF' }}
            >
              <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
              Creating your lead magnet…
            </div>
          )}

          {step === 'preview' && !generating && leadMagnet && (
            <button
              onClick={handleMarkComplete}
              className="w-full py-4 rounded-xl font-bold text-base"
              style={{ background: '#F4B942', color: '#1A1F36' }}
            >
              Save &amp; Complete Module 5
            </button>
          )}
        </div>
      )}
    </div>
    </>
  )
}
