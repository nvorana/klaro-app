'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createBrowserClient } from '@supabase/ssr'

interface ProjectSummary {
  id: string
  name: string
  market: string
  stepsComplete: number
  totalSteps: number
  steps: { label: string; done: boolean }[]
  lastUpdated: string | null
}

export default function MyWorkPage() {
  const router = useRouter()
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      const uid = session.user.id

      const [clarityRes, ebookRes, salesPageRes] = await Promise.all([
        supabase.from('clarity_sentences').select('target_market, unique_mechanism, full_sentence, created_at').eq('user_id', uid).single(),
        supabase.from('ebooks').select('title, created_at').eq('user_id', uid).order('created_at', { ascending: false }).limit(1).single(),
        supabase.from('sales_pages').select('full_copy, created_at').eq('user_id', uid).single(),
      ])

      const hasClarity = !!clarityRes.data
      const hasEbook = !!ebookRes.data
      const hasSalesPage = !!salesPageRes.data?.full_copy

      if (!hasClarity && !hasEbook) {
        setLoading(false)
        return
      }

      const steps = [
        { label: 'Clarity',    done: hasClarity },
        { label: 'E-Book',     done: hasEbook },
        { label: 'Sales Page', done: hasSalesPage },
        { label: 'Launch',     done: false },
      ]

      const stepsComplete = steps.filter(s => s.done).length

      // Project name: ebook title if available, otherwise derived from market
      const name = ebookRes.data?.title
        || (clarityRes.data?.unique_mechanism ?? 'My First Project')

      const market = clarityRes.data?.target_market ?? ''

      // Most recent update timestamp
      const dates = [clarityRes.data?.created_at, ebookRes.data?.created_at, salesPageRes.data?.created_at].filter(Boolean) as string[]
      const lastUpdated = dates.length ? dates.sort().reverse()[0] : null

      setProjects([{
        id: 'project-1',
        name,
        market,
        stepsComplete,
        totalSteps: 4,
        steps,
        lastUpdated,
      }])

      setLoading(false)
    }
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-gray-500 text-sm animate-pulse">Loading your projects…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      <div className="w-full max-w-[430px] md:max-w-3xl mx-auto flex flex-col min-h-screen pb-28">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="px-6 pt-8 pb-4">
          <button
            onClick={() => router.push('/dashboard')}
            className="text-gray-500 hover:text-gray-300 text-sm mb-5 flex items-center gap-1"
          >
            ← Dashboard
          </button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">My Work</h1>
              <p className="text-gray-500 text-sm mt-0.5">
                {projects.length === 0 ? 'No projects yet.' : `${projects.length} project${projects.length > 1 ? 's' : ''}`}
              </p>
            </div>
            {/* Future: New Project button */}
            <button
              disabled
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold opacity-30 cursor-not-allowed"
              style={{ background: '#1f2937', color: '#9CA3AF', border: '1px solid #374151' }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              New Project
            </button>
          </div>
        </div>

        {/* ── Empty state ─────────────────────────────────────────────────── */}
        {projects.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center px-6 text-center pb-20">
            <div className="text-4xl mb-4">✦</div>
            <h2 className="text-lg font-bold text-white mb-2">No projects yet</h2>
            <p className="text-gray-500 text-sm mb-6 max-w-xs">
              Start Module 1 to create your first digital product project.
            </p>
            <button
              onClick={() => router.push('/module/1')}
              className="bg-yellow-400 text-black font-bold px-6 py-3 rounded-xl text-sm"
            >
              Start Module 1 →
            </button>
          </div>
        )}

        {/* ── Project list ────────────────────────────────────────────────── */}
        <div className="px-6 space-y-3">
          {projects.map(project => (
            <button
              key={project.id}
              onClick={() => router.push('/my-work/detail')}
              className="w-full text-left bg-gray-900 border border-gray-800 rounded-2xl p-5 hover:border-gray-700 transition-all active:scale-[0.99]"
            >
              {/* Top row: name + arrow */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <p className="text-white font-bold text-base leading-snug truncate">{project.name}</p>
                  {project.market && (
                    <p className="text-gray-500 text-xs mt-0.5 truncate">For: {project.market}</p>
                  )}
                </div>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 mt-0.5">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </div>

              {/* Step dots */}
              <div className="flex items-center gap-2 mb-3">
                {project.steps.map((step, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: step.done ? '#F4B942' : '#374151' }}
                    />
                    <span className="text-[10px] font-medium" style={{ color: step.done ? '#F4B942' : '#6B7280' }}>
                      {step.label}
                    </span>
                    {i < project.steps.length - 1 && (
                      <div className="w-3 h-px bg-gray-800 ml-0.5" />
                    )}
                  </div>
                ))}
              </div>

              {/* Footer: progress + date */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-24 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${(project.stepsComplete / project.totalSteps) * 100}%`,
                        background: '#F4B942',
                      }}
                    />
                  </div>
                  <span className="text-xs text-gray-500">
                    {project.stepsComplete} of {project.totalSteps} steps
                  </span>
                </div>
                {project.lastUpdated && (
                  <span className="text-[10px] text-gray-700">
                    {new Date(project.lastUpdated).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>

      </div>

      {/* ── Bottom Nav ────────────────────────────────────────────────────── */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] md:max-w-3xl bg-gray-900 border-t border-gray-800 px-2 pt-2.5 pb-6 flex justify-around items-center z-30">
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
      </div>
    </div>
  )
}
