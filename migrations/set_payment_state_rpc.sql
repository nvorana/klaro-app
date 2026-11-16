-- ─────────────────────────────────────────────────────────────────────────────
-- set_payment_state: change a student's payment hold / access level and label
-- the audit row in ONE call.
--
-- Why: same problem as profile_audit_log_fix_attribution.sql. Calling
-- set_audit_context() and then UPDATE as two PostgREST requests lands them on
-- different pooled connections, so the audit trigger logs source='unknown'.
-- On 2026-11-14 the payment-sync cron upgraded 25 students and every row came
-- out 'unknown'. That matters because the cron only lifts locks whose latest
-- audit source is a payment source: its own locks would never be lifted once
-- the student paid.
--
-- Pass NULL for any field to leave it unchanged. Setting access_level to
-- 'full_access' also stamps full_access_granted_at.
--
-- Service role only. A SECURITY DEFINER function is callable by any signed-in
-- user through PostgREST unless execute is revoked, and this one can lift a
-- payment hold.
--
-- Idempotent — safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_payment_state(
  p_student_id   UUID,
  p_suspended    BOOLEAN DEFAULT NULL,
  p_access_level TEXT    DEFAULT NULL,
  p_source       TEXT    DEFAULT 'unknown',
  p_actor        UUID    DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Transaction-local, so the context can't leak to the next request that
  -- reuses this pooled connection.
  PERFORM set_config('app.audit_user',   COALESCE(p_actor::TEXT, ''), true);
  PERFORM set_config('app.audit_source', COALESCE(p_source,     ''), true);

  UPDATE profiles
  SET    access_suspended       = COALESCE(p_suspended, access_suspended),
         access_level           = COALESCE(p_access_level, access_level),
         full_access_granted_at = CASE
                                    WHEN p_access_level = 'full_access' AND access_level IS DISTINCT FROM 'full_access'
                                    THEN NOW() ELSE full_access_granted_at
                                  END,
         updated_at             = NOW()
  WHERE  id = p_student_id;
END;
$$;

REVOKE ALL ON FUNCTION public.set_payment_state(UUID, BOOLEAN, TEXT, TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_payment_state(UUID, BOOLEAN, TEXT, TEXT, UUID) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_payment_state(UUID, BOOLEAN, TEXT, TEXT, UUID) TO service_role;
