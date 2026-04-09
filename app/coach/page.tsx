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
export default async function CoachDashboard() {
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

  // Load students using admin client to bypass RLS
  const { data: students } = await (isAdmin
    ? adminClient
        .from('profiles')
        .select('id, first_name, full_name, email, enrolled_at, last_active_at, coach_notes, dfy_flagged, access_level, unlocked_modules')
        .eq('role', 'student')
        .order('enrolled_at', { ascending: false })
    : adminClient
        .from('profiles')
        .select('id, first_name, full_name, email, enrolled_at, last_active_at, coach_notes, dfy_flagged, access_level, unlocked_modules')
        .eq('role', 'student')
        .eq('coach_id', user.id)
        .order('enrolled_at', { ascending: false })
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
    { data: salesPages },
    { data: emailSeqs },
    { data: leadMagnets },
    { data: contentPosts },
  ] = await Promise.all([
    adminClient.from('clarity_sentences').select('user_id, created_at').in('user_id', studentIds),
    adminClient.from('ebooks').select('user_id, title, created_at').in('user_id', studentIds).eq('status', 'complete'),
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

      {/* ── Summary Cards ────────────────────────────────── */}
      <div className="px-4 pt-5 pb-2 grid grid-cols-4 gap-2">
        <div className="bg-gray-900 rounded-xl p-3 border border-[#374151]">
          <div className="flex items-center gap-1.5 mb-2">
            <Users size={12} className="text-gray-400" />
            <p className="text-gray-400 text-xs">Total</p>
          </div>
          <p className="text-2xl font-black text-white">{students.length}</p>
        </div>
        <div className="bg-gray-900 rounded-xl p-3 border border-green-900/60">
          <div className="flex items-center gap-1.5 mb-2">
            <TrendingUp size={12} className="text-green-400" />
            <p className="text-gray-400 text-xs">On Track</p>
          </div>
          <p className="text-2xl font-black text-green-400">{counts.green}</p>
        </div>
        <div className="bg-gray-900 rounded-xl p-3 border border-red-900/60">
          <div className="flex items-center gap-1.5 mb-2">
            <AlertTriangle size={12} className="text-red-400" />
            <p className="text-gray-400 text-xs">At Risk</p>
          </div>
          <p className="text-2xl font-black text-red-400">{counts.red + counts.yellow}</p>
        </div>
        <div className="bg-gray-900 rounded-xl p-3 border border-gray-700">
          <div className="flex items-center gap-1.5 mb-2">
            <AlertTriangle size={12} className="text-gray-500" />
            <p className="text-gray-400 text-xs">Ghost</p>
          </div>
          <p className="text-2xl font-black text-gray-400">{counts.ghost}</p>
        </div>
      </div>

      {/* ── DFY Flagged Banner ───────────────────────────── */}
      {students.filter(s => s.dfy_flagged).length > 0 && (
        <div className="mx-4 mt-3 bg-[#1c1500] border border-[#F4B942]/40 rounded-xl px-4 py-3 flex items-center gap-3">
          <Star size={18} className="text-[#F4B942] shrink-0" />
          <div>
            <p className="text-[#F4B942] text-sm font-bold">
              {students.filter(s => s.dfy_flagged).length} student{students.filter(s => s.dfy_flagged).length > 1 ? 's' : ''} flagged for DFY
            </p>
            <p className="text-gray-400 text-xs">Review these students for Done-For-You upsell</p>
          </div>
        </div>
      )}

      {/* ── Student List ─────────────────────────────────── */}
      <div className="flex-1 px-4 pt-4 pb-28">
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
              !!salesMap[student.id]?.length,
              !!emailMap[student.id]?.length,
              !!magnetMap[student.id]?.length,
              !!postsMap[student.id]?.length,
            ],
            ebookTitle: ebookMap[student.id]?.[0]?.title,
          }))}
        />
      </div>
    </div>
  )
}
