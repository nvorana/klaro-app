import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendModuleUnlockedEmail } from '@/lib/email/sendModuleUnlockedEmail'

// POST /api/admin/cohort-unlock
// Body: {
//   program_type: 'topis' | 'accelerator',
//   cohort_batch: number,
//   modules: number[],
//   notify?: boolean        // default true — email students about new modules
// }
//
// Sets unlocked_modules to the given array for all enrolled students in
// the specified cohort. Admin-only.
//
// Used by the coach/admin to advance the class to a new module early
// (e.g., 'unlock module 3 for everyone in TOPIS 77').
//
// ── Notifications (added 2026-08-29) ─────────────────────────────────────────
// This route used to change access silently. Students were never told a module
// had opened, because sendModuleUnlockedEmail only fired from
// /api/coach/unlock-modules — so a whole cohort could be advanced and nobody
// would know until they happened to log in. That is exactly what happened to
// six TOPIS 79 students, who had to be emailed by hand.
//
// Now: each student is emailed once about the HIGHEST module newly opened for
// them (mirroring /api/cron/notify-drip-unlocks, which avoids sending three
// emails when three modules open at once), and EVERY newly opened module is
// written to the webhook_logs ledger so the nightly drip cron will not send a
// duplicate later. Students who already had the module are not emailed.
//
// Email failures are non-fatal: the unlock is the important part, and the
// response reports what was and was not sent.
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (me?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 })
  }

  const { program_type, cohort_batch, modules, notify } = await request.json()

  if (!program_type || !['topis', 'accelerator'].includes(program_type)) {
    return NextResponse.json({ error: 'program_type must be topis or accelerator' }, { status: 400 })
  }
  if (typeof cohort_batch !== 'number' || cohort_batch < 1) {
    return NextResponse.json({ error: 'cohort_batch must be a positive number' }, { status: 400 })
  }
  if (!Array.isArray(modules) || modules.length === 0 || modules.some(m => typeof m !== 'number' || m < 1 || m > 7)) {
    return NextResponse.json({ error: 'modules must be a non-empty array of numbers between 1 and 7' }, { status: 400 })
  }

  const sortedUnique = Array.from(new Set(modules)).sort((a, b) => a - b)
  const shouldNotify = notify !== false

  const admin = createAdminClient()

  // Read BEFORE updating so we can tell which modules are genuinely new for
  // each student — without this we would email people about modules they
  // already had.
  const { data: before, error: readError } = await admin
    .from('profiles')
    .select('id, email, first_name, full_name, unlocked_modules')
    .eq('program_type', program_type)
    .eq('cohort_batch', cohort_batch)
    // Include full_access, not just enrolled (fixed 2026-08-29). Payment level
    // does NOT gate module scope: for TOPIS both unlock identically off the
    // drip, and for AP both are driven by unlocked_modules. The old
    // `.eq('access_level','enrolled')` therefore skipped fully-paid students
    // on every cohort advance — 3 of 23 in TOPIS 79. Suspended students are
    // still excluded below, which is the filter that actually matters.
    .in('access_level', ['enrolled', 'full_access'])
    .eq('access_suspended', false)

  if (readError) {
    return NextResponse.json({ error: readError.message }, { status: 500 })
  }

  await admin.rpc('set_audit_context', {
    p_user: user.id,
    p_source: 'cohort_unlock',
  })

  const { data: updated, error } = await admin
    .from('profiles')
    .update({ unlocked_modules: sortedUnique, updated_at: new Date().toISOString() })
    .eq('program_type', program_type)
    .eq('cohort_batch', cohort_batch)
    // Include full_access, not just enrolled (fixed 2026-08-29). Payment level
    // does NOT gate module scope: for TOPIS both unlock identically off the
    // drip, and for AP both are driven by unlocked_modules. The old
    // `.eq('access_level','enrolled')` therefore skipped fully-paid students
    // on every cohort advance — 3 of 23 in TOPIS 79. Suspended students are
    // still excluded below, which is the filter that actually matters.
    .in('access_level', ['enrolled', 'full_access'])
    .eq('access_suspended', false)
    .select('email')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // ── Notify ────────────────────────────────────────────────────────────────
  const notified: Array<{ email: string; module: number }> = []
  const notifyFailed: Array<{ email: string; reason: string }> = []

  if (shouldNotify) {
    for (const student of before ?? []) {
      const had = new Set((student.unlocked_modules as number[] | null) ?? [])
      const newlyOpened = sortedUnique.filter(m => !had.has(m))
      if (newlyOpened.length === 0) continue

      const highest = newlyOpened[newlyOpened.length - 1]
      const result = await sendModuleUnlockedEmail({
        email: student.email as string,
        firstName: student.first_name as string | null,
        fullName: student.full_name as string | null,
        moduleNumber: highest,
        source: 'drip',   // cohort-wide advance reads as "opened for you this week"
      })

      if (result.sent) {
        notified.push({ email: student.email as string, module: highest })
        // Ledger EVERY newly opened module, not just the emailed one, so the
        // nightly drip cron never re-notifies about any of them.
        for (const m of newlyOpened) {
          await admin.from('webhook_logs').insert({
            contact_email: student.email,
            tag_name: 'DRIP_UNLOCK',
            action: 'drip_unlock_email_sent',
            payload: {
              module_number: m,
              source: 'cohort_unlock',
              emailed_module: highest,
              resend_id: result.resendId ?? null,
            },
          })
        }
      } else {
        notifyFailed.push({ email: student.email as string, reason: result.reason ?? 'unknown' })
      }

      // Same pacing as the drip cron — stay well inside Resend's rate limit.
      await new Promise(r => setTimeout(r, 600))
    }
  }

  return NextResponse.json({
    success: true,
    program_type,
    cohort_batch,
    unlocked_modules: sortedUnique,
    students_updated: updated?.length ?? 0,
    students: updated ?? [],
    notified_count: notified.length,
    notified,
    notify_failed: notifyFailed,
  })
}

// Emails are sequential with a 600ms gap, so a large cohort needs headroom.
export const maxDuration = 300
