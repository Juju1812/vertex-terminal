-- ─────────────────────────────────────────────────────────────────
-- ArbibX shared portfolios schema
--
-- Run this ONCE in your Supabase SQL editor.
-- Each row is a SNAPSHOT of a user's portfolio at the moment they
-- clicked "Share" — read-only, doesn't update when the user later
-- changes their portfolio. That's deliberate: shares are a moment
-- in time, like a screenshot, not a live link.
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS shared_portfolios (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  owner_email   TEXT,
  show_amounts  BOOLEAN      NOT NULL DEFAULT false,
  snapshot      JSONB        NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_shared_portfolios_created_at
  ON shared_portfolios (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_shared_portfolios_owner
  ON shared_portfolios (owner_email);
