// ───────────────────────────────────────────────────────────────────────────
// Module 8 — Required Context Resolver
// ───────────────────────────────────────────────────────────────────────────
//
// Per Document 5 Section 1 ("Required Context Resolution"):
//
//   resolveRequiredContext(sessionId, fieldNames[])
//
// - query module8_step_outputs
// - filter to status = 'approved'
// - read from approved_payload_jsonb
// - extract only requested fields
// - fail fast if required fields are missing
// - record source screen for debugging
// - prefer latest approved version
//
// Also pulls upstream fields from Modules 1-6 (clarity_sentences, ebooks, etc.)
// when the requested field belongs to prior KLARO modules.

import { createAdminClient } from '@/lib/supabase/admin'

// Fields sourced from existing KLARO tables (not module8_step_outputs)
const UPSTREAM_KLARO_FIELDS = new Set([
  'clarity_sentence',       // clarity_sentences.full_sentence
  'target_market',          // clarity_sentences.target_market
  'core_problem',           // clarity_sentences.core_problem
  'unique_mechanism',       // clarity_sentences.unique_mechanism
  'ebook_title',            // ebooks.title
  'ebook_chapters',         // ebooks.outline or structured chapters
  'offer_statement',        // offers.offer_statement
  'offer_bonuses',          // offers.bonuses
  'offer_price',            // offers.selling_price
])

export interface ContextResolution {
  context: Record<string, unknown>
  missing: string[]
  source_screens: Record<string, number | 'upstream_klaro'>
}

export async function resolveRequiredContext(
  userId: string,
  sessionId: string,
  fieldNames: string[]
): Promise<ContextResolution> {
  const admin = createAdminClient()

  const context: Record<string, unknown> = {}
  const missing: string[] = []
  const sourceScreens: Record<string, number | 'upstream_klaro'> = {}

  // Split fields by source
  const upstreamKlaroFields = fieldNames.filter(f => UPSTREAM_KLARO_FIELDS.has(f))
  const module8Fields = fieldNames.filter(f => !UPSTREAM_KLARO_FIELDS.has(f))

  // ── Pull from Modules 1-6 upstream data ──────────────────────────────────
  if (upstreamKlaroFields.length > 0) {
    const [{ data: clarity }, { data: ebook }, { data: offer }] = await Promise.all([
      admin.from('clarity_sentences').select('*').eq('user_id', userId).maybeSingle(),
      admin.from('ebooks').select('*').eq('user_id', userId).eq('status', 'complete').order('created_at', { ascending: false }).limit(1).maybeSingle(),
      admin.from('offers').select('*').eq('user_id', userId).maybeSingle(),
    ])

    for (const field of upstreamKlaroFields) {
      let value: unknown = undefined

      if (field === 'clarity_sentence') value = clarity?.full_sentence
      else if (field === 'target_market') value = clarity?.target_market
      else if (field === 'core_problem') value = clarity?.core_problem
      else if (field === 'unique_mechanism') value = clarity?.unique_mechanism
      else if (field === 'ebook_title') value = ebook?.title
      else if (field === 'ebook_chapters') value = ebook?.outline?.chapter_outlines ?? ebook?.chapters ?? null
      else if (field === 'offer_statement') value = offer?.offer_statement
      else if (field === 'offer_bonuses') value = offer?.bonuses
      else if (field === 'offer_price') value = offer?.selling_price

      if (value === undefined || value === null) {
        missing.push(field)
      } else {
        context[field] = value
        sourceScreens[field] = 'upstream_klaro'
      }
    }
  }

  // ── Pull from prior approved Module 8 screens ────────────────────────────
  if (module8Fields.length > 0) {
    const { data: approvedOutputs } = await admin
      .from('module8_step_outputs')
      .select('screen_id, approved_payload_jsonb, approved_version')
      .eq('session_id', sessionId)
      .eq('status', 'approved')
      .order('approved_version', { ascending: false })

    for (const field of module8Fields) {
      let found = false
      for (const row of approvedOutputs ?? []) {
        const payload = row.approved_payload_jsonb as Record<string, unknown> | null
        if (payload && field in payload && payload[field] !== null && payload[field] !== undefined) {
          context[field] = payload[field]
          sourceScreens[field] = row.screen_id as number
          found = true
          break  // prefer latest approved version
        }
      }
      if (!found) missing.push(field)
    }
  }

  return { context, missing, source_screens: sourceScreens }
}
