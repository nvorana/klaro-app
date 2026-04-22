import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  getActiveSession,
  approveStepOutput,
  updateSessionScreen,
  logAudit,
} from '@/lib/module8/persistence'
import type { ScreenId } from '@/lib/module8/types'

// POST /api/module8/screen/0/acknowledge
// Screen 0 has no AI, no validators. Just records that the user saw the orientation.
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ screenId: string }> }
) {
  const { screenId: screenIdStr } = await params
  const screenId = parseInt(screenIdStr) as ScreenId

  if (screenId !== 0) {
    return NextResponse.json(
      { error: 'acknowledge endpoint is only for Screen 0' },
      { status: 400 }
    )
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const session = await getActiveSession(user.id)
  if (!session) {
    return NextResponse.json({ error: 'no_active_session' }, { status: 400 })
  }

  const payload = {
    orientation_acknowledged_at: new Date().toISOString(),
    orientation_version: 'v1',
  }

  await approveStepOutput(session.id, screenId, payload)
  await updateSessionScreen(session.id, 1)

  await logAudit({
    sessionId: session.id,
    userId: user.id,
    eventType: 'screen_0_acknowledged',
    screenId: 0,
    actor: 'user',
    payload,
  })

  return NextResponse.json({ success: true, payload })
}
