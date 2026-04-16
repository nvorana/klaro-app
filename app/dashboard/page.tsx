import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { MODULE_INFO, isModuleUnlockedForStudent, getDaysUntilUnlock } from '@/lib/modules'
import SignOutButton from './SignOutButton'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createClient()

  // ── Auth ─────────────────────────────────────────────────
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // ── Profile ───────────────────────────────────────────────
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, access_level, enrolled_at, unlocked_modules, access_suspended, created_at, program_type')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile || profile.access_level === 'pending') redirect('/signup')

  // Track last login — update last_active_at on every dashboard visit
  await supabase.from('profiles').update({ last_active_at: new Date().toISOString() }).eq('id', user.id)

  const accessLevel = profile.access_level as string
  const unlockedModules = profile.unlocked_modules as number[] | null

  // ── Module completion ─────────────────────────────────────
  const [
    { data: clarity },
    { data: ebook },
    { data: offer },
    { data: salesPage },
    { data: emailSeq },
    { data: leadMagnet },
    { data: contentPost },
  ] = await Promise.all([
    supabase.from('clarity_sentences').select('id').eq('user_id', user.id).maybeSingle(),
    supabase.from('ebooks').select('id').eq('user_id', user.id).eq('status', 'complete').maybeSingle(),
    supabase.from('offers').select('id').eq('user_id', user.id).maybeSingle(),
    supabase.from('sales_pages').select('id').eq('user_id', user.id).maybeSingle(),
    supabase.from('email_sequences').select('id').eq('user_id', user.id).maybeSingle(),
    supabase.from('lead_magnets').select('id').eq('user_id', user.id).maybeSingle(),
    supabase.from('content_posts').select('id').eq('user_id', user.id).maybeSingle(),
  ])

  const completed = [!!clarity, !!ebook, !!offer, !!salesPage, !!emailSeq, !!leadMagnet, !!contentPost]
  const completedCount = completed.filter(Boolean).length
  const progressPercent = Math.round((completedCount / 7) * 100)

  // ── Reviews (AP students only) ────────────────────────────
  const isAP = profile.program_type === 'accelerator'
  let reviewMap: Record<number, { status: string; note: string | null }> = {}
  if (isAP) {
    const { data: reviews } = await supabase
      .from('module_reviews')
      .select('module_number, status, note')
      .eq('student_id', user.id)
    for (const r of reviews ?? []) {
      reviewMap[r.module_number] = { status: r.status, note: r.note }
    }
  }

  // ── Week calculation ──────────────────────────────────────
  const enrolledAt = profile.enrolled_at as string | null
  let currentWeek = 1
  if (enrolledAt) {
    const daysSince = Math.floor((Date.now() - new Date(enrolledAt).getTime()) / 86400000)
    currentWeek = Math.min(8, Math.max(1, Math.floor(daysSince / 7) + 1))
  }

  // ── Names ─────────────────────────────────────────────────
  const firstName = (profile.full_name as string | null)?.split(' ')[0] ?? 'Student'
  const initial = firstName[0].toUpperCase()

  // ── Next step module ──────────────────────────────────────
  let nextStepModule = -1
  for (let i = 0; i < 7; i++) {
    const unlocked = isModuleUnlockedForStudent(unlockedModules, accessLevel, enrolledAt, i + 1)
    if (unlocked && !completed[i]) {
      nextStepModule = i + 1
      break
    }
  }

  // ── Suspended account screen ───────────────────────────────
  if (profile.access_suspended) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex flex-col max-w-[430px] md:max-w-3xl mx-auto">

        {/* Header */}
        <div className="bg-[#1A1F36] px-5 pt-4 pb-5 flex items-center justify-between">
          <img src="/Klaro_Logo-cropped.png" alt="KLARO" className="h-10 w-auto" />
          <div className="flex items-center gap-3">
            <span className="text-white/60 text-sm font-medium">{firstName}</span>
            <div className="w-9 h-9 rounded-full bg-[#F4B942] flex items-center justify-center text-[#1A1F36] text-sm font-bold">
              {initial}
            </div>
            <SignOutButton />
          </div>
        </div>

        {/* Suspension message */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 text-center">

          {/* Lock icon */}
          <div className="w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center mb-6">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#C49A00" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-[#1A1F36] mb-3 leading-tight">
            Your account is temporarily on hold.
          </h1>

          <p className="text-gray-500 text-sm leading-relaxed mb-6 max-w-xs">
            Hi {firstName}, it looks like there&apos;s an outstanding balance on your account. To protect your progress, we&apos;ve placed a temporary hold on your access.
          </p>

          {/* Saved work card */}
          <div className="w-full bg-white border border-gray-100 rounded-2xl px-5 py-4 mb-6 text-left shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              <span className="text-sm font-semibold text-[#1A1F36]">Your work is safe</span>
            </div>
            <p className="text-gray-500 text-sm leading-relaxed">
              Everything you&apos;ve built inside KLARO — your clarity sentence, your ebook, your content — is saved and waiting for you. Nothing has been deleted. The moment your balance is settled, your access will be fully restored.
            </p>
          </div>

          <p className="text-gray-400 text-xs">
            Already paid? Email us at{' '}
            <a href="mailto:jon@negosyouniversity.com" className="text-[#1A1F36] underline underline-offset-2">
              jon@negosyouniversity.com
            </a>{' '}
            and we&apos;ll restore your access right away.
          </p>

        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col max-w-[430px] md:max-w-3xl mx-auto relative">

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="bg-[#1A1F36] px-5 pt-4 pb-0 flex items-center justify-between flex-shrink-0">
        {/* Logo */}
        <img src="/Klaro_Logo-cropped.png" alt="KLARO" className="h-10 w-auto" />
        {/* Avatar + sign out */}
        <div className="flex items-center gap-3">
          <span className="text-white/60 text-sm font-medium">{firstName}</span>
          <div className="w-9 h-9 rounded-full bg-[#F4B942] flex items-center justify-center text-[#1A1F36] text-sm font-bold">
            {initial}
          </div>
          <SignOutButton />
        </div>
      </div>

      {/* ── Welcome section ────────────────────────────────── */}
      <div className="bg-[#1A1F36] px-5 pt-4 pb-7">
        <h1 className="text-white text-xl font-bold mb-1">Welcome back, {firstName}!</h1>
        <p className="text-white/50 text-xs mb-3">Keep going — you&apos;re making real progress.</p>

        {/* Week badge */}
        <div className="inline-flex items-center gap-1.5 bg-[#F4B942] text-[#1A1F36] text-xs font-bold px-3 py-1.5 rounded-full mb-4">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#1A1F36" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
          </svg>
          Week {currentWeek} of 8
        </div>

        {/* Progress bar */}
        <div className="h-1.5 bg-white/15 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#F4B942] rounded-full transition-all"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="flex justify-between mt-1.5">
          <span className="text-white/40 text-[11px]">{completedCount} of 7 modules done</span>
          <span className="text-white/40 text-[11px]">{progressPercent}%</span>
        </div>
      </div>

      {/* ── Payment reminder (enrolled only) ───────────────── */}
      {profile.access_level === 'enrolled' && (
        <div className="mx-4 mt-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-3">
          <svg className="flex-shrink-0 mt-0.5" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <p className="text-amber-700 text-xs leading-relaxed">
            <span className="font-bold">Complete your payment</span> to unlock all 7 modules and secure full access to KLARO.
          </p>
        </div>
      )}

      {/* ── Module cards ───────────────────────────────────── */}
      <div className="flex-1 px-4 pt-5 pb-28">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 pl-1">Your Modules</p>

        {MODULE_INFO.map((mod, i) => {
          const moduleNum = mod.number
          const isCompleted = completed[i]
          const unlocked = isModuleUnlockedForStudent(unlockedModules, accessLevel, enrolledAt, moduleNum)
          const daysLeft = !unlocked && enrolledAt ? getDaysUntilUnlock(enrolledAt, moduleNum) : 0
          const isNext = moduleNum === nextStepModule

          return (
            <div key={moduleNum}>
              {/* "Your next step" nudge */}
              {isNext && (
                <div className="flex items-center gap-1.5 pl-1 mb-1.5">
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="#F4B942">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                  </svg>
                  <span className="text-[10px] font-bold text-[#F4B942] uppercase tracking-wide">Your next step</span>
                </div>
              )}

              {/* Card */}
              <div className={`
                bg-white rounded-2xl px-4 py-3.5 mb-3 flex items-center gap-3.5
                border-[1.5px] shadow-sm
                ${isCompleted ? 'border-green-100' : ''}
                ${isNext ? 'border-[#F4B942] shadow-[0_2px_12px_rgba(244,185,66,0.2)]' : ''}
                ${!isCompleted && !isNext && unlocked ? 'border-transparent' : ''}
                ${!unlocked ? 'border-transparent opacity-55' : ''}
              `}>

                {/* Number / status badge */}
                <div className={`
                  w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-black text-base
                  ${isCompleted ? 'bg-green-50' : ''}
                  ${isNext || (unlocked && !isCompleted) ? 'bg-[#1A1F36]' : ''}
                  ${!unlocked ? 'bg-gray-100' : ''}
                `}>
                  {isCompleted ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  ) : unlocked ? (
                    <span className="text-[#F4B942]">{moduleNum}</span>
                  ) : (
                    <span className="text-gray-400">{moduleNum}</span>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-bold truncate ${!unlocked ? 'text-gray-400' : 'text-[#1A1F36]'}`}>
                    {mod.title}
                  </p>
                  <p className="text-xs text-gray-400 truncate mt-0.5">{mod.description}</p>
                </div>

                {/* Action */}
                <div className="flex-shrink-0 flex flex-col items-end gap-1">
                  {/* Review status badge (AP students only) */}
                  {isAP && isCompleted && reviewMap[moduleNum] && (
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                      reviewMap[moduleNum].status === 'approved'
                        ? 'bg-emerald-50 text-emerald-600'
                        : reviewMap[moduleNum].status === 'needs_revision'
                        ? 'bg-amber-50 text-amber-600'
                        : 'bg-blue-50 text-blue-600'
                    }`}>
                      {reviewMap[moduleNum].status === 'approved' ? 'Approved' :
                       reviewMap[moduleNum].status === 'needs_revision' ? 'Revise' :
                       'In Review'}
                    </span>
                  )}
                  {isAP && isCompleted && !reviewMap[moduleNum] && (
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                      Pending Review
                    </span>
                  )}
                  {isCompleted && (
                    <Link href={`/module/${moduleNum}`}>
                      <span className="flex items-center gap-1 bg-green-50 text-[#10B981] text-xs font-bold px-3 py-2 rounded-xl">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                        </svg>
                        View
                      </span>
                    </Link>
                  )}
                  {!isCompleted && unlocked && (
                    <Link href={`/module/${moduleNum}`}>
                      <span className="flex items-center gap-1 bg-[#F4B942] text-[#1A1F36] text-xs font-bold px-3 py-2 rounded-xl">
                        Start
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#1A1F36" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="9 18 15 12 9 6"/>
                        </svg>
                      </span>
                    </Link>
                  )}
                  {!unlocked && (
                    <div className="flex flex-col items-center gap-1 w-20">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                      </svg>
                      <span className="text-[9.5px] text-gray-400 font-semibold text-center leading-tight">
                        Unlocks in {daysLeft} {daysLeft === 1 ? 'day' : 'days'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Bottom Nav ─────────────────────────────────────── */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] md:max-w-3xl bg-gray-900 border-t border-gray-800 px-2 pt-2.5 pb-6 flex justify-around items-center z-30">

        {/* Home — active */}
        <Link href="/dashboard" className="flex flex-col items-center gap-1">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#F4B942" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
          <span className="text-[10px] font-semibold text-[#F4B942]">Home</span>
        </Link>

        {/* My Work */}
        <Link href="/my-work" className="flex flex-col items-center gap-1">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
          </svg>
          <span className="text-[10px] font-semibold text-gray-400">My Work</span>
        </Link>

        {/* Progress */}
        <Link href="/progress" className="flex flex-col items-center gap-1">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
          </svg>
          <span className="text-[10px] font-semibold text-gray-400">Progress</span>
        </Link>

        {/* Profile */}
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
