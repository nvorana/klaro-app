import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  getActiveSession,
  upsertStepDraft,
  persistValidatorRuns,
  persistQCRun,
  logAudit,
  getStepOutput,
} from '@/lib/module8/persistence'
import { resolveRequiredContext } from '@/lib/module8/context'
import { runCreator } from '@/lib/module8/creator'
import { runQCEngine } from '@/lib/module8/qc'
import { getConfig } from '@/lib/module8/config'
import type { ScreenId } from '@/lib/module8/types'

import { readinessRequestSchema, readinessCreatorSchema, scoreReadiness, type ReadinessPayload } from '@/lib/module8/schemas/screen_1'
import { transformationRequestSchema, transformationCreatorSchema, type TransformationPayload } from '@/lib/module8/schemas/screen_2'
import { courseTypeRequestSchema, courseTypeCreatorSchema, type CourseTypePayload } from '@/lib/module8/schemas/screen_3'

// POST /api/module8/screen/:screenId/generate
//
// Phase 2a: runs Creator + QC engine (hard rules + validators + decision).
// Revision loop (Phase 3) will re-run Creator internally if needed.
//
// For now, if decision is 'revise', 'escalate', or 'blocked_by_rule', we return
// the draft + validator feedback so the UI can surface it to the user. They
// can manually edit and approve, or trigger regenerate for a fresh draft.

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ screenId: string }> }
) {
  const { screenId: screenIdStr } = await params
  const screenId = parseInt(screenIdStr) as ScreenId

  if (![1, 2, 3].includes(screenId)) {
    return NextResponse.json(
      { error: `Screen ${screenId} generate is not yet implemented. Phase 2b will add Screens 4-6.` },
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
    let upstreamContext: Record<string, unknown> = {}

    // ─── Screen-specific Creator dispatch ───────────────────────────────
    if (screenId === 1) {
      const answers = readinessRequestSchema.parse(body.answers ?? body)
      const { readiness_score, readiness_verdict } = scoreReadiness(answers)

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
      const userInputs = transformationRequestSchema.parse(body)
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
      upstreamContext = context

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
      upstreamContext = context

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

    // ─── Persist draft ────────────────────────────────────────────────
    const stepRow = await upsertStepDraft(
      session.id,
      screenId,
      draftPayload as unknown as Record<string, unknown>,
      promptVersion
    )

    await logAudit({
      sessionId: session.id,
      userId: user.id,
      eventType: 'screen_creator_completed',
      screenId,
      actor: 'creator',
      promptVersion,
    })

    // ─── Run QC engine ────────────────────────────────────────────────
    const existing = await getStepOutput(session.id, screenId)
    const revisionCount = existing?.revision_count ?? 0

    const qc = await runQCEngine({
      screenId,
      draft: draftPayload as unknown as Record<string, unknown>,
      upstreamContext,
      revisionCount,
    })

    // Persist validator runs + QC run record
    const draftVersion = (stepRow as { draft_version?: number } | null)?.draft_version ?? 1
    await persistValidatorRuns(
      session.id,
      screenId,
      draftVersion,
      qc.validatorResults.map(v => ({
        validator_name: v.validator_name,
        response: v.response as unknown as Record<string, unknown>,
      }))
    )
    await persistQCRun({
      sessionId: session.id,
      screenId,
      draftVersion,
      ruleResults: {
        failures: qc.hardRuleFailures,
        warnings: qc.hardRuleWarnings,
      },
      duplicateResults: { flags: qc.duplicateFlags },
      finalDecision: qc.decision,
    })

    await logAudit({
      sessionId: session.id,
      userId: user.id,
      eventType: `screen_qc_${qc.decision}`,
      screenId,
      actor: 'validator',
      payload: {
        decision: qc.decision,
        weighted_average: qc.decisionResult.weighted_average,
        validator_count: qc.validatorResults.length,
        hard_rule_failure_count: qc.hardRuleFailures.length,
      },
    })

    return NextResponse.json({
      success: true,
      draft: draftPayload,
      decision: qc.decision,
      decision_reason: qc.decisionResult.reason,
      weighted_average: qc.decisionResult.weighted_average,
      validator_scores: qc.decisionResult.validator_scores,
      validator_feedback: qc.validatorResults.map(v => ({
        name: v.validator_name,
        overall_score: v.response.overall_score,
        pass_recommendation: v.response.pass_recommendation,
        top_issues: v.response.top_issues,
        suggested_fixes: v.response.suggested_fixes,
      })),
      hard_rule_failures: qc.hardRuleFailures,
      hard_rule_warnings: qc.hardRuleWarnings,
      duplicate_flags: qc.duplicateFlags,
      prompt_version: promptVersion,
    })
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
