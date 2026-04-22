import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  getActiveSession,
  getStepOutput,
  approveStepOutput,
  updateSessionScreen,
  markSessionComplete,
  logAudit,
} from '@/lib/module8/persistence'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ScreenId } from '@/lib/module8/types'

// POST /api/module8/screen/:screenId/approve
// Body (optional): { payload: <manually edited version of the draft> }
// If no payload provided, approves the latest draft as-is.

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ screenId: string }> }
) {
  const { screenId: screenIdStr } = await params
  const screenId = parseInt(screenIdStr) as ScreenId

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const session = await getActiveSession(user.id)
  if (!session) return NextResponse.json({ error: 'no_active_session' }, { status: 400 })

  const body = await request.json().catch(() => ({}))
  const existing = await getStepOutput(session.id, screenId)

  if (!existing) return NextResponse.json({ error: 'no_draft_to_approve' }, { status: 400 })

  const payloadToApprove = body.payload ?? existing.draft_payload_jsonb

  if (!payloadToApprove) {
    return NextResponse.json({ error: 'no_payload_available' }, { status: 400 })
  }

  await approveStepOutput(session.id, screenId, payloadToApprove as Record<string, unknown>)

  // Advance session current_screen if this is the latest unfinished screen
  if ((session.current_screen ?? 0) <= screenId && screenId < 9) {
    await updateSessionScreen(session.id, (screenId + 1) as ScreenId)
  }

  // ── Screen 9 approval: mark Module 8 complete ─────────────────────────
  if (screenId === 9) {
    await markSessionComplete(session.id)

    // Write module_progress row so dashboard sees Module 8 as completed
    const admin = createAdminClient()
    await admin.from('module_progress').upsert(
      {
        user_id: user.id,
        module_number: 8,
        completed: true,
        completed_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,module_number' }
    )

    await logAudit({
      sessionId: session.id,
      userId: user.id,
      eventType: 'module_8_completed',
      screenId: 9,
      actor: 'user',
    })
  }

  await logAudit({
    sessionId: session.id,
    userId: user.id,
    eventType: 'screen_approved',
    screenId,
    actor: 'user',
    payload: { edited: body.payload !== undefined },
  })

  return NextResponse.json({ success: true, approved_payload: payloadToApprove })
}
