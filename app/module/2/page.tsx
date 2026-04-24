'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import ModuleReviewStatus from '@/app/components/ModuleReviewStatus'
import GoldConfetti from '@/components/GoldConfetti'
import { isModuleUnlockedForStudent } from '@/lib/modules'

// ─── Types ────────────────────────────────────────────────────────────────────

type Step =
  | 'load'
  | 'outline'
  | 'writing_chapter'
  | 'chapter_review'
  | 'writing_frontmatter'
  | 'review'
  | 'complete'

interface ClarityData {
  target_market: string
  core_problem: string
  unique_mechanism: string
  full_sentence: string
  created_at: string
}

interface TitleOption {
  option: number
  title: string
  subtitle: string
}

interface ChapterOutline {
  number: number
  title: string
  goal: string
  quick_win_outcome: string
}

interface PracticalStep {
  step_number: number
  title: string
  what_to_do: string
  why_it_matters: string
  common_mistake: string
}

interface QuickWin {
  goal: string
  instructions: string[]
  immediate_result: string
}

interface ChapterDraft {
  number: number
  title: string
  quote?: { text: string; author: string }
  story_starter: string
  core_lessons: string
  practical_steps: PracticalStep[]
  quick_win: QuickWin
  confidence_close: string
}

// ─── Progress steps (for top bar) ─────────────────────────────────────────────

const PROGRESS_STEPS = ['Outline', 'Chapters', 'Finishing', 'Review']

