import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  getActiveSession,
  getStepOutput,
  approveStepOutput,
  updateSessionScreen,
  logAudit,
} from '@/lib/module8/persistence'
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
