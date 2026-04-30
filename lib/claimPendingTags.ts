// ─── Orphan Tag Claim ─────────────────────────────────────────────────────────
//
// When a Systeme.io tag webhook fires BEFORE the user has signed up to KLARO,
// our handler logs the action as `*_pending_signup_*` and gives up — there's
// no profile to update. Without this module, those tags become orphans: the
// user signs up later but is never granted the access their tag implies.
//
// This module's job: when a still-pending profile is observed (e.g. by
// middleware after login), look for any `*_pending_signup_*` webhook events
// for this user's email, apply the resulting access updates retroactively,
// and append a `claimed_by_signup` audit row so we don't reprocess.
//
// Idempotent — safe to call repeatedly. If a claim has already been performed
// (newest pending event predates the most recent claimed_by_signup row), it's
// a no-op.

import { createAdminClient } from './supabase/admin'

const EDGAR_COACH_ID = 'e5d6cc0d-ae70-4e58-967b-f61a957eb442'

export interface ClaimResult {
  claimed: number
  applied_actions: string[]
  skipped_actions: string[]
  updates_applied: Record<string, unknown> | null
  reason?: string
}

export async function claimPendingTagsForUser(
  userId: string,
  email: string,
): Promise<ClaimResult> {
  const supabase = createAdminClient()
  const result: ClaimResult = {
    claimed: 0,
    applied_actions: [],
    skipped_actions: [],
    updates_applied: null,
  }

  // ── Find unclaimed pending-signup webhook events for this email ────────────
  const { data: logs } = await supabase
    .from('webhook_logs')
    .select('processed_at, tag_name, action, payload')
    .eq('contact_email', email)
    .like('action', '%_pending_signup%')
    .order('processed_at', { ascending: true })

  if (!logs?.length) {
    return { ...result, reason: 'no_pending_tags_for_email' }
  }

  // Idempotency: if a claimed_by_signup row exists newer than the latest
  // pending event, we already processed these — exit.
  const newestPending = logs[logs.length - 1].processed_at
  const { data: alreadyClaimed } = await supabase
    .from('webhook_logs')
    .select('processed_at')
    .eq('contact_email', email)
    .eq('action', 'claimed_by_signup')
    .gte('processed_at', newestPending)
    .limit(1)

  if (alreadyClaimed?.length) {
    return { ...result, reason: 'already_claimed' }
  }

  // ── Snapshot current profile (so we don't downgrade access) ────────────────
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, access_level, program_type, unlocked_modules, coach_id, enrolled_at, cohort_batch')
    .eq('id', userId)
    .maybeSingle()

  if (!profile) {
    return { ...result, reason: 'no_profile' }
  }

  // Don't disturb users who are already activated by some other path.
  if (profile.access_level !== 'pending') {
    return { ...result, reason: 'already_activated' }
  }

  // ── Walk through pending events in time order; later events override ───────
  // Severity ladder from least to most generous:
  //   tier1 < tier2 < tier3 < topis enrolled < accelerator enrolled < full_access
  // We pick the strongest treatment found across the orphan tags so the
  // student isn't accidentally downgraded by an early Klaro-tier1 when a
  // later Accel-Enrolled also fired.
  const updates: Record<string, unknown> = {}
  const currentUnlocked: number[] = (profile.unlocked_modules as number[]) ?? []
  const enrolledAt = profile.enrolled_at ?? new Date().toISOString()

  // Track the strongest action seen so we apply the most generous treatment.
  let bestRank = 0
  const actionRank = (action: string): number => {
    if (action === 'access_granted_pending_signup') return 6
    if (action === 'accelerator_enrolled_pending_signup') return 5
    if (action === 'topis_enrolled_pending_signup') return 4
    if (action === 'tier_access_pending_signup_tier3') return 3
    if (action === 'tier_access_pending_signup_tier2') return 2
    if (action === 'tier_access_pending_signup_tier1') return 1
    return 0
  }

  for (const log of logs) {
    const action = log.action
    const rank = actionRank(action)
    if (rank === 0) {
      result.skipped_actions.push(action)
      continue
    }

    // Only apply if this is the strongest treatment we've seen so far.
    // (We still log every applicable action in applied_actions for audit.)
    result.applied_actions.push(action)
    if (rank < bestRank) continue
    bestRank = rank

    if (action === 'accelerator_enrolled_pending_signup') {
      updates.program_type = 'accelerator'
      updates.access_level = 'enrolled'
      updates.coach_id = EDGAR_COACH_ID
      updates.unlocked_modules = Array.from(
        new Set([...currentUnlocked, 1, 2])
      ).sort((a, b) => a - b)
      updates.enrolled_at = enrolledAt
    } else if (action === 'topis_enrolled_pending_signup') {
      updates.program_type = 'topis'
      updates.access_level = 'enrolled'
      updates.enrolled_at = enrolledAt
      // Extract batch number from tag if present (e.g. TOPIS-77-Student → 77)
      const match = log.tag_name?.match(/(?:^|-)(\d{2,3})(?:-|$)/)
      if (match) updates.cohort_batch = parseInt(match[1], 10)
    } else if (action === 'tier_access_pending_signup_tier3') {
      updates.access_level = 'tier3'
      updates.enrolled_at = enrolledAt
    } else if (action === 'tier_access_pending_signup_tier2') {
      updates.access_level = 'tier2'
      updates.enrolled_at = enrolledAt
    } else if (action === 'tier_access_pending_signup_tier1') {
      updates.access_level = 'tier1'
      updates.enrolled_at = enrolledAt
    } else if (action === 'access_granted_pending_signup') {
      updates.access_level = 'full_access'
      updates.enrolled_at = enrolledAt
      ;(updates as Record<string, unknown>).full_access_granted_at = new Date().toISOString()
    }
  }

  if (Object.keys(updates).length === 0) {
    return { ...result, reason: 'no_recognized_actions' }
  }

  updates.access_suspended = false
  updates.updated_at = new Date().toISOString()

  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)

  if (error) {
    console.error('[claimPendingTags] profile update failed:', error.message)
    return { ...result, reason: `update_failed: ${error.message}` }
  }

  // Audit row so future calls know not to reprocess.
  await supabase.from('webhook_logs').insert({
    payload: {
      claimed_actions: result.applied_actions,
      applied_updates: updates,
    },
    tag_name: 'CLAIMED_BY_SIGNUP',
    contact_email: email,
    action: 'claimed_by_signup',
  })

  result.claimed = result.applied_actions.length
  result.updates_applied = updates
  console.log(
    `[claimPendingTags] ${email} claimed ${result.claimed} pending tag(s); applied: ${JSON.stringify(updates)}`,
  )
  return result
}
