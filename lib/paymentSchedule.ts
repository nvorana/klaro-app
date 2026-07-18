// ─── Installment schedule ────────────────────────────────────────────────────
//
// Payment plans (confirmed 2026-07-17): AP = 2 payments, TOPIS = 3 payments,
// spaced 30 days apart, first payment at enrollment. So:
//
//   next due = enrolled_at + 30d × installments_paid
//   fully paid (installments_paid >= plan total) → nothing due (null)
//
// KLARO learns installments from Systeme.io tags (AP|TOPIS PAYMENT PAY_n,
// 2nd-Pay-Settled, FULLY_PAID) via the webhook, reconciled by the sweep cron
// and the one-time backfill (scripts/backfill-payment-schedule.mjs).

const DAY_MS = 86400000

export const PLAN_TOTALS: Record<string, number> = {
  accelerator: 2,
  topis: 3,
}

/** Next installment due date, or null if fully paid / unknown plan. */
export function nextDueDate(
  programType: string | null | undefined,
  enrolledAt: string | null | undefined,
  installmentsPaid: number | null | undefined,
): Date | null {
  const total = programType ? PLAN_TOTALS[programType] : undefined
  const paid = installmentsPaid ?? 1
  if (!total || !enrolledAt || paid >= total) return null
  return new Date(new Date(enrolledAt).getTime() + 30 * DAY_MS * paid)
}

/** Whole days until the due date (negative = past due). */
export function daysUntilDue(dueAt: string | Date): number {
  const t = typeof dueAt === 'string' ? new Date(dueAt).getTime() : dueAt.getTime()
  return Math.ceil((t - Date.now()) / DAY_MS)
}
