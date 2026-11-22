// ─── Coach assignment ────────────────────────────────────────────────────────
//
// The coach every newly activated Accelerator student is assigned to. This is
// the single place to change it: the Systeme webhook, the pending sweeps,
// claimPendingTags and apply-pending-access all import it.
//
// 2026-11-22: Coach Mafe (Marife Rosas) took over from Coach Edgar, who no
// longer has coach access. Before this, Edgar's id was hardcoded in 9 files.
export const DEFAULT_AP_COACH_ID = 'f55ae870-3ec5-44b0-b50c-615fcacb5fd1' // Coach Mafe (Marife Rosas)
