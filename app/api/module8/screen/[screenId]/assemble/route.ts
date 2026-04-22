import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getActiveSession, upsertStepDraft, logAudit } from '@/lib/module8/persistence'
import { assembleBlueprint } from '@/lib/module8/blueprint'

// POST /api/module8/screen/9/assemble
//
// Assembles the final course blueprint from all prior approved outputs.
// Not Creator-driven — pure orchestrator logic per Doc 3.

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ screenId: string }> }
) {
  const { screenId: screenIdStr } = await params
  const screenId = parseInt(screenIdStr)

  if (screenId !== 9) {
    return NextResponse.json({ error: 'assemble endpoint is only for Screen 9' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const session = await getActiveSession(user.id)
  if (!session) return NextResponse.json({ error: 'no_active_session' }, { status: 400 })

  try {
    const result = await assembleBlueprint({
      userId: user.id,
      sessionId: session.id,
      currentVersion: session.blueprint_version ?? 1,
    })

    // Persist as draft (approval is separate)
    await upsertStepDraft(
      session.id,
      9,
      result.blueprint as unknown as Record<string, unknown>,
      null
    )

    await logAudit({
      sessionId: session.id,
      userId: user.id,
      eventType: 'screen_9_assembled',
      screenId: 9,
      actor: 'system',
      payload: {
        ready_for_approval: result.ready_for_approval,
        missing_screens: result.missing_screens,
        validation_warnings: result.validation_warnings,
      },
    })

    return NextResponse.json({
      success: true,
      blueprint: result.blueprint,
      ready_for_approval: result.ready_for_approval,
      validation_warnings: result.validation_warnings,
      missing_screens: result.missing_screens,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[Module 8 Screen 9 assemble error]', message)
    return NextResponse.json({ error: 'assembly_failed', detail: message }, { status: 500 })
  }
}
