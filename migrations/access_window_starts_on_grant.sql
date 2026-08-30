-- ─────────────────────────────────────────────────────────────────────────────
-- access_window_starts_on_grant — the 90-day clock starts when access is
-- granted, not when the student signs up.
--
-- THE BUG THIS FIXES
--   profiles.created_at is stamped by the on_auth_user_created trigger at
--   signup. lib/accessExpiry.ts then used (created_at + 90d) as the window.
--   But a student who signs up before their Systeme.io tag arrives sits at
--   access_level = 'pending' with NO modules and NO usable app — while the
--   countdown burns. When claimPendingTags/sweep/webhook finally granted
--   access, the clock was never reset.
--
--   Measured 2026-07-29: 24 students pending with the clock already running,
--   11 of them past their notional expiry without ever having had access.
--
-- THE FIX (two halves — both are required)
--   1. Read side, in code: lib/accessExpiry.ts returns NULL (no expiry) while
--      access_level = 'pending'. A pending student can no longer expire.
--   2. Write side, this trigger: the moment access_level leaves 'pending',
--      stamp access_expires_at = NOW() + 90 days. That converts "no window"
--      into a full, explicit 90-day window measured from the grant.
--
-- WHY A TRIGGER RATHER THAN APPLICATION CODE
--   Access is granted from 20+ places: the Systeme webhook (5 branches), the
--   3-hourly sweep cron, the admin sweep panel, the weekly pending digest,
--   lib/claimPendingTags.ts, /api/apply-pending-access, and
--   scripts/activate-with-welcome.mjs — plus manual edits in Supabase Studio.
--   Patching each one invites a missed path. The trigger fires inside Postgres
--   on UPDATE, so every route is covered, exactly like profile_access_audit.
--
-- SAFETY
--   - Only fires on a genuine 'pending' -> non-pending transition.
--   - Never overwrites an access_expires_at that is already set, so manual
--     extensions (scripts/extend-access.mjs) always win.
--   - Idempotent, and changes nothing for students already holding access.
--
-- Run in Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION start_access_window_on_grant()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.access_level IS DISTINCT FROM NEW.access_level
     AND OLD.access_level = 'pending'
     AND NEW.access_level <> 'pending'
     AND NEW.access_expires_at IS NULL
  THEN
    NEW.access_expires_at := NOW() + INTERVAL '90 days';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_start_access_window ON profiles;

CREATE TRIGGER trg_start_access_window
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION start_access_window_on_grant();

COMMENT ON FUNCTION start_access_window_on_grant() IS
  'Starts the 90-day KLARO access window when a profile leaves access_level=pending. Never overwrites an existing access_expires_at, so manual extensions win.';

-- ─── Verification ─────────────────────────────────────────────────────────────
-- Students currently pending. After this migration they can no longer expire,
-- and each will get a full 90 days the moment their access is granted.
--
--   SELECT email, created_at::date, access_expires_at
--   FROM profiles
--   WHERE role = 'student' AND access_level = 'pending'
--   ORDER BY created_at;
