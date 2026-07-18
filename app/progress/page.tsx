import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { MODULE_UNLOCK_DAYS } from '@/lib/modules'
import BottomNav from '@/components/BottomNav'

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
  if (!enrolledAt) return { label: 'Not Started', sublabel: 'Complete Module 1 to begin.', color: '#6B7280', bg: '#F3F4F6', border: '#E5E7EB' }

  const daysSince = Math.floor((Date.now() - new Date(enrolledAt).getTime()) / 86400000)
  const expectedDone = Object.values(MODULE_UNLOCK_DAYS).filter(d => d <= daysSince).length

  const diff = completedCount - expectedDone

  if (completedCount === 7) return { label: 'Program Complete', sublabel: 'You\'ve finished all 7 modules. Amazing work!', color: '#059669', bg: '#ECFDF5', border: '#10B981' }
  if (diff > 0) return { label: `${diff} Module${diff > 1 ? 's' : ''} Ahead`, sublabel: 'You\'re moving faster than the program schedule. Keep it up!', color: '#B45309', bg: '#FFFBEB', border: '#F4B942' }
  if (diff === 0) return { label: 'Right on Track', sublabel: 'You\'re keeping up perfectly with the weekly schedule.', color: '#059669', bg: '#ECFDF5', border: '#10B981' }
  if (diff === -1) return { label: 'Slightly Behind', sublabel: 'One module to catch up. You\'ve got this — keep going.', color: '#B45309', bg: '#FFFBEB', border: '#FCD34D' }
  return { label: 'Behind Schedule', sublabel: `${Math.abs(diff)} modules to catch up. Set aside time this week.`, color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' }
}

// SVG line icons for milestones (no text emojis — design rule)
const MilestoneIcons: Record<string, React.ReactNode> = {
  flag: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>
    </svg>
  ),
  zap: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
  ),
  flame: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>
    </svg>
  ),
  trophy: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/>
    </svg>
  ),
  wrench: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
    </svg>
  ),
}

