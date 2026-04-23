import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { runCreator } from '@/lib/module8/creator'
import { getConfig } from '@/lib/module8/config'
import { getTestFoundation } from '@/lib/module8/testFoundations'

import { readinessRequestSchema, readinessCreatorSchema, scoreReadiness } from '@/lib/module8/schemas/screen_1'
import { transformationCreatorSchema } from '@/lib/module8/schemas/screen_2'
import { courseTypeCreatorSchema } from '@/lib/module8/schemas/screen_3'
import { chapterAuditCreatorSchema } from '@/lib/module8/schemas/screen_4'
import { courseSkeletonCreatorSchema } from '@/lib/module8/schemas/screen_5'
import { lessonMapCreatorSchema } from '@/lib/module8/schemas/screen_6'
import { implementationLayerCreatorSchema } from '@/lib/module8/schemas/screen_7'
import { studentExperienceCreatorSchema } from '@/lib/module8/schemas/screen_8'

// Admin-only. Runs ONE Module 8 screen against test foundation data
// without touching real sessions or user data.
//
// Body: {
//   foundation_id: string      // Test foundation preset
//   screen_id: number          // 1-8
//   upstream: {...}            // Accumulated outputs from previous screens
//   user_inputs?: {...}        // Screen-specific user inputs
//   module_number?: number     // For Screen 6 (which module to generate)
// }

export const maxDuration = 60

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (me?.role !== 'admin') return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 })

  const { foundation_id, screen_id, upstream = {}, user_inputs = {}, module_number } = await request.json()

  const foundation = getTestFoundation(foundation_id)
  if (!foundation) {
    return NextResponse.json({ error: 'Unknown foundation_id' }, { status: 400 })
  }

  const config = getConfig(screen_id as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8)
  if (!config.creator_prompt_ref) {
    return NextResponse.json({ error: 'Screen does not have a creator prompt' }, { status: 400 })
  }

  // Build the context: foundation data + anything upstream screens produced
  const context: Record<string, unknown> = {
    clarity_sentence: foundation.clarity_sentence,
    target_market: foundation.target_market,
    core_problem: foundation.core_problem,
    unique_mechanism: foundation.unique_mechanism,
    ebook_title: foundation.ebook_title,
    ebook_chapters: foundation.ebook_chapters,
    offer_bonuses: foundation.offer_bonuses ?? [],
    offer_price: foundation.offer_price,
    ...upstream,
  }

  const started = Date.now()

  try {
    let draft: Record<string, unknown>
    let promptVersion: string

    if (screen_id === 1) {
      // Default readiness answers for test — best-case profile
      const answers = user_inputs.answers ?? {
        ebook_finished_status: 'finished',
        ebook_sales_signal: '10_plus_sales',
        buyer_feedback_signal: 'yes_multiple',
        audience_pull_signal: 'yes_directly_asked',
        time_energy_next_6_weeks: 'some',
      }
      const parsed = readinessRequestSchema.parse(answers)
      const { readiness_score, readiness_verdict } = scoreReadiness(parsed)

      const result = await runCreator(
        {
          promptRef: config.creator_prompt_ref,
          context: {},
          userInputs: { answers: parsed, readiness_score, readiness_verdict },
          temperature: 0.6,
          maxTokens: 400,
        },
        readinessCreatorSchema
      )
      promptVersion = result.prompt_version
      draft = {
        ...parsed,
        readiness_score,
        readiness_verdict,
        recommended_next_path: result.draft.recommended_next_path,
        coach_notes: result.draft.coach_notes,
      }
    } else if (screen_id === 2) {
      const inputs = user_inputs.transformation ?? {
        course_audience: foundation.target_market,
        course_problem: foundation.core_problem,
        course_result: 'achieve measurable transformation in 6-8 weeks',
        course_method: foundation.unique_mechanism,
        student_capability: 'apply the framework step by step and see results',
      }
      const result = await runCreator(
        {
          promptRef: config.creator_prompt_ref,
          context,
          userInputs: inputs,
          temperature: 0.7,
          maxTokens: 1800,
        },
        transformationCreatorSchema
      )
      promptVersion = result.prompt_version
      draft = result.draft
    } else if (screen_id === 3) {
      const result = await runCreator(
        {
          promptRef: config.creator_prompt_ref,
          context,
          userInputs: {},
          temperature: 0.6,
          maxTokens: 1200,
        },
        courseTypeCreatorSchema
      )
      promptVersion = result.prompt_version
      draft = result.draft
    } else if (screen_id === 4) {
      const result = await runCreator(
        {
          promptRef: config.creator_prompt_ref,
          context,
          userInputs: {},
          temperature: 0.5,
          maxTokens: 3000,
        },
        chapterAuditCreatorSchema
      )
      promptVersion = result.prompt_version
      draft = result.draft
    } else if (screen_id === 5) {
      const result = await runCreator(
        {
          promptRef: config.creator_prompt_ref,
          context,
          userInputs: user_inputs,
          temperature: 0.6,
          maxTokens: 2500,
        },
        courseSkeletonCreatorSchema
      )
      promptVersion = result.prompt_version
      draft = result.draft
    } else if (screen_id === 6) {
      if (!module_number) {
        return NextResponse.json({ error: 'Screen 6 requires module_number' }, { status: 400 })
      }
      const result = await runCreator(
        {
          promptRef: config.creator_prompt_ref,
          context,
          userInputs: { module_number },
          temperature: 0.6,
          maxTokens: 2500,
        },
        lessonMapCreatorSchema
      )
      promptVersion = result.prompt_version
      draft = result.draft
    } else if (screen_id === 7) {
      const result = await runCreator(
        {
          promptRef: config.creator_prompt_ref,
          context,
          userInputs: {},
          temperature: 0.5,
          maxTokens: 2500,
        },
        implementationLayerCreatorSchema
      )
      promptVersion = result.prompt_version
      draft = result.draft
    } else if (screen_id === 8) {
      const result = await runCreator(
        {
          promptRef: config.creator_prompt_ref,
          context,
          userInputs: {},
          temperature: 0.5,
          maxTokens: 1500,
        },
        studentExperienceCreatorSchema
      )
      promptVersion = result.prompt_version
      draft = result.draft
    } else {
      return NextResponse.json({ error: 'Invalid screen_id (must be 1-8)' }, { status: 400 })
    }

    const elapsed = Date.now() - started

    return NextResponse.json({
      success: true,
      screen_id,
      draft,
      prompt_version: promptVersion,
      elapsed_ms: elapsed,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[test-module8/run-screen ${screen_id}]`, message)
    return NextResponse.json({ error: 'generation_failed', detail: message }, { status: 500 })
  }
}