function getProgressIndex(step: Step, currentChapterIndex: number, totalChapters: number): number {
  if (step === 'outline') return 0
  if (step === 'writing_chapter' || step === 'chapter_review') return 1
  if (step === 'writing_frontmatter') return 2
  if (step === 'review' || step === 'complete') return 3
  return 0
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Module2Page() {
  const router = useRouter()
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const [step, setStep] = useState<Step>('load')
  const [showConfetti, setShowConfetti] = useState(false)
  const [clarity, setClarity] = useState<ClarityData | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [downloading, setDownloading] = useState(false)

  // Outline state
  const [titleOptions, setTitleOptions] = useState<TitleOption[]>([])
  const [selectedTitleIndex, setSelectedTitleIndex] = useState(0)
  const [chapterOutlines, setChapterOutlines] = useState<ChapterOutline[]>([])
  const [generatingOutline, setGeneratingOutline] = useState(false)

  // Chapter-by-chapter state
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0)
  const [chapterDrafts, setChapterDrafts] = useState<ChapterDraft[]>([])
  const [currentDraft, setCurrentDraft] = useState<ChapterDraft | null>(null)
  const [regenerating, setRegenerating] = useState(false)
  // regenCounts tracks how many regenerations per chapter index
  const [regenCounts, setRegenCounts] = useState<Record<number, number>>({})

  // Frontmatter
  const [introduction, setIntroduction] = useState('')
  const [conclusion, setConclusion] = useState('')

  // Review
  const [expandedChapter, setExpandedChapter] = useState<number | null>(null)
  const [showStartOverWarning, setShowStartOverWarning] = useState(false)

  // Author
  const [authorName, setAuthorName] = useState('')

  // ─── Auth & init ──────────────────────────────────────────────────────────

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('access_level, enrolled_at, unlocked_modules, full_name, program_type')
        .eq('id', session.user.id)
        .single()

      if (!profile || profile.access_level === 'pending') { router.push('/signup'); return }

      if (profile.full_name) setAuthorName(profile.full_name)

      if (!isModuleUnlockedForStudent(profile.unlocked_modules, profile.access_level, profile.enrolled_at, 2, profile.program_type)) {
        router.push('/dashboard'); return
      }

      const { data: clarityRow } = await supabase
        .from('clarity_sentences')
        .select('target_market, core_problem, unique_mechanism, full_sentence, created_at')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (!clarityRow) { router.push('/module/1'); return }
      setClarity(clarityRow)

      // Check if student already has a saved ebook for THIS clarity project.
      // We only resume an existing ebook if it was created AFTER the current
      // clarity sentence — meaning it was built from this exact project.
      // If the clarity is newer, the user started a new project and should
      // begin a fresh outline instead of loading an old mismatched ebook.
      const { data: existingEbook } = await supabase
        .from('ebooks')
        .select('title, outline, chapters, created_at')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      const ebookMatchesCurrentClarity =
        existingEbook?.chapters?.length &&
        new Date(existingEbook.created_at) > new Date(clarityRow.created_at)

      if (ebookMatchesCurrentClarity) {
        const outline = existingEbook.outline || {}
        setTitleOptions([{ option: 1, title: existingEbook.title, subtitle: outline.subtitle || '' }])
        setSelectedTitleIndex(0)
        setChapterOutlines(outline.chapter_outlines || [])
        setChapterDrafts(existingEbook.chapters)
        setIntroduction(outline.introduction || '')
        setConclusion(outline.conclusion || '')
        setStep('review')
      } else {
        setStep('outline')
      }
    }
    init()
  }, [])

  // ─── Agent helper ──────────────────────────────────────────────────────────

  const callAgent = useCallback(async (stage: string, data: Record<string, unknown>) => {
    if (!clarity) throw new Error('No clarity data')
    const res = await fetch('/api/generate/ebook-agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stage,
        project: {
          target_market: clarity.target_market,
          problem: clarity.core_problem,
          unique_mechanism: clarity.unique_mechanism,
        },
        data,
      }),
    })
    if (!res.ok) throw new Error('Agent request failed')
    const json = await res.json()
    return json.data
  }, [clarity])

  // ─── Generate outline ──────────────────────────────────────────────────────

  async function generateOutline() {
    setGeneratingOutline(true)
    setError('')
    try {
      const result = await callAgent('outline', {}) as {
        title_options: TitleOption[]
        recommended: number
        chapters: ChapterOutline[]
      }
      setTitleOptions(result.title_options || [])
      setSelectedTitleIndex((result.recommended || 1) - 1)
      setChapterOutlines(result.chapters || [])
    } catch {
      setError('Failed to generate outline. Please try again.')
    } finally {
      setGeneratingOutline(false)
    }
  }

  // ─── Write a single chapter ────────────────────────────────────────────────

  async function writeChapter(index: number, isRegenerate = false) {
    const chapter = chapterOutlines[index]
    const selectedTitle = titleOptions[selectedTitleIndex]

    if (isRegenerate) {
      setRegenerating(true)
      setRegenCounts(prev => ({ ...prev, [index]: (prev[index] ?? 0) + 1 }))
    } else {
      setStep('writing_chapter')
    }
    setError('')
    setCurrentDraft(null)

    try {
      const draft = await callAgent('chapter', {
        book_title: selectedTitle.title,
        chapter,
        all_chapters: chapterOutlines,
      }) as ChapterDraft

      setCurrentDraft(draft)
      setStep('chapter_review')
    } catch {
      setError('Failed to write this chapter. Please try again.')
      setStep(isRegenerate ? 'chapter_review' : 'outline')
    } finally {
      setRegenerating(false)
    }
  }

  // Start writing from the outline step
  function startWriting() {
    setCurrentChapterIndex(0)
    setChapterDrafts([])
    writeChapter(0)
  }

  // Approve current chapter → move to next (or frontmatter if last)
  async function approveChapter() {
    if (!currentDraft) return

    const updatedDrafts = [...chapterDrafts.filter(d => d.number !== currentDraft.number), currentDraft]
      .sort((a, b) => a.number - b.number)
    setChapterDrafts(updatedDrafts)

    const nextIndex = currentChapterIndex + 1

    if (nextIndex < chapterOutlines.length) {
      setCurrentChapterIndex(nextIndex)
      writeChapter(nextIndex)
    } else {
      // All chapters done — write intro + conclusion
      await writeFrontmatter(updatedDrafts)
    }
  }

  // ─── Write intro + conclusion ──────────────────────────────────────────────

  async function writeFrontmatter(drafts: ChapterDraft[]) {
    setStep('writing_frontmatter')
    setError('')
    const selectedTitle = titleOptions[selectedTitleIndex]

    try {
      const [introResult, conclusionResult] = await Promise.all([
        callAgent('introduction', {
          book_title: selectedTitle.title,
          book_subtitle: selectedTitle.subtitle,
          chapters: chapterOutlines,
        }) as Promise<{ introduction: string }>,
        callAgent('conclusion', {
          book_title: selectedTitle.title,
          chapters: chapterOutlines,
        }) as Promise<{ conclusion: string }>,
      ])
      setIntroduction(introResult.introduction || '')
      setConclusion(conclusionResult.conclusion || '')
    } catch {
      setError('Failed to write intro/conclusion. You can still review your chapters.')
    }

    setChapterDrafts(drafts)
    setExpandedChapter(null)
    setStep('review')
  }

  // ─── Save ebook ────────────────────────────────────────────────────────────

  async function saveEbook() {
    setSaving(true)
    setError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      const selectedTitle = titleOptions[selectedTitleIndex]

      await supabase.from('ebooks').delete().eq('user_id', session.user.id)
      const { error: insertError } = await supabase.from('ebooks').insert({
        user_id: session.user.id,
        title: selectedTitle.title,
        status: 'complete',
        outline: {
          subtitle: selectedTitle.subtitle,
          title_options: titleOptions,
          chapter_outlines: chapterOutlines,
          introduction,
          conclusion,
        },
        chapters: chapterDrafts,
      })
      if (insertError) throw insertError

      await supabase.from('module_progress').upsert({
        user_id: session.user.id,
        module_number: 2,
        completed: true,
        completed_at: new Date().toISOString(),
      }, { onConflict: 'user_id,module_number' })

      // Auto-unlock next module for AP students (no-op for other programs)
      fetch('/api/student/complete-module', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moduleNumber: 2 }),
      }).catch(() => {})

      setShowConfetti(true)
      setStep('complete')
    } catch (e) {
      console.error(e)
      setError('Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  // ─── Download as Word doc ──────────────────────────────────────────────────

  async function downloadEbook() {
    setDownloading(true)
    setError('')
    try {
      const selectedTitle = titleOptions[selectedTitleIndex]
      const ebookPayload = {
        title: selectedTitle?.title || 'My E-Book',
        subtitle: selectedTitle?.subtitle || '',
        authorName,
        introduction,
        conclusion,
        chapters: chapterDrafts,
      }

      const res = await fetch('/api/generate/ebook-docx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ebookPayload),
      })

      if (!res.ok) throw new Error('Download failed')

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${(selectedTitle?.title || 'ebook').replace(/[^a-z0-9]/gi, '_').toLowerCase()}.docx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      setError('Failed to generate Word document. Please try again.')
    } finally {
      setDownloading(false)
    }
  }

  // ─── Derived ──────────────────────────────────────────────────────────────

  const progressIndex = getProgressIndex(step, currentChapterIndex, chapterOutlines.length)
  const selectedTitle = titleOptions[selectedTitleIndex]

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#1A1F36] flex flex-col">
      <GoldConfetti trigger={showConfetti} onDone={() => setShowConfetti(false)} />
      <div className="w-full max-w-[430px] md:max-w-3xl mx-auto flex flex-col min-h-screen">

      {/* Header */}
      <div className="bg-[#1A1F36] px-6 pt-8 pb-5">
        <button onClick={() => router.push('/dashboard')} className="text-gray-400 hover:text-gray-200 text-sm mb-4 flex items-center gap-1">
          ← Dashboard
        </button>
        <div className="flex items-center gap-3 mb-1">
          <span className="bg-[#F4B942] text-[#1A1F36] text-xs font-bold px-2 py-1 rounded">MODULE 2</span>
          <h1 className="text-xl font-bold text-white">Create Your E-Book</h1>
        </div>
        <p className="text-gray-400 text-sm">AI writes. You direct. Your knowledge becomes a product.</p>
      </div>

      {/* Progress bar */}
      {step !== 'load' && step !== 'complete' && (
        <div className="px-6 pt-4 mb-6">
          <div className="flex items-center gap-2">
            {PROGRESS_STEPS.map((label, i) => (
              <div key={label} className="flex items-center gap-2">
                <div className={`flex items-center gap-1.5 ${i <= progressIndex ? 'text-[#F4B942]' : 'text-gray-400'}`}>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold border
                    ${i < progressIndex ? 'bg-[#F4B942] text-[#1A1F36] border-[#F4B942]' :
                      i === progressIndex ? 'border-[#F4B942] text-[#F4B942]' :
                      'border-gray-300 text-gray-400'}`}>
                    {i < progressIndex ? '✓' : i + 1}
                  </div>
                  <span className="text-xs font-medium hidden sm:block">{label}</span>
                </div>
                {i < PROGRESS_STEPS.length - 1 && (
                  <div className={`h-px w-6 sm:w-12 ${i < progressIndex ? 'bg-[#F4B942]' : 'bg-gray-200'}`} />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chapter progress dots (visible during chapter writing) */}
      {(step === 'writing_chapter' || step === 'chapter_review') && chapterOutlines.length > 0 && (
        <div className="px-6 mb-4">
          <div className="flex items-center gap-2 flex-wrap">
            {chapterOutlines.map((ch, i) => {
              const isDone = chapterDrafts.some(d => d.number === ch.number)
              const isCurrent = i === currentChapterIndex
              return (
                <div
                  key={ch.number}
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border
                    ${isDone ? 'bg-[#F4B942] text-[#1A1F36] border-[#F4B942]' :
                      isCurrent ? 'border-[#F4B942] text-[#F4B942]' :
                      'border-gray-300 text-gray-400'}`}
                >
                  {isDone ? '✓' : ch.number}
                </div>
              )
            })}
            <span className="text-gray-500 text-xs ml-1">
              {chapterDrafts.length} of {chapterOutlines.length} chapters done
            </span>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mx-6 mb-4 bg-red-50 border border-red-200 text-red-600 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* ── LOAD ── */}
      {step === 'load' && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-gray-500 text-sm animate-pulse">Loading your profile...</div>
        </div>
      )}

      {/* ── OUTLINE ── */}
      {step === 'outline' && (
        <div className="flex-1 px-6 pb-10">

          {clarity && (
            <div className="bg-[#1A1F36] border border-[#1A1F36] rounded-xl p-4 mb-6">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Your Clarity Sentence</p>
              <p className="text-[#F4B942] text-sm font-medium">{clarity.full_sentence}</p>
            </div>
          )}

          {titleOptions.length === 0 ? (
            <div className="text-center py-10">
              <div className="text-4xl mb-4">📖</div>
              <h2 className="text-lg font-bold text-[#1A1F36] mb-2">Ready to create your e-book?</h2>
              <p className="text-gray-500 text-sm mb-8 max-w-sm mx-auto">
                The AI will generate 3 title options and an 8–10 chapter outline based on your clarity sentence.
              </p>
              <button
                onClick={generateOutline}
                disabled={generatingOutline}
                className="bg-[#F4B942] text-[#1A1F36] font-bold px-8 py-3 rounded-xl disabled:opacity-50"
              >
                {generatingOutline
                  ? <span className="flex items-center gap-2"><span className="animate-spin inline-block">⏳</span> Generating outline...</span>
                  : 'Generate My E-Book Outline'}
              </button>
            </div>
          ) : (
            <div>
              <h2 className="text-base font-bold text-[#1A1F36] mb-4">Choose a Title</h2>
              <div className="space-y-3 mb-8">
                {titleOptions.map((option, i) => (
                  <button
                    key={option.option}
                    onClick={() => setSelectedTitleIndex(i)}
                    className={`w-full text-left p-4 rounded-xl border transition-all ${
                      selectedTitleIndex === i
                        ? 'border-[#F4B942] bg-[#F4B942]/10'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-5 h-5 rounded-full border-2 mt-0.5 flex-shrink-0 flex items-center justify-center
                        ${selectedTitleIndex === i ? 'border-[#F4B942]' : 'border-gray-300'}`}>
                        {selectedTitleIndex === i && <div className="w-2.5 h-2.5 rounded-full bg-[#F4B942]" />}
                      </div>
                      <div>
                        <p className="font-bold text-[#1A1F36] text-sm">{option.title}</p>
                        <p className="text-gray-500 text-xs mt-0.5">{option.subtitle}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              <h2 className="text-base font-bold text-[#1A1F36] mb-3">Your {chapterOutlines.length}-Chapter Outline</h2>
              <div className="space-y-2 mb-8">
                {chapterOutlines.map((ch) => (
                  <div key={ch.number} className="bg-white border border-gray-100 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <span className="bg-gray-100 text-[#F4B942] text-xs font-bold px-2 py-0.5 rounded mt-0.5 flex-shrink-0">CH {ch.number}</span>
                      <div>
                        <p className="text-[#1A1F36] text-sm font-semibold">{ch.title}</p>
                        <p className="text-gray-500 text-xs mt-1">{ch.goal}</p>
                        <p className="text-[#F4B942] text-xs mt-1">⚡ {ch.quick_win_outcome}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={startWriting}
                className="w-full bg-[#F4B942] text-[#1A1F36] font-bold py-4 rounded-xl text-base"
              >
                Start Writing Chapter by Chapter →
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── WRITING CHAPTER (also shows during regenerate) ── */}
      {(step === 'writing_chapter' || (step === 'chapter_review' && regenerating)) && (
        <div className="flex-1 flex flex-col items-center justify-center px-6 pb-10 text-center">

          {/* Premium spinner */}
          <div className="relative w-20 h-20 mb-8">
            <svg className="w-full h-full" viewBox="0 0 80 80">
              <circle cx="40" cy="40" r="32" fill="none" stroke="#e5e7eb" strokeWidth="3"/>
              <circle
                cx="40" cy="40" r="32"
                fill="none"
                stroke="#F4B942"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray="50 150"
                style={{ animation: 'chapterSpin 1.4s cubic-bezier(0.4,0,0.2,1) infinite', transformOrigin: '40px 40px' }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              {regenerating ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F4B942" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 4 23 10 17 10"/>
                  <polyline points="1 20 1 14 7 14"/>
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F4B942" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                </svg>
              )}
            </div>
          </div>

          {/* Animated writing lines */}
          <div className="flex flex-col gap-2.5 w-44 mb-8">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="h-px bg-yellow-400 rounded-full"
                style={{
                  animation: 'writingLine 1.8s ease-in-out infinite',
                  animationDelay: `${i * 0.28}s`,
                  transformOrigin: 'left center',
                }}
              />
            ))}
          </div>

          <h2 className="text-base font-bold text-[#1A1F36] mb-2 tracking-wide">
            {regenerating
              ? `Rewriting Chapter ${currentChapterIndex + 1}…`
              : `Writing Chapter ${currentChapterIndex + 1} of ${chapterOutlines.length}`}
          </h2>
          {chapterOutlines[currentChapterIndex] && (
            <p className="text-[#F4B942] text-sm mb-3 font-medium">
              &ldquo;{chapterOutlines[currentChapterIndex].title}&rdquo;
            </p>
          )}
          <p className="text-gray-500 text-xs max-w-xs leading-relaxed">
            {regenerating
              ? 'Generating a fresh version — this takes about 20–30 seconds…'
              : 'Writing all 5 sections — this takes about 20–30 seconds…'}
          </p>

          <style>{`
            @keyframes chapterSpin {
              from { transform: rotate(0deg); }
              to   { transform: rotate(360deg); }
            }
            @keyframes writingLine {
              0%, 100% { transform: scaleX(0.2); opacity: 0.15; }
              50%       { transform: scaleX(1);   opacity: 0.65; }
            }
          `}</style>
        </div>
      )}

      {/* ── CHAPTER REVIEW ── */}
      {step === 'chapter_review' && currentDraft && (
        <div className="flex-1 px-6 pb-10">

          {/* Chapter header */}
          <div className="bg-[#1A1F36] rounded-xl p-4 mb-5">
            <div className="flex items-center gap-2 mb-1">
              <span className="bg-[#F4B942] text-[#1A1F36] text-xs font-bold px-2 py-0.5 rounded">
                CH {currentDraft.number}
              </span>
              <span className="text-gray-400 text-xs">of {chapterOutlines.length}</span>
            </div>
            <p className="text-white font-bold text-base">{currentDraft.title}</p>
          </div>

          {/* Opening Quote */}
          {currentDraft.quote && (
            <div className="mb-5 border-l-4 border-[#F4B942] pl-4">
              <p className="text-gray-700 text-base italic leading-relaxed">&ldquo;{currentDraft.quote.text}&rdquo;</p>
              <p className="text-[#F4B942] text-xs font-semibold mt-2">— {currentDraft.quote.author}</p>
            </div>
          )}

          {/* Section: Story Starter */}
          <div className="mb-5">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[#F4B942] text-xs font-bold uppercase tracking-wide">📖 Introduction</span>
            </div>
            <div className="bg-white border border-gray-100 rounded-xl p-4">
              <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-line">{currentDraft.story_starter}</p>
            </div>
          </div>

          {/* Section: Core Lessons */}
          <div className="mb-5">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-blue-500 text-xs font-bold uppercase tracking-wide">💡 Core Lessons</span>
            </div>
            <div className="bg-white border border-gray-100 rounded-xl p-4">
              <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-line">{currentDraft.core_lessons}</p>
            </div>
          </div>

          {/* Section: Practical Steps */}
          {currentDraft.practical_steps?.length > 0 && (
            <div className="mb-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-green-600 text-xs font-bold uppercase tracking-wide">🪜 Practical Steps</span>
              </div>
              <div className="space-y-3">
                {currentDraft.practical_steps.map((s) => (
                  <div key={s.step_number} className="bg-white border border-gray-100 rounded-xl p-4">
                    <p className="text-[#1A1F36] text-sm font-semibold mb-1">Step {s.step_number}: {s.title}</p>
                    <p className="text-gray-600 text-sm">{s.what_to_do}</p>
                    <p className="text-gray-400 text-xs mt-1 italic">Why: {s.why_it_matters}</p>
                    <p className="text-red-500 text-xs mt-1">⚠️ Common mistake: {s.common_mistake}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section: Quick Win */}
          {currentDraft.quick_win && (
            <div className="mb-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[#F4B942] text-xs font-bold uppercase tracking-wide">⚡ Quick Win</span>
              </div>
              <div className="bg-[#F4B942]/5 border border-[#F4B942]/20 rounded-xl p-4">
                <p className="text-[#1A1F36] text-sm font-medium mb-2">{currentDraft.quick_win.goal}</p>
                <ul className="space-y-1 mb-2">
                  {currentDraft.quick_win.instructions?.map((inst, i) => (
                    <li key={i} className="text-gray-600 text-sm flex items-start gap-2">
                      <span className="text-[#F4B942] font-bold flex-shrink-0">{i + 1}.</span>
                      <span>{inst}</span>
                    </li>
                  ))}
                </ul>
                {currentDraft.quick_win.immediate_result && (
                  <p className="text-green-600 text-xs italic">✓ Result: {currentDraft.quick_win.immediate_result}</p>
                )}
              </div>
            </div>
          )}

          {/* Section: Confidence Close */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-purple-500 text-xs font-bold uppercase tracking-wide">🎯 Confidence Close</span>
            </div>
            <div className="bg-white border border-gray-100 rounded-xl p-4">
              <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-line">{currentDraft.confidence_close}</p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="space-y-3">
            <button
              onClick={approveChapter}
              className="w-full bg-[#F4B942] text-[#1A1F36] font-bold py-4 rounded-xl text-base"
            >
              {currentChapterIndex + 1 < chapterOutlines.length
                ? `Approve → Write Chapter ${currentChapterIndex + 2}`
                : 'Approve → Finish E-Book'}
            </button>
            {(() => {
              const usedRegens = regenCounts[currentChapterIndex] ?? 0
              const regenLimit = 2
              const regenLeft = regenLimit - usedRegens
              const regenDisabled = regenerating || regenLeft <= 0
              return (
                <button
                  onClick={() => writeChapter(currentChapterIndex, true)}
                  disabled={regenDisabled}
                  className="w-full bg-white border border-gray-200 text-gray-600 font-semibold py-3 rounded-xl text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {regenerating
                    ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
                          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                        </svg>
                        Regenerating…
                      </span>
                    )
                    : regenLeft <= 0
                      ? 'Regeneration limit reached for this chapter'
                      : (
                        <span className="flex items-center justify-center gap-2">
                          ↺ Regenerate This Chapter
                          {usedRegens > 0 && (
                            <span className={`text-xs font-normal px-1.5 py-0.5 rounded-full ${regenLeft === 1 ? 'bg-amber-100 text-amber-600' : 'bg-gray-100 text-gray-400'}`}>
                              {regenLeft} left
                            </span>
                          )}
                        </span>
                      )
                  }
                </button>
              )
            })()}
          </div>
        </div>
      )}

      {/* ── WRITING FRONTMATTER ── */}
      {step === 'writing_frontmatter' && (
        <div className="flex-1 flex flex-col items-center justify-center px-6 pb-10 text-center">

          {/* Premium spinner */}
          <div className="relative w-20 h-20 mb-8">
            <svg className="w-full h-full" viewBox="0 0 80 80">
              <circle cx="40" cy="40" r="32" fill="none" stroke="#e5e7eb" strokeWidth="3"/>
              <circle
                cx="40" cy="40" r="32"
                fill="none"
                stroke="#F4B942"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray="50 150"
                style={{ animation: 'chapterSpin 1.4s cubic-bezier(0.4,0,0.2,1) infinite', transformOrigin: '40px 40px' }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F4B942" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
              </svg>
            </div>
          </div>

          {/* Animated writing lines */}
          <div className="flex flex-col gap-2.5 w-44 mb-8">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="h-px bg-yellow-400 rounded-full"
                style={{
                  animation: 'writingLine 1.8s ease-in-out infinite',
                  animationDelay: `${i * 0.28}s`,
                  transformOrigin: 'left center',
                }}
              />
            ))}
          </div>

          <h2 className="text-base font-bold text-[#1A1F36] mb-2 tracking-wide">Almost there…</h2>
          <p className="text-[#F4B942] text-sm mb-3 font-medium">Writing your Introduction &amp; Conclusion</p>
          <p className="text-gray-500 text-xs max-w-xs leading-relaxed">Putting the finishing touches on your e-book — just a few more seconds.</p>
        </div>
      )}

      {/* ── REVIEW ── */}
      {step === 'review' && (
        <div className="flex-1 px-6 pb-10">

          {selectedTitle && (
            <div className="bg-[#1A1F36] rounded-xl p-4 mb-6">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Your E-Book</p>
              <p className="text-[#F4B942] font-bold text-lg leading-tight">{selectedTitle.title}</p>
              <p className="text-gray-300 text-sm mt-1">{selectedTitle.subtitle}</p>
            </div>
          )}

          {/* Introduction */}
          {introduction && (
            <div className="mb-3">
              <button
                onClick={() => setExpandedChapter(expandedChapter === -1 ? null : -1)}
                className="w-full text-left bg-white border border-gray-100 rounded-xl p-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <span className="bg-gray-100 text-gray-500 text-xs font-bold px-2 py-0.5 rounded">INTRO</span>
                  <span className="text-[#1A1F36] text-sm font-semibold">Book Introduction</span>
                </div>
                <span className="text-gray-400 text-xs">{expandedChapter === -1 ? '▲' : '▼'}</span>
              </button>
              {expandedChapter === -1 && (
                <div className="bg-gray-50 border border-gray-100 border-t-0 rounded-b-xl p-4">
                  <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-line">{introduction}</p>
                </div>
              )}
            </div>
          )}

          {/* All chapters */}
          <div className="space-y-3 mb-4">
            {chapterDrafts.map((ch) => (
              <div key={ch.number}>
                <button
                  onClick={() => setExpandedChapter(expandedChapter === ch.number ? null : ch.number)}
                  className="w-full text-left bg-white border border-gray-100 rounded-xl p-4 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <span className="bg-gray-100 text-[#F4B942] text-xs font-bold px-2 py-0.5 rounded">CH {ch.number}</span>
                    <span className="text-[#1A1F36] text-sm font-semibold">{ch.title}</span>
                  </div>
                  <span className="text-gray-400 text-xs">{expandedChapter === ch.number ? '▲' : '▼'}</span>
                </button>

                {expandedChapter === ch.number && (
                  <div className="bg-gray-50 border border-gray-100 border-t-0 rounded-b-xl p-4 space-y-4">
                    {ch.quote && (
                      <div className="border-l-4 border-[#F4B942] pl-3">
                        <p className="text-gray-700 text-sm italic leading-relaxed">&ldquo;{ch.quote.text}&rdquo;</p>
                        <p className="text-[#F4B942] text-xs font-semibold mt-1">— {ch.quote.author}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-xs text-[#F4B942] font-bold uppercase tracking-wide mb-1">📖 Introduction</p>
                      <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-line">{ch.story_starter}</p>
                    </div>
                    <div>
                      <p className="text-xs text-blue-500 font-bold uppercase tracking-wide mb-1">💡 Core Lessons</p>
                      <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-line">{ch.core_lessons}</p>
                    </div>
                    {ch.practical_steps?.length > 0 && (
                      <div>
                        <p className="text-xs text-green-600 font-bold uppercase tracking-wide mb-2">🪜 Practical Steps</p>
                        <div className="space-y-2">
                          {ch.practical_steps.map((s) => (
                            <div key={s.step_number} className="bg-white border border-gray-100 rounded-lg p-3">
                              <p className="text-[#1A1F36] text-sm font-semibold">Step {s.step_number}: {s.title}</p>
                              <p className="text-gray-600 text-xs mt-1">{s.what_to_do}</p>
                              <p className="text-gray-400 text-xs mt-1 italic">Why: {s.why_it_matters}</p>
                              <p className="text-red-500 text-xs mt-1">⚠️ {s.common_mistake}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {ch.quick_win && (
                      <div>
                        <p className="text-xs text-[#F4B942] font-bold uppercase tracking-wide mb-2">⚡ Quick Win</p>
                        <div className="bg-[#F4B942]/5 border border-[#F4B942]/20 rounded-lg p-3">
                          <p className="text-[#1A1F36] text-sm font-medium mb-1">{ch.quick_win.goal}</p>
                          <ul className="space-y-0.5">
                            {ch.quick_win.instructions?.map((inst, i) => (
                              <li key={i} className="text-gray-600 text-xs flex gap-2">
                                <span className="text-[#F4B942] font-bold">{i + 1}.</span> {inst}
                              </li>
                            ))}
                          </ul>
                          {ch.quick_win.immediate_result && (
                            <p className="text-green-600 text-xs mt-1 italic">✓ {ch.quick_win.immediate_result}</p>
                          )}
                        </div>
                      </div>
                    )}
                    <div>
                      <p className="text-xs text-purple-500 font-bold uppercase tracking-wide mb-1">🎯 Confidence Close</p>
                      <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-line">{ch.confidence_close}</p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Conclusion */}
          {conclusion && (
            <div className="mb-8">
              <button
                onClick={() => setExpandedChapter(expandedChapter === -2 ? null : -2)}
                className="w-full text-left bg-white border border-gray-100 rounded-xl p-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <span className="bg-gray-100 text-gray-500 text-xs font-bold px-2 py-0.5 rounded">END</span>
                  <span className="text-[#1A1F36] text-sm font-semibold">Conclusion</span>
                </div>
                <span className="text-gray-400 text-xs">{expandedChapter === -2 ? '▲' : '▼'}</span>
              </button>
              {expandedChapter === -2 && (
                <div className="bg-gray-50 border border-gray-100 border-t-0 rounded-b-xl p-4">
                  <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-line">{conclusion}</p>
                </div>
              )}
            </div>
          )}

          <div className="space-y-3">
            <button
              onClick={downloadEbook}
              disabled={downloading}
              className="w-full bg-white text-gray-900 font-bold py-4 rounded-xl text-base border border-gray-300 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {downloading ? '⏳ Generating...' : '⬇ Download as Word Doc (.docx)'}
            </button>
            <button
              onClick={saveEbook}
              disabled={saving}
              className="w-full bg-yellow-400 text-black font-bold py-4 rounded-xl text-base disabled:opacity-50"
            >
              {saving ? '⏳ Saving...' : 'Save & Mark Complete →'}
            </button>
            <button
              onClick={() => setShowStartOverWarning(true)}
              className="w-full text-gray-400 text-sm py-2 underline underline-offset-2 hover:text-red-500 transition-colors"
            >
              Start over with a new e-book
            </button>
          </div>
        </div>
      )}

      {/* ── COMPLETE ── */}
      {step === 'complete' && (
        <div className="flex-1 flex flex-col items-center justify-center px-6 pb-10 text-center">
          <div className="text-6xl mb-6">🎉</div>
          <h2 className="text-2xl font-bold text-[#1A1F36] mb-3">Your E-Book is Ready!</h2>
          <p className="text-[#F4B942] font-semibold text-sm mb-1 max-w-xs">{selectedTitle?.title}</p>
          <p className="text-gray-500 text-xs mb-4 max-w-xs">
            {chapterDrafts.length} chapters written and saved. You&apos;ve just created your first digital product.
          </p>
          <div className="w-full max-w-sm mb-4">
            <ModuleReviewStatus moduleNumber={2} />
          </div>
          <div className="w-full max-w-sm space-y-3 mb-4">
            <button
              onClick={downloadEbook}
              disabled={downloading}
              className="w-full bg-white text-gray-900 font-bold py-4 rounded-xl text-base border border-gray-300 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {downloading ? '⏳ Generating...' : '⬇ Download as Word Doc (.docx)'}
            </button>
            <button
              onClick={() => router.push('/dashboard')}
              className="w-full bg-yellow-400 text-black font-bold py-4 rounded-xl text-base"
            >
              Back to Dashboard
            </button>
          </div>
          <p className="text-gray-600 text-xs max-w-xs">Next: Design a cover in Canva, then list it for sale in Module 3.</p>
        </div>
      )}

      </div>

      {/* ── Start Over Warning Overlay ────────────────────────────────────────── */}
      {showStartOverWarning && (
        <div className="fixed inset-0 z-50 bg-[#1A1F36] flex flex-col">
          <div className="w-full max-w-[430px] md:max-w-xl mx-auto flex flex-col flex-1 px-6 pt-12 pb-10">

            {/* Icon */}
            <div className="text-5xl mb-6 text-center">⚠️</div>

            {/* Headline */}
            <h2 className="text-2xl font-black text-white text-center mb-2 leading-tight">
              Wait — You're About to Delete Everything.
            </h2>
            <p className="text-gray-400 text-sm text-center mb-8 leading-relaxed">
              This will permanently erase your e-book — all chapters, your title, your introduction, and your conclusion. This cannot be undone.
            </p>

            {/* What will be deleted */}
            <div className="bg-red-900/30 border border-red-700/40 rounded-2xl p-4 mb-6">
              <p className="text-xs font-bold text-red-400 uppercase tracking-wide mb-3">What will be deleted</p>
              <div className="flex flex-col gap-2">
                {[
                  `Your title: "${selectedTitle?.title || 'your chosen title'}"`,
                  `${chapterDrafts.length} chapter${chapterDrafts.length !== 1 ? 's' : ''} already written`,
                  'Your introduction and conclusion',
                  'All AI-generated content for this ebook',
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-red-500 text-xs mt-0.5 flex-shrink-0">✕</span>
                    <p className="text-red-200 text-sm">{item}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Reminder about AI's role */}
            <div className="bg-[#F4B942]/10 border border-[#F4B942]/30 rounded-2xl p-4 mb-8">
              <p className="text-xs font-bold text-[#F4B942] uppercase tracking-wide mb-2">A reminder before you decide</p>
              <p className="text-gray-300 text-sm leading-relaxed mb-3">
                AI is your writing partner — not the final author. The raw file it created is your <span className="text-white font-semibold">starting point</span>, not the finished product.
              </p>
              <p className="text-gray-300 text-sm leading-relaxed">
                Download your ebook first. Then add your own stories, your real experiences, your unique voice. That's what makes it yours — and what makes it sellable.
              </p>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-3 mt-auto">
              <button
                onClick={downloadEbook}
                disabled={downloading}
                className="w-full bg-[#F4B942] text-[#1A1F36] font-bold py-4 rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {downloading ? '⏳ Generating...' : '⬇ Download My E-Book First'}
              </button>
              <button
                onClick={() => {
                  setShowStartOverWarning(false)
                  setChapterDrafts([])
                  setTitleOptions([])
                  setChapterOutlines([])
                  setIntroduction('')
                  setConclusion('')
                  setRegenCounts({})
                  setStep('outline')
                }}
                className="w-full bg-red-600/20 border border-red-600/40 text-red-400 font-semibold py-3.5 rounded-xl text-sm hover:bg-red-600/30 transition-colors"
              >
                Yes, delete everything and start over
              </button>
              <button
                onClick={() => setShowStartOverWarning(false)}
                className="w-full text-gray-500 text-sm py-2 hover:text-gray-300 transition-colors"
              >
                No, keep my e-book
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  )
}
