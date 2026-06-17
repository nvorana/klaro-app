-- ─────────────────────────────────────────────────────────────────────────────
-- welcome_email_sent_at — track whether a welcome email has been sent
--
-- Idempotency: the welcome-email helper checks this column before sending.
-- If non-null, the helper skips (so a profile activated through multiple
-- paths — webhook + cron + manual script — only receives ONE welcome email).
--
-- Run in Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS welcome_email_sent_at TIMESTAMPTZ;

COMMENT ON COLUMN profiles.welcome_email_sent_at IS
  'Timestamp of when the welcome email was sent to this student. NULL means not sent. Set by lib/email/sendWelcomeEmail.ts on first successful send. Provides idempotency across multiple activation paths.';
