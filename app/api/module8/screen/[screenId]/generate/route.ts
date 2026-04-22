import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getActiveSession, upsertStepDraft, logAudit } from '@/lib/module8/persistence'
import { resolveRequiredContext } from '@/lib/module8/context'
import { runCreator } from '@/lib/module8/creator'
import { getConfig } from '@/lib/module8/config'
import type { ScreenId } from '@/lib/module8/types'

// Screen-specific imports
import { readinessRequestSchema, readinessCreatorSchema, scoreReadiness, type ReadinessPayload } from '@/lib/module8/schemas/screen_1'
import { transformationRequestSchema, transformationCreatorSchema, type TransformationPayload } from '@/lib/module8/schemas/screen_2'
import { courseTypeRequestSchema, courseTypeCreatorSchema, type CourseTypePayload } from '@/lib/module8/schemas/screen_3'

// POST /api/module8/screen/:screenId/generate
//
// Phase 1b: runs Creator with step-specific prompt + schema, persists draft.
// Phase 2 will add: hard rule precheck, validators in parallel, revision loop,
// drift check. For now, draft is persisted and returned for user review.

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ screenId: string }> }
) {
  const { screenId: screenIdStr } = await params
  const screenId = parseInt(screenIdStr) as ScreenId

  if (![1, 2, 3].includes(screenId)) {
    return NextResponse.json(
      { error: `Screen ${screenId} generate is not yet implemented in Phase 1b. Phases 2+ cover Screens 4-9.` },
      { status: 400 }
    )
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const session = await getActiveSession(user.id)
  if (!session) return NextResponse.json({ error: 'no_active_session' }, { status: 400 })

  const body = await request.json().catch(() => ({}))
  const config = getConfig(screenId)

  try {
    let draftPayload: ReadinessPayload | TransformationPayload | CourseTypePayload
    let promptVersion: string

    if (screenId === 1) {
      // ── Screen 1: Readiness ─────────────────────────────────────────
      const answers = readinessRequestSchema.parse(body.answers ?? body)
      const { readiness_score, readiness_verdict } = scoreReadiness(answers)

      // Creator generates recommended_next_path + coach_notes only
      const creatorResult = await runCreator(
        {
          promptRef: config.creator_prompt_ref!,
          context: {},
          userInputs: { answers, readiness_score, readiness_verdict },
          temperature: 0.6,
          maxTokens: 400,
        },
        readinessCreatorSchema
      )
      promptVersion = creatorResult.prompt_version

      draftPayload = {
        ...answers,
        readiness_score,
        readiness_verdict,
        recommended_next_path: creatorResult.draft.recommended_next_path,
        coach_notes: creatorResult.draft.coach_notes,
      }
    } else if (screenId === 2) {
      // ── Screen 2: Transformation ────────────────────────────────────
      const userInputs = transformationRequestSchema.parse(body)

      // Resolve required upstream context
      const { context, missing } = await resolveRequiredContext(
        user.id,
        session.id,
        config.required_context_fields
      )
      if (missing.length > 0) {
        return NextResponse.json(
          { error: 'missing_upstream_context', missing },
          { status: 400 }
        )
      }

      const creatorResult = await runCreator(
        {
          promptRef: config.creator_prompt_ref!,
          context,
          userInputs,
          temperature: 0.7,
          maxTokens: 1800,
        },
        transformationCreatorSchema
      )
      promptVersion = creatorResult.prompt_version
      draftPayload = creatorResult.draft as TransformationPayload
    } else if (screenId === 3) {
      // ── Screen 3: Course Type ───────────────────────────────────────
      const userInputs = courseTypeRequestSchema.parse(body)
      const { context, missing } = await resolveRequiredContext(
        user.id,
        session.id,
        config.required_context_fields
      )
      if (missing.length > 0) {
        return NextResponse.json(
          { error: 'missing_upstream_context', missing },
          { status: 400 }
        )
      }

      const creatorResult = await runCreator(
        {
          promptRef: config.creator_prompt_ref!,
          context,
          userInputs,
          temperature: 0.6,
          maxTokens: 1200,
        },
        courseTypeCreatorSchema
      )
      promptVersion = creatorResult.prompt_version
      draftPayload = creatorResult.draft as CourseTypePayload
    } else {
      return NextResponse.json({ error: 'unsupported_screen' }, { status: 400 })
    }

    // Persist draft
    await upsertStepDraft(session.id, screenId, draftPayload as unknown as Record<string, unknown>, promptVersion)

    await logAudit({
      sessionId: session.id,
      userId: user.id,
      eventType: 'screen_generate_completed',
      screenId,
      actor: 'creator',
      promptVersion,
    })

    return NextResponse.json({ success: true, draft: draftPayload, decision: 'pass', prompt_version: promptVersion })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[Module 8 Screen ${screenId} generate error]`, message)

    await logAudit({
      sessionId: session.id,
      userId: user.id,
      eventType: 'screen_generate_failed',
      screenId,
      actor: 'creator',
      payload: { error: message },
    })

    return NextResponse.json({ error: 'generation_failed', detail: message }, { status: 500 })
  }
}
