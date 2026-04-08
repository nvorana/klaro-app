import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { MODULE_UNLOCK_DAYS } from '@/lib/modules'

export const dynamic = 'force-dynamic'

function formatDate(dateStr: string | null) {
  if (!dateStr) return null
  return new Date(dateStr).toLocaleDateString('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function getPaceStatus(enrolledAt: string | null, completedCount: number): {
  label: string
  sublabel: string
  color: string
  bg: string
  border: string
} {
  if (!enrolledAt) return { label: 'Not Started', sublabel: 'Complete Module 1 to begin.', color: '#9CA3AF', bg: '#111827', border: '#374151' }

  const daysSince = Math.floor((Date.now() - new Date(enrolledAt).getTime()) / 86400000)
  const expectedDone = Object.values(MODULE_UNLOCK_DAYS).filter(d => d <= daysSince).length

  const diff = completedCount - expectedDone

  if (completedCount === 6) return { label: 'Program Complete 🎉', sublabel: 'You\'ve finished all 6 modules. Amazing work!', color: '#34d399', bg: '#064e3b', border: '#10B981' }
  if (diff > 0) return { label: `${diff} Module${diff > 1 ? 's' : ''} Ahead`, sublabel: 'You\'re moving faster than the program schedule. Keep it up!', color: '#F4B942', bg: '#1c1500', border: '#F4B942' }
  if (diff === 0) return { label: 'Right on Track', sublabel: 'You\'re keeping up perfectly with the 8-week schedule.', color: '#34d399', bg: '#064e3b', border: '#10B981' }
  if (diff === -1) return { label: 'Slightly Behind', sublabel: 'One module to catch up. You\'ve got this — keep going.', color: '#F59E0B', bg: '#1c0a00', border: '#92400E' }
  return { label: 'Behind Schedule', sublabel: `${Math.abs(diff)} modules to catch up. Set aside time this week.`, color: '#f87171', bg: '#1a0000', border: '#7f1d1d' }
}

function getMilestones(completedCount: number, enrolledAt: string | null, moduleProgress: { module_number: number, completed_at: string | null }[]) {
  const milestones = [
    {
      id: 'first_step',
      label: 'First Step Taken',
      desc: 'Completed Module 1',
      earned: completedCount >= 1,
      icon: '🚀',
    },
    {
      id: 'halfway',
      label: 'Halfway There',
      desc: 'Completed 3 of 6 modules',
      earned: completedCount >= 3,
      icon: '⚡',
    },
    {
      id: 'almost',
      label: 'Almost There',
      desc: 'Completed 5 of 6 modules',
      earned: completedCount >= 5,
      icon: '🔥',
    },
    {
      id: 'complete',
      label: 'Mission Complete',
      desc: 'Finished all 6 modules',
      earned: completedCount === 6,
      icon: '🏆',
    },
    {
      id: 'fast_starter',
      label: 'Fast Starter',
      desc: 'Finished Module 1 within 3 days of enrolling',
      earned: (() => {
        if (!enrolledAt) return false
        const m1 = moduleProgress.find(m => m.module_number === 1)
        if (!m1?.completed_at) return false
        const days = Math.floor((new Date(m1.completed_at).getTime() - new Date(enrolledAt).getTime()) / 86400000)
        return days <= 3
      })(),
      icon: '⚡',
    },
    {
      id: 'builder',
      label: 'Born Builder',
      desc: 'Completed 3+ modules in your first 2 weeks',
      earned: (() => {
        if (!enrolledAt) return false
        const twoWeeks = new Date(enrolledAt).getTime() + 14 * 86400000
        const doneInTwo = moduleProgress.filter(m => m.completed_at && new Date(m.completed_at).getTime() <= twoWeeks).length
        return doneInTwo >= 3
      })(),
      icon: '🛠️',
    },
  ]
  return milestones
}

export default async function ProgressPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Load everything in parallel
  const [
    { data: profile },
    { data: clarity },
    { data: ebook },
    { data: salesPage },
    { data: emailSeq },
    { data: leadMagnet },
    { count: postsCount },
    { data: moduleProgress },
  ] = await Promise.all([
    supabase.from('profiles').select('full_name, enrolled_at').eq('id', user.id).maybeSingle(),
    supabase.from('clarity_sentences').select('target_market, core_problem, unique_mechanism, full_sentence').eq('user_id', user.id).maybeSingle(),
    supabase.from('ebooks').select('title').eq('user_id', user.id).maybeSingle(),
    supabase.from('sales_pages').select('headline, published_url').eq('user_id', user.id).maybeSingle(),
    supabase.from('email_sequences').select('id').eq('user_id', user.id).maybeSingle(),
    supabase.from('lead_magnets').select('title, format').eq('user_id', user.id).maybeSingle(),
    supabase.from('content_posts').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase.from('module_progress').select('module_number, completed_at, status').eq('user_id', user.id),
  ])

  const completed = [!!clarity, !!ebook, !!salesPage, !!emailSeq, !!leadMagnet, !!(postsCount && postsCount > 0)]
  const completedCount = completed.filter(Boolean).length
  const progressPercent = Math.round((completedCount / 6) * 100)
  const enrolledAt = profile?.enrolled_at as string | null

  const pace = getPaceStatus(enrolledAt, completedCount)
  const progress = moduleProgress || []
  const milestones = getMilestones(completedCount, enrolledAt, progress)

  const getCompletedAt = (moduleNum: number) => {
    const m = progress.find(p => p.module_number === moduleNum)
    return m?.completed_at ? formatDate(m.completed_at) : null
  }

  // Builds data per module
  const builds = [
    {
      num: 1,
      title: 'The Clarity Builder',
      done: !!clarity,
      completedAt: getCompletedAt(1),
      output: clarity ? (
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide font-bold mb-1">Your Market</p>
          <p className="text-sm text-gray-300 leading-relaxed">{clarity.target_market}</p>
          <p className="text-xs text-gray-500 uppercase tracking-wide font-bold mt-3 mb-1">Their Problem</p>
          <p className="text-sm text-gray-300 leading-relaxed">{clarity.core_problem}</p>
          <p className="text-xs text-gray-500 uppercase tracking-wide font-bold mt-3 mb-1">Your Mechanism</p>
          <p className="text-sm text-gray-300 leading-relaxed">{clarity.unique_mechanism}</p>
        </div>
      ) : null,
    },
    {
      num: 2,
      title: 'The Ebook Factory',
      done: !!ebook,
      completedAt: getCompletedAt(2),
      output: ebook ? (
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide font-bold mb-1">Your Ebook Title</p>
          <p className="text-sm text-white font-semibold leading-snug">{ebook.title}</p>
        </div>
      ) : null,
    },
    {
      num: 3,
      title: 'The Offer & Sales Page Builder',
      done: !!salesPage,
      completedAt: getCompletedAt(3),
      output: salesPage ? (
        <div>
          {salesPage.headline && (
            <>
              <p className="text-xs text-gray-500 uppercase tracking-wide font-bold mb-1">Headline</p>
              <p className="text-sm text-white font-semibold leading-snug mb-3">{salesPage.headline}</p>
            </>
          )}
          <div className="flex items-center gap-2">
            {salesPage.published_url ? (
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full" style={{ background: '#064e3b', color: '#34d399' }}>
                ✓ Published
              </span>
            ) : (
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full" style={{ background: '#1c1500', color: '#F4B942' }}>
                Draft — not yet published
              </span>
            )}
          </div>
        </div>
      ) : null,
    },
    {
      num: 4,
      title: 'The 7-Day Email Sequence',
      done: !!emailSeq,
      completedAt: getCompletedAt(4),
      output: emailSeq ? (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-lg flex-shrink-0" style={{ background: '#1c1500', color: '#F4B942' }}>
            7
          </div>
          <div>
            <p className="text-sm text-white font-semibold">Emails written</p>
            <p className="text-xs text-gray-400">Days 1–4 value + Days 5–7 selling</p>
          </div>
        </div>
      ) : null,
    },
    {
      num: 5,
      title: 'The Lead Magnet Builder',
      done: !!leadMagnet,
      completedAt: getCompletedAt(5),
      output: leadMagnet ? (
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide font-bold mb-1">Your Lead Magnet</p>
          <p className="text-sm text-white font-semibold leading-snug mb-2">{leadMagnet.title}</p>
          <span className="text-[10px] font-bold px-2.5 py-1 rounded-full capitalize" style={{ background: '#1c1500', color: '#F4B942' }}>
            {leadMagnet.format?.replace('_', ' ')}
          </span>
        </div>
      ) : null,
    },
    {
      num: 6,
      title: 'The Facebook Content Engine',
      done: !!(postsCount && postsCount > 0),
      completedAt: getCompletedAt(6),
      output: postsCount && postsCount > 0 ? (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-lg flex-shrink-0" style={{ background: '#1c1500', color: '#F4B942' }}>
            {postsCount}
          </div>
          <div>
            <p className="text-sm text-white font-semibold">Facebook posts ready</p>
            <p className="text-xs text-gray-400">Ready to publish and drive conversations</p>
          </div>
        </div>
      ) : null,
    },
  ]

  const earnedMilestones = milestones.filter(m => m.earned)
  const completedBuilds = builds.filter(b => b.done)

  return (
    <div className="min-h-screen bg-gray-950 max-w-[430px] md:max-w-3xl mx-auto flex flex-col">
      <div className="px-4 pt-6 pb-32 flex-1">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-white text-xl font-bold mb-1">Your Progress</h1>
          <p className="text-gray-400 text-sm">Everything you&apos;ve built inside KLARO.</p>
        </div>

        {/* Overall progress bar */}
        <div className="bg-gray-900 rounded-2xl p-4 mb-4" style={{ border: '1px solid #374151' }}>
          <div className="flex items-end justify-between mb-3">
            <div>
              <p className="text-white font-bold text-2xl">{completedCount}<span className="text-gray-500 text-base font-normal">/6</span></p>
              <p className="text-gray-400 text-xs mt-0.5">Modules completed</p>
            </div>
            <p className="text-[#F4B942] font-black text-3xl">{progressPercent}%</p>
          </div>
          <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${progressPercent}%`, background: progressPercent === 100 ? '#10B981' : '#F4B942' }}
            />
          </div>
        </div>

        {/* Pace tracker */}
        <div className="rounded-2xl p-4 mb-6" style={{ background: pace.bg, border: `1px solid ${pace.border}` }}>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: pace.border + '33' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={pace.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
            </div>
            <div>
              <p className="font-bold text-sm" style={{ color: pace.color }}>{pace.label}</p>
              <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{pace.sublabel}</p>
            </div>
          </div>
        </div>

        {/* Your Builds */}
        {completedBuilds.length > 0 && (
          <div className="mb-6">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 pl-1">What You&apos;ve Built</p>
            <div className="space-y-3">
              {builds.map(build => {
                if (!build.done) return null
                return (
                  <div key={build.num} className="bg-gray-900 rounded-2xl p-4" style={{ border: '1px solid #374151' }}>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#10B981' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-bold leading-tight">{build.title}</p>
                        {build.completedAt && (
                          <p className="text-gray-500 text-[10px] mt-0.5">Completed {build.completedAt}</p>
                        )}
                      </div>
                    </div>
                    {build.output && (
                      <div className="pl-11">
                        {build.output}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Milestones */}
        {earnedMilestones.length > 0 && (
          <div className="mb-6">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 pl-1">Milestones Earned</p>
            <div className="grid grid-cols-2 gap-3">
              {milestones.map(m => (
                <div
                  key={m.id}
                  className="rounded-2xl p-3 flex flex-col items-start gap-1.5"
                  style={{
                    background: m.earned ? '#1c1500' : '#111827',
                    border: `1px solid ${m.earned ? '#F4B942' : '#374151'}`,
                    opacity: m.earned ? 1 : 0.4,
                  }}
                >
                  <span className="text-2xl">{m.icon}</span>
                  <p className="text-white text-xs font-bold leading-tight">{m.label}</p>
                  <p className="text-gray-400 text-[10px] leading-snug">{m.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {completedCount === 0 && (
          <div className="text-center py-12">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: '#1c1500' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#F4B942" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
            </div>
            <p className="text-white font-bold mb-1">Nothing here yet</p>
            <p className="text-gray-400 text-sm mb-4">Complete your first module to start tracking your progress.</p>
            <Link
              href="/module/1"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm"
              style={{ background: '#F4B942', color: '#1A1F36' }}
            >
              Start Module 1
            </Link>
          </div>
        )}

      </div>

      {/* Bottom Nav */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] md:max-w-3xl bg-gray-900 border-t border-gray-800 px-2 pt-2.5 pb-6 flex justify-around items-center z-30">
        <Link href="/dashboard" className="flex flex-col items-center gap-1">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
          <span className="text-[10px] font-semibold text-gray-400">Home</span>
        </Link>
        <Link href="/my-work" className="flex flex-col items-center gap-1">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
          </svg>
          <span className="text-[10px] font-semibold text-gray-400">My Work</span>
        </Link>
        <Link href="/progress" className="flex flex-col items-center gap-1">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#F4B942" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
          </svg>
          <span className="text-[10px] font-semibold text-[#F4B942]">Progress</span>
        </Link>
        <Link href="/profile" className="flex flex-col items-center gap-1">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
          </svg>
          <span className="text-[10px] font-semibold text-gray-400">Profile</span>
        </Link>
      </div>
    </div>
  )
}
