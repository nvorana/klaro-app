import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendModuleUnlockedEmail } from '@/lib/email/sendModuleUnlockedEmail'

// POST /api/coach/unlock-modules
// Body: { studentIds: string[], moduleNumber: number }
// Adds moduleNumber to unlocked_modules array for each student.
//
// Fires a "Module N unlocked" email to each student for whom the module
// was NEWLY unlocked (skipped if the student already had that module
// in their unlocked_modules array — this prevents duplicate emails when
// coach re-clicks the unlock button).

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Verify requester is coach or admin
    const { data: requester } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!requester || !['coach', 'admin'].includes(requester.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { studentIds, moduleNumber } = await request.json()

    if (!studentIds?.length || !moduleNumber) {
      return NextResponse.json({ error: 'Missing studentIds or moduleNumber' }, { status: 400 })
    }

    if (moduleNumber < 1 || moduleNumber > 8) {
      return NextResponse.json({ error: 'Invalid module number' }, { status: 400 })
    }

    const adminClient = createAdminClient()

    // Fetch each student's current unlocked_modules + name/email BEFORE the
    // unlock so we can (a) detect which students actually get the module
    // newly added, and (b) email them without a second lookup afterwards.
    const { data: preState } = await adminClient
      .from('profiles')
      .select('id, email, full_name, first_name, unlocked_modules')
      .in('id', studentIds)

    const preMap = new Map<string, { email: string | null; firstName: string | null; fullName: string | null; hadModule: boolean }>()
    for (const p of preState ?? []) {
      const hadModule = Array.isArray(p.unlocked_modules) && p.unlocked_modules.includes(moduleNumber)
      preMap.set(p.id, {
        email: p.email,
        firstName: p.first_name,
        fullName: p.full_name,
        hadModule,
      })
    }

    // Pass actor + source INTO the RPC so audit context lives in the same
    // transaction as the UPDATE (PgBouncer pooling breaks the two-call pattern).
    const results = await Promise.all(
      studentIds.map((id: string) =>
        adminClient.rpc('unlock_module_for_student', {
          p_student_id: id,
          p_module_number: moduleNumber,
          p_actor: user.id,
          p_source: 'coach_unlock_api',
        })
      )
    )

    // Surface any RPC failures (don't silently return success).
    const failures = results.filter(r => r.error).map(r => r.error?.message)
    if (failures.length > 0) {
      console.error('[unlock-modules] RPC errors:', failures)
      return NextResponse.json(
        { error: 'unlock_failed', detail: failures[0], failures },
        { status: 500 },
      )
    }

    // Fire "Module N unlocked" email ONLY for students where the module was
    // newly added. Skips students who already had it (re-click case) and
    // any student with no email address on file. Sends serially with a
    // small delay to stay under Resend's per-second rate limit.
    let emailsSent = 0
    for (const id of studentIds) {
      const info = preMap.get(id)
      if (!info || !info.email || info.hadModule) continue
      const result = await sendModuleUnlockedEmail({
        email: info.email,
        firstName: info.firstName,
        fullName: info.fullName,
        moduleNumber,
      })
      if (result.sent) emailsSent++
      // 500ms gap between sends to stay well under Resend's 10 req/s limit
      if (studentIds.length > 1) await new Promise(r => setTimeout(r, 500))
    }

    return NextResponse.json({ success: true, updated: studentIds.length, moduleNumber, emails_sent: emailsSent })
  } catch (err) {
    console.error('[unlock-modules]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
