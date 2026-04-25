import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import AdminDashboard from './AdminDashboard'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Only admins can access this page
  const { data: me } = await supabase
    .from('profiles')
    .select('full_name, first_name, role')
    .eq('id', user.id)
    .maybeSingle()

  if (!me || me.role !== 'admin') redirect('/dashboard')

  const adminClient = createAdminClient()

  // ── Fetch all coaches ───────────────────────────────────────────────────────
  const { data: coaches } = await adminClient
    .from('profiles')
    .select('id, full_name, first_name, email, program_type')
    .eq('role', 'coach')
    .order('full_name', { ascending: true })

  // ── Fetch all students ──────────────────────────────────────────────────────
  const { data: students } = await adminClient
    .from('profiles')
    .select('id, full_name, first_name, email, program_type, cohort_batch, access_level, access_suspended, unlocked_modules, enrolled_at, last_active_at, created_at')
    .eq('role', 'student')
    .order('cohort_batch', { ascending: false })

  if (!students || students.length === 0) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-gray-400">No students enrolled yet.</p>
      </div>
    )
  }

  // ── Fetch module completions for all students ───────────────────────────────
  const ids = students.map(s => s.id)

  const [
    { data: clarities },
    { data: ebooks },
    { data: offers },
    { data: salesPages },
    { data: emailSeqs },
    { data: leadMagnets },
    { data: contentPosts },
  ] = await Promise.all([
    adminClient.from('clarity_sentences').select('user_id').in('user_id', ids),
    adminClient.from('ebooks').select('user_id').in('user_id', ids).eq('status', 'complete'),
    adminClient.from('offers').select('user_id').in('user_id', ids),
    adminClient.from('sales_pages').select('user_id').in('user_id', ids),
    adminClient.from('email_sequences').select('user_id').in('user_id', ids),
    adminClient.from('lead_magnets').select('user_id').in('user_id', ids),
    adminClient.from('content_posts').select('user_id').in('user_id', ids),
  ])

  // Build completion map per student
  const completed = (rows: { user_id: string }[] | null) => {
    const set = new Set(rows?.map(r => r.user_id) ?? [])
    return (id: string) => set.has(id)
  }

  const hasClarity   = completed(clarities)
  const hasEbook     = completed(ebooks)
  const hasOffer     = completed(offers)
  const hasSalesPage = completed(salesPages)
  const hasEmail     = completed(emailSeqs)
  const hasMagnet    = completed(leadMagnets)
  const hasPosts     = completed(contentPosts)

  // ── Assemble student records ─────────────────────────────────────────────────
  const enriched = students.map(s => ({
    id:               s.id,
    name:             s.full_name || s.first_name || 'Unknown',
    email:            s.email,
    programType:      (s.program_type as string | null) ?? 'unknown',
    cohortBatch:      (s.cohort_batch as number | null) ?? null,
    accessLevel:      s.access_level as string,
    suspended:        s.access_suspended === true,
    unlockedModules:  (s.unlocked_modules as number[] | null) ?? [],
    enrolledAt:       s.enrolled_at as string | null,
    lastActiveAt:     s.last_active_at as string | null,
    createdAt:        s.created_at as string | null,
    completions:      [
      hasClarity(s.id),
      hasEbook(s.id),
      hasOffer(s.id),
      hasSalesPage(s.id),
      hasEmail(s.id),
      hasMagnet(s.id),
      hasPosts(s.id),
    ],
  }))

  const adminName = me.first_name || me.full_name?.split(' ')[0] || 'Admin'

  const enrichedCoaches = (coaches ?? []).map(c => ({
    id:          c.id,
    name:        c.full_name || c.first_name || 'Coach',
    email:       c.email,
    programType: (c.program_type as string | null) ?? 'unknown',
  }))

  // ── Cohort summaries (for the cohort unlock panel) ──────────────────────
  // Group enrolled, non-suspended students by program_type + cohort_batch.
  // Skip cohorts where the most recent enrollee is more than 60 days old
  // (those are alumni cohorts; no need to manage their unlocks).
  const cohortMap = new Map<string, {
    program_type: 'topis' | 'accelerator'
    cohort_batch: number
    students: typeof enriched
  }>()

  for (const s of enriched) {
    if (s.cohortBatch == null) continue
    if (s.programType !== 'topis' && s.programType !== 'accelerator') continue
    if (s.suspended) continue
    if (s.accessLevel !== 'enrolled') continue  // skip full_access alumni
    const key = `${s.programType}:${s.cohortBatch}`
    if (!cohortMap.has(key)) {
      cohortMap.set(key, {
        program_type: s.programType as 'topis' | 'accelerator',
        cohort_batch: s.cohortBatch,
        students: [],
      })
    }
    cohortMap.get(key)!.students.push(s)
  }

  const cohortSummaries = Array.from(cohortMap.values())
    .map(({ program_type, cohort_batch, students }) => {
      // Find the most-common unlocked_modules pattern
      const counts = new Map<string, { modules: number[]; count: number }>()
      for (const s of students) {
        const key = JSON.stringify(s.unlockedModules)
        const existing = counts.get(key)
        if (existing) existing.count++
        else counts.set(key, { modules: s.unlockedModules, count: 1 })
      }
      const mostCommon = Array.from(counts.values()).sort((a, b) => b.count - a.count)[0]
      return {
        program_type,
        cohort_batch,
        student_count: students.length,
        current_unlocked: mostCommon?.modules ?? [],
      }
    })
    .sort((a, b) => {
      if (a.program_type !== b.program_type) return a.program_type < b.program_type ? -1 : 1
      return b.cohort_batch - a.cohort_batch
    })

  return <AdminDashboard students={enriched} coaches={enrichedCoaches} adminName={adminName} cohortSummaries={cohortSummaries} />
}
