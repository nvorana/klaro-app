// NOT SCHEDULED (2026-07-18): the team sends payment reminders manually, so
// this cron has no vercel.json entry. The route is kept functional — it can
// be triggered manually with ?secret=<CRON_SECRET>, or re-scheduled later by
// adding it back to vercel.json. The dashboard countdown banner stays live.

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendPaymentReminder } from '@/lib/email/sendPaymentReminder'
import { daysUntilDue } from '@/lib/paymentSchedule'

// ── /api/cron/notify-payment-due ─────────────────────────────────────────────
//
// Daily friendly payment reminder for installment students (runs 09:00 Manila).
// This is the FRIENDLY layer of the collection ladder. Suspension for overdue
// balances is handled elsewhere; this cron never touches access.
//
// Who gets it:
//   - next_payment_due_at IS NOT NULL (an installment is still owed)
//   - access_level = 'enrolled', program_type in (accelerator, topis)
//   - role = 'student' or null, not suspended (suspended = past this stage)
//   - not a test account
//
// When:
//   - daysLeft 4-6  → the "5-day" early reminder (window = catch-up tolerance
//     if a daily run is missed)
//   - daysLeft -1..0 → the "due today" reminder
//   - daysLeft < -1  → never; overdue handling is the suspension system's job
//
// Idempotency: one early + one due-day send max per due date, tracked in
// webhook_logs (action='payment_reminder_early' | 'payment_reminder_due',
// payload.due = the due date as YYYY-MM-DD). Before sending we check for an
// existing row with the same action + due date for this email.
//
// Security: same CRON_SECRET pattern as nudge-inactive.

export const maxDuration = 60
export const dynamic = 'force-dynamic'

const SEND_DELAY_MS = 600
const TEST_ACCOUNT_PATTERN = /nvorana\+|\+test|coachmafenu/i

export async function GET(request: NextRequest) {
  return handle(request)
}

export async function POST(request: NextRequest) {
  return handle(request)
}

async function handle(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
  }
  const authHeader = request.headers.get('authorization') ?? ''
  const querySecret = request.nextUrl.searchParams.get('secret') ?? ''
  if (authHeader !== `Bearer ${cronSecret}` && querySecret !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  await admin.rpc('set_audit_context', { p_user: null, p_source: 'cron_notify_payment_due' })

  const { data: students, error: studentsErr } = await admin
    .from('profiles')
    .select('id, email, first_name, full_name, role, access_level, program_type, access_suspended, installments_paid, next_payment_due_at')
    .not('next_payment_due_at', 'is', null)
    .eq('access_level', 'enrolled')
    .in('program_type', ['accelerator', 'topis'])

  if (studentsErr) {
    return NextResponse.json({ error: studentsErr.message }, { status: 500 })
  }

  const results: Array<{ email: string; action: string; due?: string; days_left?: number; error?: string }> = []
  let scanned = 0
  let sentEarly = 0
  let sentDue = 0
  let skipped = 0

  for (const s of students ?? []) {
    scanned++
    const email = (s.email ?? '').trim()
    if (!email || TEST_ACCOUNT_PATTERN.test(email)) { skipped++; continue }
    if (s.role && s.role !== 'student') { skipped++; continue }
    if (s.access_suspended === true) { skipped++; continue }
    if (!s.next_payment_due_at) { skipped++; continue }

    const daysLeft = daysUntilDue(s.next_payment_due_at)

    // Pick the send window (with catch-up tolerance for missed runs)
    let action: 'payment_reminder_early' | 'payment_reminder_due' | null = null
    if (daysLeft >= 4 && daysLeft <= 6) action = 'payment_reminder_early'
    else if (daysLeft >= -1 && daysLeft <= 0) action = 'payment_reminder_due'
    if (!action) { skipped++; continue }

    const dueDate = new Date(s.next_payment_due_at)
    const dueKey = dueDate.toISOString().slice(0, 10)

    // Idempotency: one send per action per due date per email
    const { data: existing } = await admin
      .from('webhook_logs')
      .select('id')
      .eq('contact_email', email)
      .eq('action', action)
      .eq('payload->>due', dueKey)
      .limit(1)

    if (existing && existing.length > 0) {
      skipped++
      results.push({ email, action: 'already_sent', due: dueKey })
      continue
    }

    const installmentLabel = (s.installments_paid ?? 1) >= 2 ? '3rd payment' : '2nd payment'
    const firstName = s.first_name?.trim() || s.full_name?.split(' ')[0] || null

    const result = await sendPaymentReminder({
      email,
      firstName,
      dueDate,
      daysLeft,
      installmentLabel,
    })

    if (result.sent) {
      if (action === 'payment_reminder_early') sentEarly++
      else sentDue++

      await admin.from('webhook_logs').insert({
        payload: { due: dueKey, days_left: daysLeft, resend_id: result.resendId ?? null },
        tag_name: 'PAYMENT_REMINDER',
        contact_email: email,
        action,
      })

      results.push({ email, action, due: dueKey, days_left: daysLeft })
      await new Promise(r => setTimeout(r, SEND_DELAY_MS))
    } else {
      skipped++
      results.push({ email, action: 'send_failed', due: dueKey, error: result.reason })
    }
  }

  console.log(`[notify-payment-due] scanned=${scanned} sent_early=${sentEarly} sent_due=${sentDue} skipped=${skipped}`)

  return NextResponse.json({
    ok: true,
    ran_at: new Date().toISOString(),
    scanned,
    sent_early: sentEarly,
    sent_due: sentDue,
    skipped,
    results,
  })
}
