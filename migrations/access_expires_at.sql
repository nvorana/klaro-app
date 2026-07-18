-- Explicit per-student access expiry (applied to prod 2026-07-17).
-- NULL = fall back to the legacy (created_at ?? enrolled_at) + 90 days
-- formula in lib/accessExpiry.ts. Written by admin extensions
-- (scripts/extend-access.mjs) and, later, a renewal flow.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS access_expires_at timestamptz;

COMMENT ON COLUMN public.profiles.access_expires_at IS
  'Explicit access expiry. NULL = legacy 90-day formula from created_at/enrolled_at. See lib/accessExpiry.ts';
