-- ─────────────────────────────────────────────────────────────────
-- ArbibX price alerts schema
--
-- Run this ONCE in your Supabase SQL editor.
-- Logged-in user alerts live here (source of truth) so the Vercel
-- cron job can fire them even when the user has no tab open.
-- Guest alerts continue to live in localStorage.
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS price_alerts (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  owner_email   TEXT         NOT NULL,
  ticker        TEXT         NOT NULL,
  condition     TEXT         NOT NULL CHECK (condition IN ('above','below')),
  target_price  NUMERIC      NOT NULL,
  triggered     BOOLEAN      NOT NULL DEFAULT false,
  triggered_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_price_alerts_owner
  ON price_alerts (owner_email);

-- The cron job hits this index for "all non-triggered alerts"
CREATE INDEX IF NOT EXISTS idx_price_alerts_pending
  ON price_alerts (triggered) WHERE triggered = false;
