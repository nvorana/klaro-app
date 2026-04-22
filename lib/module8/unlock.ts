// ───────────────────────────────────────────────────────────────────────────
// Module 8 — Unlock Check
// ───────────────────────────────────────────────────────────────────────────
//
// Determines whether a user can access Module 8. Deterministic — not AI.
//
// Unlock rules (per user decisions 2026-04-22):
// 1. `module8_beta = true` on their profile (manual flag set by admin)
//    OR user is an admin
// 2. `access_level` in ('full_access', 'tier3', 'tier4')
// 3. All 7 prior modules have non-null `completed_at` in module_progress
//
// Admin override always wins. Coaches cannot override.

import { createAdminClient } from '@/lib/supabase/admin'

export interface UnlockCheckResult {
  eligible: boolean
  reasons_passed: string[]
  reasons_failed: string[]
  admin_override: boolean
}

const ELIGIBLE_ACCESS_LEVELS = new Set(['full_access', 'tier3', 'tier4'])

export async function checkUnlockEligibility(userId: string): Promise<UnlockCheckResult> {
  const admin = createAdminClient()

  const passed: string[] = []
  const failed: string[] = []

  // ── Fetch profile ────────────────────────────────────────────
  const { data: profile } = await admin
    .from('profiles')
    .select('id, role, access_level, module8_beta')
    .eq('id', userId)
    .maybeSingle()

  if (!profile) {
    return {
      eligible: false,
      reasons_passed: [],
      reasons_failed: ['profile_not_found'],
      admin_override: false,
    }
  }

  // Admin always has access.
  if (profile.role === 'admin') {
    return {
      eligible: true,
      reasons_passed: ['admin_role'],
      reasons_failed: [],
      admin_override: true,
    }
  }

  // ── Check beta flag ──────────────────────────────────────────
  if (profile.module8_beta !== true) {
    failed.push('not_flagged_for_beta')
    return {
      eligible: false,
      reasons_passed: passed,
      reasons_failed: failed,
      admin_override: false,
    }
  }
  passed.push('flagged_for_beta')

  // ── Check access level ───────────────────────────────────────
  if (!ELIGIBLE_ACCESS_LEVELS.has(profile.access_level)) {
    failed.push(`access_level_${profile.access_level}_not_eligible`)
  } else {
    passed.push('access_level_eligible')
  }

  // ── Check all 7 modules completed ────────────────────────────
  const { data: moduleProgress } = await admin
    .from('module_progress')
    .select('module_number, completed_at')
    .eq('user_id', userId)
    .not('completed_at', 'is', null)

  const completedSet = new Set(
    (moduleProgress ?? []).map(m => m.module_number)
  )

  const missingModules: number[] = []
  for (let i = 1; i <= 7; i++) {
    if (!completedSet.has(i)) missingModules.push(i)
  }

  if (missingModules.length > 0) {
    failed.push(`modules_not_completed:${missingModules.join(',')}`)
  } else {
    passed.push('all_modules_1_7_completed')
  }

  return {
    eligible: failed.length === 0,
    reasons_passed: passed,
    reasons_failed: failed,
    admin_override: false,
  }
}
