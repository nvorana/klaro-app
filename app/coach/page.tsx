import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  Users, TrendingUp, AlertTriangle, Star,
  Target, BookOpen, DollarSign, Mail, Gift, Megaphone,
  ChevronRight, Clock, CheckCircle2, MessageSquare
} from 'lucide-react'
import CoachSignOut from './CoachSignOut'
import CoachStudentList from './CoachStudentList'

export const dynamic = 'force-dynamic'

// ── Helpers ───────────────────────────────────────────────
function daysSince(dateStr: string | null): number {
  if (!dateStr) return 999
  const diff = Date.now() - new Date(dateStr).getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

function getStatus(days: number): 'green' | 'yellow' | 'red' | 'ghost' {
  if (days <= 2) return 'green'
  if (days <= 5) return 'yellow'
  if (days <= 9) return 'red'
  return 'ghost'
}

function currentModule(completions: boolean[]): number {
  const idx = completions.findIndex(c => !c)
  return idx === -1 ? 6 : idx
}

const MODULE_NAMES = [
  'Clarity Builder',
  'Ebook Factory',
  'Sales Page Builder',
  'Email Sequence',
  'Lead Magnet',
  'Facebook Content',
]

const MODULE_ICONS = [Target, BookOpen, DollarSign, Mail, Gift, Megaphone]

const STATUS_CONFIG = {
  green: {
    label: 'On Track',
    dot: 'bg-green-400',
    badge: 'bg-green-900/40 text-green-400 border border-green-800',
    message: 'Nice progress. Continue and finish this week.',
  },
  yellow: {
    label: 'At Risk',
    dot: 'bg-yellow-400',
    badge: 'bg-yellow-900/40 text-yellow-400 border border-yellow-800',
    message: "I noticed slow progress. What's blocking you?",
  },
  red: {
    label: 'Disengaged',
    dot: 'bg-red-400',
    badge: 'bg-red-900/40 text-red-400 border border-red-800',
    message: "I noticed inactivity. What's stopping you right now?",
  },
  ghost: {
    label: 'Ghost',
    dot: 'bg-gray-500',
    badge: 'bg-gray-800 text-gray-400 border border-gray-700',
    message: "We haven't heard from you in a while. Are you still in? Reply with one word: YES or HELP.",
  },
}

// ── Page ──────────────────────────────────────────────────
export default async function CoachDashboard({
  searchParams,
}: {
  searchParams: Promise<{ as_coach?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Verify coach or admin role
  const { data: coachProfile } = await supabase
    .from('profiles')
    .select('full_name, first_name, role')
    .eq('id', user.id)
    .maybeSingle()

  if (!coachProfile || !['coach', 'admin'].includes(coachProfile.role ?? '')) {
    redirect('/dashboard')
  }

  const isAdmin = coachProfile.role === 'admin'
  const adminClient = createAdminClient()

  // Admin impersonation: ?as_coach=<coach_id> filters to that coach's students
  const params = await searchParams
  const impersonatedCoachId = isAdmin && params.as_coach ? params.as_coach : null

  // Load all coaches (admin only — for the impersonation dropdown)
  const { data: allCoaches } = isAdmin
    ? await adminClient.from('profiles').select('id, full_name, email').eq('role', 'coach').order('full_name')
    : { data: null }

  const impersonatedCoach = impersonatedCoachId
    ? (allCoaches ?? []).find(c => c.id === impersonatedCoachId) ?? null
    : null

  // Load students using admin client to bypass RLS
  // - If admin impersonating a coach: filter to that coach's students
  // - If admin not impersonating: show all students
  // - If coach: show only their own students
  const studentQuery = adminClient
    .from('profiles')
    .select('id, first_name, full_name, email, enrolled_at, last_active_at, coach_notes, dfy_flagged, access_level, unlocked_modules, program_type, coach_id')
    .eq('role', 'student')
    .order('enrolled_at', { ascending: false })

  const { data: students } = await (
    impersonatedCoachId
      ? studentQuery.eq('coach_id', impersonatedCoachId)
      : isAdmin
        ? studentQuery
        : studentQuery.eq('coach_id', user.id)
  )

  if (!students || students.length === 0) {
    return (
      <div className="min-h-screen bg-gray-950 max-w-[430px] md:max-w-3xl mx-auto flex flex-col items-center justify-center px-6">
        <div className="text-center">
          <div className="text-4xl mb-4">👋</div>
          <h1 className="text-white text-xl font-bold mb-2">No students yet</h1>
          <p className="text-gray-400 text-sm">Students assigned to you will appear here once they enroll.</p>
        </div>
      </div>
    )
  }

  // Load module completions for all students in parallel
  const studentIds = students.map(s => s.id)

  const [
    { data: clarities },
    { data: ebooks },
    { data: offers },
    { data: salesPages },
    { data: emailSeqs },
    { data: leadMagnets },
    { data: contentPosts },
  ] = await Promise.all([
    adminClient.from('clarity_sentences').select('user_id, created_at').in('user_id', studentIds),
    adminClient.from('ebooks').select('user_id, title, created_at').in('user_id', studentIds).eq('status', 'complete'),
    adminClient.from('offers').select('user_id, created_at').in('user_id', studentIds),
    adminClient.from('sales_pages').select('user_id, headline, created_at').in('user_id', studentIds),
    adminClient.from('email_sequences').select('user_id, created_at').in('user_id', studentIds),
    adminClient.from('lead_magnets').select('user_id, title, created_at').in('user_id', studentIds),
    adminClient.from('content_posts').select('user_id, created_at').in('user_id', studentIds),
  ])

  // Build a map per student
  const byUser = (rows: any[] | null, key: string = 'user_id') => {
    const map: Record<string, any[]> = {}
    for (const row of rows ?? []) {
      if (!map[row[key]]) map[row[key]] = []
      map[row[key]].push(row)
    }
    return map
  }

  const clarityMap  = byUser(clarities)
  const ebookMap    = byUser(ebooks)
  const offerMap    = byUser(offers)
  const salesMap    = byUser(salesPages)
  const emailMap    = byUser(emailSeqs)
  const magnetMap   = byUser(leadMagnets)
  const postsMap    = byUser(contentPosts)

  // Count by status
  const counts = { green: 0, yellow: 0, red: 0, ghost: 0 }
  students.forEach(s => {
    const days = daysSince(s.last_active_at ?? s.enrolled_at)
    counts[getStatus(days)]++
  })

  const firstName = coachProfile.first_name || coachProfile.full_name?.split(' ')[0] || 'Coach'

  return (
    <div className="min-h-screen bg-gray-950 max-w-[430px] md:max-w-3xl mx-auto flex flex-col">

      {/* ── Header ───────────────────────────────────────── */}
      <div className="bg-[#1A1F36] px-5 pt-5 pb-5 flex items-center justify-between">
        <div>
          <img src="/Klaro_Logo-cropped.png" alt="KLARO" className="h-10 w-auto mb-1" />
          <p className="text-gray-400 text-xs">Coach Dashboard</p>
        </div>
        <div className="text-right flex flex-col items-end gap-1.5">
          <p className="text-white text-sm font-semibold">{firstName}</p>
          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#F4B942] text-[#1A1F36]">
            {isAdmin ? 'Admin' : 'Coach'}
          </span>
          <CoachSignOut />
        </div>
      </div>

      {/* ── Admin Impersonation Bar ───────────────────────── */}
      {isAdmin && (
        <div className="bg-purple-950/60 border-b border-purple-800/60 px-5 py-3">
          {impersonatedCoach ? (
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-purple-300">👁️ Viewing as:</span>
                <span className="text-white font-semibold">{impersonatedCoach.full_name}</span>
                <span className="text-purple-400 text-xs">({impersonatedCoach.email})</span>
              </div>
              <Link
                href="/coach"
                className="text-xs font-bold bg-purple-800 hover:bg-purple-700 text-white px-3 py-1.5 rounded-lg transition-colors"
              >
                Exit
              </Link>
            </div>
          ) : (
            <form action="/coach" method="GET" className="flex items-center gap-2">
              <label className="text-xs text-purple-300 font-medium">View as coach:</label>
              <select
                name="as_coach"
                defaultValue=""
                className="flex-1 bg-purple-900/60 border border-purple-700 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-purple-400"
              >
                <option value="">— Select a coach —</option>
                {(allCoaches ?? []).map(c => (
                  <option key={c.id} value={c.id}>
                    {c.full_name || c.email}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white px-3 py-1.5 rounded-lg transition-colors"
              >
                View
              </button>
            </form>
          )}
        </div>
      )}

      {/* ── Student List (tabs + summary cards are inside the client component) ── */}
      <div className="flex-1 px-4 pt-5 pb-28">
        <CoachStudentList
          students={students.map(student => ({
            id: student.id,
            full_name: student.full_name,
            first_name: student.first_name,
            email: student.email,
            access_level: student.access_level,
            dfy_flagged: student.dfy_flagged,
            last_active_at: student.last_active_at,
            enrolled_at: student.enrolled_at,
            unlocked_modules: student.unlocked_modules,
            completions: [
              !!clarityMap[student.id]?.length,
              !!ebookMap[student.id]?.length,
              !!offerMap[student.id]?.length,
              !!salesMap[student.id]?.length,
              !!emailMap[student.id]?.length,
              !!magnetMap[student.id]?.length,
              !!postsMap[student.id]?.length,
            ],
            ebookTitle: ebookMap[student.id]?.[0]?.title,
            program_type: student.program_type,
          }))}
        />
      </div>
    </div>
  )
}
