// ─── AP → KLARO access policy ─────────────────────────────────────────────
//
// As of July 1, 2026 (Manila time), new AP students no longer receive
// KLARO access. Business direction shift — AP is moving to a different
// operating model.
//
// This policy is enforced at every auto-activation vector:
//   - Systeme.io webhook handler (Accel-Enrolled tag)
//   - Main cron sweep
//   - Weekly pending-digest cron
//   - Orphan-tag claim (lib/claimPendingTags.ts)
//   - Manual activate-with-welcome.mjs script
//
// Existing AP students who ALREADY have KLARO access keep it — this
// only blocks NEW auto-activations. A student is "new" if their KLARO
// profile.created_at is >= AP_KLARO_CUTOFF.
//
// TOPIS students, legacy KLARO-tier customers, and pre-cutoff AP
// students are NOT affected.
//
// To revert the policy: change AP_KLARO_ENABLED_AGAIN to a Date after
// the cutoff, or set AP_KLARO_ENABLED to true. Auto-activation resumes
// for any NEW AP profiles created after that reactivation date.

export const AP_KLARO_CUTOFF = new Date('2026-06-30T16:00:00Z')
//                                       ^ = July 1, 2026 midnight Manila (UTC+8)

// Sentinel toggle — leave undefined to keep the cutoff active.
// Set to a specific Date to reactivate AP access for profiles created
// on/after that date.
export const AP_KLARO_ENABLED_AGAIN: Date | undefined = undefined

/**
 * True if a KLARO profile with this created_at date represents a "new"
 * AP customer whose auto-activation should be blocked under the July 1
 * policy.
 *
 * Callers should also confirm the customer's verdict is AP-related
 * (Accel-Enrolled / paid_accelerator) — this function only judges the
 * date, not the tier.
 */
export function isPostCutoffAPProfile(createdAt: string | Date | null | undefined): boolean {
  if (!createdAt) return true  // Missing date → treat as new (safe default)
  const d = typeof createdAt === 'string' ? new Date(createdAt) : createdAt
  if (d.getTime() < AP_KLARO_CUTOFF.getTime()) return false  // Grandfathered
  if (AP_KLARO_ENABLED_AGAIN && d.getTime() >= AP_KLARO_ENABLED_AGAIN.getTime()) return false
  return true
}

/**
 * True if right now — with no existing profile — an AP-tagged Systeme
 * contact should be treated as a new customer blocked by the policy.
 * Used by webhook handler when getProfile() returns null.
 */
export function isPostCutoffAPNow(): boolean {
  const now = Date.now()
  if (now < AP_KLARO_CUTOFF.getTime()) return false
  if (AP_KLARO_ENABLED_AGAIN && now >= AP_KLARO_ENABLED_AGAIN.getTime()) return false
  return true
}
