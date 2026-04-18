'use client'

import GoldConfetti from '@/components/GoldConfetti'
import ModuleReviewStatus from '@/app/components/ModuleReviewStatus'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { isModuleUnlockedForStudent, getDaysUntilUnlock } from '@/lib/modules'

type Step = 'settings' | 'posts' | 'complete'
type PostType = 'problem_post' | 'micro_lesson' | 'personal_insight'
type PostCount = 3 | 5

interface Post {
  hook: string
  value: string
  cta: string
  full_post: string
}

interface ClarityData {
  target_market: string
  core_problem: string
  unique_mechanism: string
  full_sentence: string
}

const STEP_LABELS = ['Settings', 'Your Posts']
const STEP_KEYS: Step[] = ['settings', 'posts']

const POST_TYPES: { key: PostType; label: string; description: string }[] = [
  {
    key: 'problem_post',
    label: 'Problem Post',
    description: 'Opens with a pain point your audience deeply relates to. Makes them feel seen without offering a solution in the post.',
  },
  {
    key: 'micro_lesson',
    label: 'Micro Lesson',
    description: 'Teaches one small, practical tip. Short, focused, immediately useful.',
  },
  {
    key: 'personal_insight',
    label: 'Personal Insight',
    description: "Shares a perspective about your audience's world. Shows you truly understand their situation from the inside.",
  },
]

const COUNT_OPTIONS: PostCount[] = [3, 5]

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

const PlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
)

