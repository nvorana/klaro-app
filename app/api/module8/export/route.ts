import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getActiveSession, getStepOutput, logAudit } from '@/lib/module8/persistence'

// GET /api/module8/export
// Returns the approved blueprint as a downloadable JSON file.

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const session = await getActiveSession(user.id)
  if (!session) return NextResponse.json({ error: 'no_active_session' }, { status: 400 })

  const screen9 = await getStepOutput(session.id, 9)
  if (!screen9?.approved_payload_jsonb) {
    return NextResponse.json({ error: 'blueprint_not_approved' }, { status: 400 })
  }

  await logAudit({
    sessionId: session.id,
    userId: user.id,
    eventType: 'blueprint_exported',
    screenId: 9,
    actor: 'user',
  })

  const blueprint = screen9.approved_payload_jsonb
  const json = JSON.stringify(blueprint, null, 2)

  return new NextResponse(json, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': 'attachment; filename="course-blueprint.json"',
    },
  })
}
