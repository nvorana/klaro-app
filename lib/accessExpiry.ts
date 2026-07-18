// ─── Access Expiry — single source of truth ──────────────────────────────────
//
// Students get a limited access window. Historically this was a hard-coded
// "90 days from created_at" formula duplicated across middleware, profile,
// admin, and the access-expired page. This module replaces all of those.
//
// Resolution order:
//   1. profiles.access_expires_at — explicit per-student expiry. Set by an
//      admin extension (scripts/extend-access.mjs) or future renewal flow.
//      This ALWAYS wins when present.
//   2. Fallback formula: (created_at ?? enrolled_at) + 90 days — preserves
//      the pre-column behavior for every existing student.
//   3. Neither date present → no expiry (never locks out).
//
// Business rules (confirmed 2026-07-17):
//   - Window is 90 days (the "60 days" figure was a misremembering).
//   - No paid renewal flow yet — renewal terms are still under discussion.
//     Students may REQUEST an extension; the team grants it case-by-case via
//     scripts/extend-access.mjs, which writes access_expires_at.
//   - Coaches and admins never expire (callers must check role — see
//     lib/apiAuth.ts and middleware.ts).

export const DEFAULT_ACCESS_DAYS = 90
const DAY_MS = 24 * 60 * 60 * 1000

export interface ExpiryFields {
  access_expires_at?: string | null
  created_at?: string | null
  enrolled_at?: string | null
}

/** The date this profile's access ends, or null if it never expires. */
export function getAccessExpiry(profile: ExpiryFields): Date | null {
  if (profile.access_expires_at) return new Date(profile.access_expires_at)
  const startDate = profile.created_at ?? profile.enrolled_at
  if (!startDate) return null
  return new Date(new Date(startDate).getTime() + DEFAULT_ACCESS_DAYS * DAY_MS)
}

export function isAccessExpired(profile: ExpiryFields): boolean {
  const expiry = getAccessExpiry(profile)
  return expiry !== null && Date.now() > expiry.getTime()
}

/** Whole days until expiry (0 if expiring today, negative if past). Null = never expires. */
export function daysUntilExpiry(profile: ExpiryFields): number | null {
  const expiry = getAccessExpiry(profile)
  if (expiry === null) return null
  return Math.ceil((expiry.getTime() - Date.now()) / DAY_MS)
}