function getMilestones(completedCount: number, enrolledAt: string | null, moduleProgress: { module_number: number, completed_at: string | null }[]) {
  const milestones = [
    {
      id: 'first_step',
      label: 'First Step Taken',
      desc: 'Completed Module 1',
      earned: completedCount >= 1,
      icon: 'flag',
    },
    {
      id: 'halfway',
      label: 'Halfway There',
      desc: 'Completed 4 of 7 modules',
      earned: completedCount >= 4,
      icon: 'zap',
    },
    {
      id: 'almost',
      label: 'Almost There',
      desc: 'Completed 6 of 7 modules',
      earned: completedCount >= 6,
      icon: 'flame',
    },
    {
      id: 'complete',
      label: 'Mission Complete',
      desc: 'Finished all 7 modules',
      earned: completedCount === 7,
      icon: 'trophy',
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
      icon: 'zap',
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
      icon: 'wrench',
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
    { data: offer },
    { data: salesPage },
    { data: emailSeq },
    { data: leadMagnet },
    { count: postsCount },
    { data: moduleProgress },
  ] = await Promise.all([
    supabase.from('profiles').select('full_name, enrolled_at').eq('id', user.id).maybeSingle(),
    supabase.from('clarity_sentences').select('target_market, core_problem, unique_mechanism, full_sentence').eq('user_id', user.id).maybeSingle(),
    supabase.from('ebooks').select('title').eq('user_id', user.id).eq('status', 'complete').maybeSingle(),
    supabase.from('offers').select('offer_statement, ebook_title, selling_price').eq('user_id', user.id).maybeSingle(),
    supabase.from('sales_pages').select('headline, published_url').eq('user_id', user.id).maybeSingle(),
    supabase.from('email_sequences').select('id').eq('user_id', user.id).maybeSingle(),
    supabase.from('lead_magnets').select('title, format').eq('user_id', user.id).maybeSingle(),
    supabase.from('content_posts').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase.from('module_progress').select('module_number, completed_at, status').eq('user_id', user.id),
  ])

  // Same asset-table completion checks the dashboard uses (7 real modules)
  const completed = [!!clarity, !!ebook, !!offer, !!salesPage, !!emailSeq, !!leadMagnet, !!(postsCount && postsCount > 0)]
  const completedCount = completed.filter(Boolean).length
  const progressPercent = Math.round((completedCount / 7) * 100)
  const enrolledAt = profile?.enrolled_at as string | null

  const pace = getPaceStatus(enrolledAt, completedCount)
  const progress = moduleProgress || []
  const milestones = getMilestones(completedCount, enrolledAt, progress)

  const getCompletedAt = (moduleNum: number) => {
    const m = progress.find(p => p.module_number === moduleNum)
    return m?.completed_at ? formatDate(m.completed_at) : null
  }

  // Gold badge pill used on several build outputs
  const goldPill = { background: '#FEF3C7', color: '#B45309' }

  // Builds data per module
  const builds = [
    {
      num: 1,
      title: 'The Clarity Builder',
      done: !!clarity,
      completedAt: getCompletedAt(1),
      output: clarity ? (
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide font-bold mb-1">Your Market</p>
          <p className="text-sm text-gray-600 leading-relaxed">{clarity.target_market}</p>
          <p className="text-xs text-gray-400 uppercase tracking-wide font-bold mt-3 mb-1">Their Problem</p>
          <p className="text-sm text-gray-600 leading-relaxed">{clarity.core_problem}</p>
          <p className="text-xs text-gray-400 uppercase tracking-wide font-bold mt-3 mb-1">Your Mechanism</p>
          <p className="text-sm text-gray-600 leading-relaxed">{clarity.unique_mechanism}</p>
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
          <p className="text-xs text-gray-400 uppercase tracking-wide font-bold mb-1">Your Ebook Title</p>
          <p className="text-sm text-[#1A1F36] font-semibold leading-snug">{ebook.title}</p>
        </div>
      ) : null,
    },
    {
      num: 3,
      title: 'The Irresistible Offer Builder',
      done: !!offer,
      completedAt: getCompletedAt(3),
      output: offer ? (
        <div>
          {offer.offer_statement ? (
            <>
              <p className="text-xs text-gray-400 uppercase tracking-wide font-bold mb-1">Your Offer</p>
              <p className="text-sm text-gray-600 leading-relaxed">{offer.offer_statement}</p>
            </>
          ) : (
            <>
              <p className="text-xs text-gray-400 uppercase tracking-wide font-bold mb-1">Your Offer</p>
              <p className="text-sm text-[#1A1F36] font-semibold leading-snug">{offer.ebook_title}</p>
            </>
          )}
          {!!offer.selling_price && (
            <span className="inline-block mt-2 text-[10px] font-bold px-2.5 py-1 rounded-full" style={goldPill}>
              PHP {offer.selling_price}
            </span>
          )}
        </div>
      ) : null,
    },
    {
      num: 4,
      title: 'The Sales Page Builder',
      done: !!salesPage,
      completedAt: getCompletedAt(4),
      output: salesPage ? (
        <div>
          {salesPage.headline && (
            <>
              <p className="text-xs text-gray-400 uppercase tracking-wide font-bold mb-1">Headline</p>
              <p className="text-sm text-[#1A1F36] font-semibold leading-snug mb-3">{salesPage.headline}</p>
            </>
          )}
          <div className="flex items-center gap-2">
            {salesPage.published_url ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full" style={{ background: '#ECFDF5', color: '#059669' }}>
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                Published
              </span>
            ) : (
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full" style={goldPill}>
                Draft — not yet published
              </span>
            )}
          </div>
        </div>
      ) : null,
    },
    {
      num: 5,
      title: 'The 7-Day Email Sequence',
      done: !!emailSeq,
      completedAt: getCompletedAt(5),
      output: emailSeq ? (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-lg flex-shrink-0" style={goldPill}>
            7
          </div>
          <div>
            <p className="text-sm text-[#1A1F36] font-semibold">Emails written</p>
            <p className="text-xs text-gray-500">Days 1–4 value + Days 5–7 selling</p>
          </div>
        </div>
      ) : null,
    },
    {
      num: 6,
      title: 'The Lead Magnet Builder',
      done: !!leadMagnet,
      completedAt: getCompletedAt(6),
      output: leadMagnet ? (
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide font-bold mb-1">Your Lead Magnet</p>
          <p className="text-sm text-[#1A1F36] font-semibold leading-snug mb-2">{leadMagnet.title}</p>
          <span className="text-[10px] font-bold px-2.5 py-1 rounded-full capitalize" style={goldPill}>
            {leadMagnet.format?.replace('_', ' ')}
          </span>
        </div>
      ) : null,
    },
    {
      num: 7,
      title: 'The Facebook Content Engine',
      done: !!(postsCount && postsCount > 0),
      completedAt: getCompletedAt(7),
      output: postsCount && postsCount > 0 ? (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-lg flex-shrink-0" style={goldPill}>
            {postsCount}
          </div>
          <div>
            <p className="text-sm text-[#1A1F36] font-semibold">Facebook posts ready</p>
            <p className="text-xs text-gray-500">Ready to publish and drive conversations</p>
          </div>
        </div>
      ) : null,
    },
  ]

  const earnedMilestones = milestones.filter(m => m.earned)
  const completedBuilds = builds.filter(b => b.done)

  return (
    <div className="min-h-screen bg-[#F8F9FA] max-w-[430px] md:max-w-3xl mx-auto flex flex-col">
      <div className="px-4 pt-6 pb-32 flex-1">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-[#1A1F36] text-xl font-bold mb-1">Your Progress</h1>
          <p className="text-gray-500 text-sm">Everything you&apos;ve built inside KLARO.</p>
        </div>

        {/* Overall progress bar */}
        <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-4 mb-4">
          <div className="flex items-end justify-between mb-3">
            <div>
              <p className="text-[#1A1F36] font-bold text-2xl">{completedCount}<span className="text-gray-400 text-base font-normal">/7</span></p>
              <p className="text-gray-500 text-xs mt-0.5">Modules completed</p>
            </div>
            <p className="text-[#F4B942] font-black text-3xl">{progressPercent}%</p>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
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
              <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{pace.sublabel}</p>
            </div>
          </div>
        </div>

        {/* Your Builds */}
        {completedBuilds.length > 0 && (
          <div className="mb-6">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 pl-1">What You&apos;ve Built</p>
            <div className="space-y-3">
              {builds.map(build => {
                if (!build.done) return null
                return (
                  <div key={build.num} className="bg-white border border-gray-100 shadow-sm rounded-2xl p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#10B981' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[#1A1F36] text-sm font-bold leading-tight">{build.title}</p>
                        {build.completedAt && (
                          <p className="text-gray-400 text-[10px] mt-0.5">Completed {build.completedAt}</p>
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
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 pl-1">Milestones Earned</p>
            <div className="grid grid-cols-2 gap-3">
              {milestones.map(m => (
                <div
                  key={m.id}
                  className="rounded-2xl p-3 flex flex-col items-start gap-1.5"
                  style={{
                    background: m.earned ? '#FFFBEB' : '#FFFFFF',
                    border: `1px solid ${m.earned ? '#F4B942' : '#E5E7EB'}`,
                    opacity: m.earned ? 1 : 0.5,
                  }}
                >
                  <span style={{ color: m.earned ? '#F4B942' : '#9CA3AF' }}>{MilestoneIcons[m.icon]}</span>
                  <p className="text-[#1A1F36] text-xs font-bold leading-tight">{m.label}</p>
                  <p className="text-gray-500 text-[10px] leading-snug">{m.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {completedCount === 0 && (
          <div className="text-center py-12">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: '#FFFBEB' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#F4B942" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
            </div>
            <p className="text-[#1A1F36] font-bold mb-1">Nothing here yet</p>
            <p className="text-gray-500 text-sm mb-4">Complete your first module to start tracking your progress.</p>
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
      <BottomNav active="progress" />
    </div>
  )
}
