// ───────────────────────────────────────────────────────────────────────────
// Module 8 — Persistence helpers (all DB writes use admin client)
// ───────────────────────────────────────────────────────────────────────────

import { createAdminClient } from '@/lib/supabase/admin'
import type { Module8Session, ScreenId, StepStatus } from './types'

// ─── Sessions ──────────────────────────────────────────────────────────────

export async function getActiveSession(userId: string): Promise<Module8Session | null> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('module8_sessions')
    .select('*')
    .eq('user_id', userId)
    .in('module8_status', ['active', 'paused'])
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data as Module8Session | null) ?? null
}

export async function createSession(
  userId: string,
  unlockStatus: 'unlocked' | 'override',
  unlockReason: string
): Promise<Module8Session> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('module8_sessions')
    .insert({
      user_id: userId,
      module8_status: 'active',
      unlock_status: unlockStatus,
      unlock_reason: unlockReason,
      current_screen: 0,
      blueprint_version: 1,
    })
    .select()
    .single()

  if (error || !data) throw new Error(`Could not create Module 8 session: ${error?.message}`)
  return data as Module8Session
}

export async function updateSessionScreen(sessionId: string, currentScreen: ScreenId): Promise<void> {
  const admin = createAdminClient()
  await admin
    .from('module8_sessions')
    .update({ current_screen: currentScreen, updated_at: new Date().toISOString() })
    .eq('id', sessionId)
}

export async function markSessionComplete(sessionId: string): Promise<void> {
  const admin = createAdminClient()
  await admin
    .from('module8_sessions')
    .update({
      module8_status: 'completed',
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', sessionId)
}

// ─── Step Outputs ──────────────────────────────────────────────────────────

export async function getStepOutput(sessionId: string, screenId: ScreenId) {
  const admin = createAdminClient()
  const { data } = await admin
    .from('module8_step_outputs')
    .select('*')
    .eq('session_id', sessionId)
    .eq('screen_id', screenId)
    .maybeSingle()
  return data
}

export async function getAllApprovedOutputs(sessionId: string): Promise<Record<number, Record<string, unknown>>> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('module8_step_outputs')
    .select('screen_id, approved_payload_jsonb, status')
    .eq('session_id', sessionId)
    .eq('status', 'approved')

  const out: Record<number, Record<string, unknown>> = {}
  for (const row of data ?? []) {
    if (row.approved_payload_jsonb) {
      out[row.screen_id] = row.approved_payload_jsonb as Record<string, unknown>
    }
  }
  return out
}

export async function upsertStepDraft(
  sessionId: string,
  screenId: ScreenId,
  payload: Record<string, unknown>,
  promptVersion: string | null = null
) {
  const admin = createAdminClient()
  const existing = await getStepOutput(sessionId, screenId)

  if (existing) {
    const { data, error } = await admin
      .from('module8_step_outputs')
      .update({
        draft_payload_jsonb: payload,
        draft_version: (existing.draft_version ?? 1) + 1,
        status: 'draft',
        prompt_version: promptVersion,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select()
      .single()
    if (error) throw error
    return data
  }

  const { data, error } = await admin
    .from('module8_step_outputs')
    .insert({
      session_id: sessionId,
      screen_id: screenId,
      draft_version: 1,
      draft_payload_jsonb: payload,
      status: 'draft',
      prompt_version: promptVersion,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function approveStepOutput(
  sessionId: string,
  screenId: ScreenId,
  payload: Record<string, unknown>
) {
  const admin = createAdminClient()
  const existing = await getStepOutput(sessionId, screenId)
  const nextApprovedVersion = (existing?.approved_version ?? 0) + 1

  if (existing) {
    const { data, error } = await admin
      .from('module8_step_outputs')
      .update({
        approved_payload_jsonb: payload,
        approved_version: nextApprovedVersion,
        status: 'approved',
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select()
      .single()
    if (error) throw error
    return data
  }

  const { data, error } = await admin
    .from('module8_step_outputs')
    .insert({
      session_id: sessionId,
      screen_id: screenId,
      draft_version: 1,
      approved_version: nextApprovedVersion,
      approved_payload_jsonb: payload,
      status: 'approved',
      approved_at: new Date().toISOString(),
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function setStepStatus(sessionId: string, screenId: ScreenId, status: StepStatus) {
  const admin = createAdminClient()
  await admin
    .from('module8_step_outputs')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('session_id', sessionId)
    .eq('screen_id', screenId)
}

// ─── Audit Log ─────────────────────────────────────────────────────────────

export async function logAudit(args: {
  sessionId: string | null
  userId: string | null
  eventType: string
  screenId?: number
  actor?: 'user' | 'system' | 'creator' | 'validator' | 'reviser' | 'admin'
  promptVersion?: string
  payload?: Record<string, unknown>
}) {
  const admin = createAdminClient()
  await admin.from('module8_audit_log').insert({
    session_id: args.sessionId,
    user_id: args.userId,
    event_type: args.eventType,
    screen_id: args.screenId,
    actor: args.actor ?? 'system',
    prompt_version: args.promptVersion,
    event_payload_jsonb: args.payload ?? null,
  })
}

// ─── Regenerate limit (derived from audit log) ─────────────────────────────

import { REGENERATE_WINDOW_MS } from './config'

export async function getRegenerationsInWindow(
  userId: string,
  screenId: ScreenId
): Promise<number> {
  const admin = createAdminClient()
  const cutoff = new Date(Date.now() - REGENERATE_WINDOW_MS).toISOString()
  const { count } = await admin
    .from('module8_audit_log')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('event_type', 'regenerate_used')
    .eq('screen_id', screenId)
    .gte('created_at', cutoff)

  return count ?? 0
}
