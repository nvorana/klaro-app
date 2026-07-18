-- Applied to prod 2026-07-17.
-- Installment tracking for the dues countdown/nudge.
-- installments_paid: how many installments settled (1 = paid at enrollment).
-- next_payment_due_at: derived enrolled_at + 30d * installments_paid;
--   NULL = fully paid / not on an installment plan.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS installments_paid integer,
  ADD COLUMN IF NOT EXISTS next_payment_due_at timestamptz;
