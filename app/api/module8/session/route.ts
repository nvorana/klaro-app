import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkUnlockEligibility } from '@/lib/module8/unlock'
import {
  getActiveSession,
  createSession,
  getAllApprovedOutputs,
  logAudit,
} from '@/lib/module8/persistence'

// GET /api/module8/session
// Returns the current user's active Module 8 session + unlock eligibility.
// Creates no state on its own.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const eligibility = await checkUnlockEligibility(user.id)
  const session = await getActiveSession(user.id)
  const approvedByScreen = session ? await getAllApprovedOutputs(session.id) : {}

  return NextResponse.json({
    eligibility,
    session,
    approved_outputs_by_screen: approvedByScreen,
  })
}

// POST /api/module8/session
// Starts (or returns) an active Module 8 session for the user.
// Creates a new session if eligible and none exists.
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const eligibility = await checkUnlockEligibility(user.id)
  if (!eligibility.eligible) {
    return NextResponse.json(
      { error: 'not_eligible', eligibility },
      { status: 403 }
    )
  }

  // Return existing session if present
  let session = await getActiveSession(user.id)
  if (session) {
    return NextResponse.json({ session, created: false })
  }

  // Create a new session
  const unlockStatus = eligibility.admin_override ? 'override' : 'unlocked'
  const unlockReason = eligibility.reasons_passed.join(',')

  session = await createSession(user.id, unlockStatus, unlockReason)

  await logAudit({
    sessionId: session.id,
    userId: user.id,
    eventType: 'session_started',
    actor: 'user',
    payload: { eligibility },
  })

  return NextResponse.json({ session, created: true })
}