export default function Module6Page() {
  const router = useRouter()
  const [showConfetti, setShowConfetti] = useState(false)
  const [step, setStep] = useState<Step>('settings')
  const [clarity, setClarity] = useState<ClarityData | null>(null)
  const [clarityLoading, setClarityLoading] = useState(true)
  const [error, setError] = useState('')

  // Lock state
  const [locked, setLocked] = useState(false)
  const [daysUntilUnlock, setDaysUntilUnlock] = useState(0)

  // Settings step
  const [selectedType, setSelectedType] = useState<PostType>('problem_post')
  const [selectedCount, setSelectedCount] = useState<PostCount>(5)

  // Posts step
  const [generating, setGenerating] = useState(false)
  const [posts, setPosts] = useState<Post[]>([])
  const [savedPosts, setSavedPosts] = useState<Post[]>([]) // accumulates across sessions
  const [regeneratingIndex, setRegeneratingIndex] = useState<number | null>(null)
  const [copiedLabel, setCopiedLabel] = useState<string | null>(null)
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const currentStepIndex = STEP_KEYS.indexOf(step === 'complete' ? 'posts' : step)

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
        const unlocked = isModuleUnlockedForStudent(profile.unlocked_modules, profile.access_level, profile.enrolled_at, 7)
        if (!unlocked) {
          setDaysUntilUnlock(profile.enrolled_at ? getDaysUntilUnlock(profile.enrolled_at, 7) : 0)
          setLocked(true)
          setClarityLoading(false)
          return
        }
      }

      const { data: clarityData } = await supabase
        .from('clarity_sentences')
        .select('target_market, core_problem, unique_mechanism, full_sentence')
        .eq('user_id', user.id)
        .single()

      if (!clarityData) { router.push('/module/1'); return }
      setClarity(clarityData)

      // Load any previously saved posts
      const { data: postsData } = await supabase
        .from('content_posts')
        .select('hook, value_content, cta, full_post')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(30)

      if (postsData && postsData.length > 0) {
        const restored: Post[] = postsData.map(p => ({
          hook: p.hook || '',
          value: p.value_content || '',
          cta: p.cta || '',
          full_post: p.full_post || '',
        }))
        setSavedPosts(restored)
        setPosts(restored)
        setStep('posts')
      }

      setClarityLoading(false)
    }
    loadData()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Generate Posts ───────────────────────────────────────────
  async function handleGenerate() {
    if (!clarity) return
    setError('')
    setGenerating(true)
    setStep('posts')

    try {
      const res = await fetch('/api/generate/content-posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_market: clarity.target_market,
          problem: clarity.core_problem,
          mechanism: clarity.unique_mechanism,
          post_type: selectedType,
          count: selectedCount,
        }),
      })
      const { data, error: apiErr } = await res.json()
      if (apiErr) throw new Error(apiErr)
      const newPosts: Post[] = data || []
      setPosts(newPosts)
      setExpandedIndex(0)
    } catch {
      setError('Could not generate posts. Please try again.')
      setStep('settings')
    } finally {
      setGenerating(false)
    }
  }

  // ── Regenerate single post ───────────────────────────────────
  async function handleRegeneratePost(index: number) {
    if (!clarity) return
    setRegeneratingIndex(index)
    setError('')
    try {
      const res = await fetch('/api/generate/content-posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_market: clarity.target_market,
          problem: clarity.core_problem,
          mechanism: clarity.unique_mechanism,
          post_type: selectedType,
          count: 1,
        }),
      })
      const { data, error: apiErr } = await res.json()
      if (apiErr) throw new Error(apiErr)
      const replacement = data?.[0]
      if (replacement) {
        setPosts(prev => {
          const updated = [...prev]
          updated[index] = replacement
          return updated
        })
      }
    } catch {
      setError(`Could not regenerate Post ${index + 1}. Please try again.`)
    } finally {
      setRegeneratingIndex(null)
    }
  }

  // ── Copy helpers ─────────────────────────────────────────────
  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text).catch(() => {})
    setCopiedLabel(label)
    setTimeout(() => setCopiedLabel(null), 2000)
  }

  function buildCopyAllText(): string {
    return posts.map((p, i) => `=== POST ${i + 1} ===\n\n${p.full_post}`).join('\n\n')
  }

  // ── Save & Complete ──────────────────────────────────────────
  async function handleMarkComplete() {
    if (!clarity || posts.length === 0) return
    setError('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Insert each post
      const rows = posts.map(p => ({
        user_id: user.id,
        post_type: selectedType,
        hook: p.hook,
        value_content: p.value,
        cta: p.cta,
        full_post: p.full_post,
        created_at: new Date().toISOString(),
      }))

      // Delete old posts first (upsert not available without unique key)
      await supabase.from('content_posts').delete().eq('user_id', user.id)
      await supabase.from('content_posts').insert(rows)

      await supabase.from('module_progress').upsert(
        {
          user_id: user.id,
          module_number: 7,
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
                  className="h-0.5 w-16 mb-4 mx-1"
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
          <h1 className="text-lg font-bold text-[#1A1F36] mb-2">Module 7 — Not Yet Open</h1>
          <p className="text-sm text-gray-500 mb-1">The Facebook Content Engine opens in</p>
          <p className="text-3xl font-black mb-1" style={{ color: '#F4B942' }}>{daysUntilUnlock} {daysUntilUnlock === 1 ? 'day' : 'days'}</p>
          <p className="text-xs text-gray-500 mb-8">Your lead magnet is saved and ready.</p>
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
              <span className="font-bold text-[#1A1F36] text-sm">6</span>
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Module 6</p>
              <h1 className="text-base font-bold text-[#1A1F36]">Facebook Content Engine</h1>
            </div>
          </div>

          <div className="rounded-xl px-4 py-4 mb-5 flex items-start gap-3" style={{ background: '#ecfdf5', border: '1px solid #10B981' }}>
            <div className="w-6 h-6 rounded-full flex items-center justify-center mt-0.5 flex-shrink-0" style={{ background: '#10B981' }}>
              <span className="text-white"><CheckIcon /></span>
            </div>
            <div>
              <p className="font-bold text-emerald-700">Module 6 Complete!</p>
              <p className="text-sm text-emerald-700 mt-0.5">Your Facebook posts are saved and ready to publish.</p>
            </div>
          </div>

          {/* Coach review status (AP students) */}
          <ModuleReviewStatus moduleNumber={7} />

          {/* Post count summary */}
          <div className="bg-white rounded-xl p-4 mb-4 border border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Saved Posts</p>
            <p className="text-2xl font-bold text-[#1A1F36]">{posts.length}</p>
            <p className="text-sm text-gray-500">Facebook posts ready to publish</p>
          </div>

          {/* All done card */}
          <div className="rounded-xl p-5 mb-4" style={{ background: '#1A1F36' }}>
            <div className="w-10 h-10 rounded-full flex items-center justify-center mb-3" style={{ background: '#F4B942' }}>
              <span className="text-[#1A1F36] font-bold text-lg">7/7</span>
            </div>
            <p className="text-white font-bold text-lg mb-1">All 7 Modules Done!</p>
            <p className="text-gray-300 text-sm mb-4">
              You&apos;ve built your complete digital product business — clarity, ebook, offer, sales page, emails, lead magnet, and content. Time to publish and launch.
            </p>
            <button
              onClick={() => router.push('/dashboard')}
              className="w-full py-3 rounded-lg font-bold text-sm"
              style={{ background: '#F4B942', color: '#1A1F36' }}
            >
              Go to Dashboard
            </button>
          </div>
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
              if (step === 'posts' && !generating) setStep('settings')
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
            <h1 className="text-base font-bold text-[#1A1F36]">Facebook Content Engine</h1>
          </div>
        </div>

        <ProgressDots />

        {error && (
          <div className="text-red-600 text-sm rounded-lg px-4 py-3 mb-4" style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>
            {error}
          </div>
        )}

        {/* ── Settings Step ─────────────────────────────────── */}
        {step === 'settings' && (
          <div>
            {clarity && (
              <div className="bg-white rounded-xl p-4 mb-5" style={{ borderTop: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb', borderLeft: '4px solid #F4B942' }}>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Writing for</p>
                <p className="text-sm font-semibold text-gray-700">{clarity.target_market}</p>
              </div>
            )}

            {/* Post type selection */}
            <p className="text-sm font-bold text-[#1A1F36] mb-2">What type of post?</p>
            <div className="space-y-2 mb-5">
              {POST_TYPES.map(type => {
                const isSelected = selectedType === type.key
                return (
                  <button
                    key={type.key}
                    onClick={() => setSelectedType(type.key)}
                    className="w-full text-left rounded-xl p-3 transition-all"
                    style={{
                      background: isSelected ? '#FFFBEB' : 'white',
                      border: `2px solid ${isSelected ? '#F4B942' : '#e5e7eb'}`,
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                        style={{
                          borderColor: isSelected ? '#F4B942' : '#D1D5DB',
                          background: isSelected ? '#F4B942' : 'transparent',
                        }}
                      >
                        {isSelected && (
                          <div className="w-2 h-2 rounded-full bg-white" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[#1A1F36]">{type.label}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{type.description}</p>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Count selection */}
            <p className="text-sm font-bold text-[#1A1F36] mb-2">How many posts?</p>
            <div className="flex gap-3">
              {COUNT_OPTIONS.map(count => {
                const isSelected = selectedCount === count
                return (
                  <button
                    key={count}
                    onClick={() => setSelectedCount(count)}
                    className="flex-1 py-3 rounded-xl font-bold text-sm transition-all"
                    style={{
                      background: isSelected ? '#F4B942' : 'white',
                      color: isSelected ? '#1A1F36' : '#6B7280',
                      border: `2px solid ${isSelected ? '#F4B942' : '#e5e7eb'}`,
                    }}
                  >
                    {count} posts
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Posts Step ────────────────────────────────────── */}
        {step === 'posts' && (
          <div>
            {/* Generating */}
            {generating && (
              <div className="text-center py-16">
                <div className="w-12 h-12 border-4 border-[#F4B942] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-sm font-medium text-[#1A1F36]">Writing {selectedCount} {POST_TYPES.find(t => t.key === selectedType)?.label.toLowerCase()}s…</p>
                <p className="text-xs text-gray-500 mt-1">Making sure each post sounds like a real person, not a marketer</p>
              </div>
            )}

            {/* Posts ready */}
            {!generating && posts.length > 0 && (
              <div>
                {/* Header row */}
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-[#1A1F36]">{posts.length} posts ready</p>
                  <button
                    onClick={() => copyToClipboard(buildCopyAllText(), 'all')}
                    className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
                    style={{
                      background: copiedLabel === 'all' ? '#10B981' : '#1A1F36',
                      color: copiedLabel === 'all' ? 'white' : '#F4B942',
                    }}
                  >
                    <CopyIcon />
                    {copiedLabel === 'all' ? 'Copied!' : 'Copy All'}
                  </button>
                </div>

                {/* Post cards */}
                <div className="space-y-3 mb-4">
                  {posts.map((post, i) => {
                    const isExpanded = expandedIndex === i
                    const isRegenerating = regeneratingIndex === i
                    return (
                      <div
                        key={i}
                        className="bg-white rounded-xl overflow-hidden"
                        style={{ border: `1.5px solid ${isExpanded ? '#F4B942' : '#e5e7eb'}` }}
                      >
                        {/* Card header */}
                        <button
                          onClick={() => setExpandedIndex(isExpanded ? null : i)}
                          className="w-full px-4 py-3 flex items-start gap-3 text-left"
                        >
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-bold"
                            style={{ background: '#F4B942', color: '#1A1F36' }}
                          >
                            {i + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-700 line-clamp-2 leading-snug">
                              {post.hook}
                            </p>
                          </div>
                          <svg
                            width="16" height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="#9CA3AF"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="flex-shrink-0 mt-0.5"
                            style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}
                          >
                            <polyline points="6 9 12 15 18 9" />
                          </svg>
                        </button>

                        {/* Expanded */}
                        {isExpanded && (
                          <div className="px-4 pb-4 border-t" style={{ borderColor: '#F4B942' }}>
                            <div className="flex items-center justify-between pt-3 mb-3">
                              <span
                                className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide"
                                style={{ background: '#FFFBEB', color: '#92400E' }}
                              >
                                {POST_TYPES.find(t => t.key === selectedType)?.label}
                              </span>
                              <div className="flex items-center gap-3">
                                <button
                                  onClick={() => handleRegeneratePost(i)}
                                  disabled={regeneratingIndex !== null}
                                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-[#F4B942] disabled:opacity-40"
                                >
                                  <RefreshIcon />
                                  <span>{isRegenerating ? 'Rewriting…' : 'Rewrite'}</span>
                                </button>
                                <button
                                  onClick={() => copyToClipboard(post.full_post, `post-${i}`)}
                                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-[#1A1F36]"
                                >
                                  <CopyIcon />
                                  <span>{copiedLabel === `post-${i}` ? 'Copied!' : 'Copy'}</span>
                                </button>
                              </div>
                            </div>

                            {isRegenerating ? (
                              <div className="flex items-center gap-2 py-4">
                                <div className="w-4 h-4 border-2 border-[#F4B942] border-t-transparent rounded-full animate-spin" />
                                <p className="text-sm text-gray-500">Rewriting post {i + 1}…</p>
                              </div>
                            ) : (
                              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                                {post.full_post}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Generate more button */}
                <button
                  onClick={() => setStep('settings')}
                  className="w-full py-3 rounded-xl font-semibold text-sm mb-4 flex items-center justify-center gap-2"
                  style={{ background: 'white', color: '#6B7280', border: '2px solid #e5e7eb' }}
                >
                  <PlusIcon />
                  Generate More Posts
                </button>
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
          {step === 'settings' && (
            <button
              onClick={handleGenerate}
              className="w-full py-4 rounded-xl font-bold text-base"
              style={{ background: '#F4B942', color: '#1A1F36' }}
            >
              Generate {selectedCount} {POST_TYPES.find(t => t.key === selectedType)?.label}s
            </button>
          )}

          {step === 'posts' && generating && (
            <div
              className="w-full py-4 rounded-xl font-bold text-base flex items-center justify-center gap-2 opacity-60"
              style={{ background: '#F3F4F6', color: '#9CA3AF' }}
            >
              <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
              Writing your posts…
            </div>
          )}

          {step === 'posts' && !generating && posts.length > 0 && (
            <button
              onClick={handleMarkComplete}
              className="w-full py-4 rounded-xl font-bold text-base"
              style={{ background: '#F4B942', color: '#1A1F36' }}
            >
              Save &amp; Complete Module 6
            </button>
          )}
        </div>
      )}
    </div>
    </>
  )
}
