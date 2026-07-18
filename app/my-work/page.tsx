'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import BottomNav from '@/components/BottomNav'

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
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center">
        <p className="text-gray-500 text-sm animate-pulse">Loading your projects…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#1F2937] flex flex-col">
      <div className="w-full max-w-[430px] md:max-w-3xl mx-auto flex flex-col min-h-screen pb-28">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="px-6 pt-8 pb-4">
          <button
            onClick={() => router.push('/dashboard')}
            className="text-gray-500 hover:text-[#1A1F36] text-sm mb-5 flex items-center gap-1"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            Dashboard
          </button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-[#1A1F36]">My Work</h1>
              <p className="text-gray-500 text-sm mt-0.5">
                {projects.length === 0 ? 'No projects yet.' : `${projects.length} project${projects.length > 1 ? 's' : ''}`}
              </p>
            </div>
            {/* Future: New Project button */}
            <button
              disabled
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold opacity-40 cursor-not-allowed bg-white text-gray-500 border border-gray-200"
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
            <div className="mb-4">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#F4B942" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
            </div>
            <h2 className="text-lg font-bold text-[#1A1F36] mb-2">No projects yet</h2>
            <p className="text-gray-500 text-sm mb-6 max-w-xs">
              Start Module 1 to create your first digital product project.
            </p>
            <button
              onClick={() => router.push('/module/1')}
              className="bg-[#F4B942] text-[#1A1F36] font-bold px-6 py-3 rounded-xl text-sm inline-flex items-center gap-1.5"
            >
              Start Module 1
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>
          </div>
        )}

        {/* ── Project list ────────────────────────────────────────────────── */}
        <div className="px-6 space-y-3">
          {projects.map(project => (
            <button
              key={project.id}
              onClick={() => router.push('/my-work/detail')}
              className="w-full text-left bg-white border border-gray-100 shadow-sm rounded-2xl p-5 hover:border-gray-200 transition-all active:scale-[0.99]"
            >
              {/* Top row: name + arrow */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <p className="text-[#1A1F36] font-bold text-base leading-snug truncate">{project.name}</p>
                  {project.market && (
                    <p className="text-gray-500 text-xs mt-0.5 truncate">For: {project.market}</p>
                  )}
                </div>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 mt-0.5">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </div>

              {/* Step dots */}
              <div className="flex items-center gap-2 mb-3">
                {project.steps.map((step, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: step.done ? '#F4B942' : '#D1D5DB' }}
                    />
                    <span className="text-[10px] font-medium" style={{ color: step.done ? '#F4B942' : '#9CA3AF' }}>
                      {step.label}
                    </span>
                    {i < project.steps.length - 1 && (
                      <div className="w-3 h-px bg-gray-200 ml-0.5" />
                    )}
                  </div>
                ))}
              </div>

              {/* Footer: progress + date */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-24 bg-gray-100 rounded-full overflow-hidden">
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
                  <span className="text-[10px] text-gray-400">
                    {new Date(project.lastUpdated).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>

      </div>

      {/* ── Bottom Nav ────────────────────────────────────────────────────── */}
      <BottomNav active="my-work" />
    </div>
  )
}
