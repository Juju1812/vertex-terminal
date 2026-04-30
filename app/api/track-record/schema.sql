-- ─────────────────────────────────────────────────────────────────
-- ArbibX track-record schema
--
-- Run this ONCE in your Supabase SQL editor:
--   1. Open Supabase dashboard → SQL Editor
--   2. New query → paste the block below
--   3. Click "Run"
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS analysis_snapshots (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  picks       JSONB        NOT NULL
);

-- Fast "show me the last N snapshots" queries
CREATE INDEX IF NOT EXISTS idx_snapshots_created_at
  ON analysis_snapshots (created_at DESC);

-- Optional: keep the table from growing forever. Uncomment if desired.
-- (Trims to last 730 days = 2 years of hourly snapshots ≈ 17,520 rows max.)
-- CREATE OR REPLACE FUNCTION trim_old_snapshots() RETURNS trigger AS $$
-- BEGIN
--   DELETE FROM analysis_snapshots WHERE created_at < now() - interval '730 days';
--   RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql;
-- DROP TRIGGER IF EXISTS trim_old_snapshots_trigger ON analysis_snapshots;
-- CREATE TRIGGER trim_old_snapshots_trigger
--   AFTER INSERT ON analysis_snapshots
--   EXECUTE FUNCTION trim_old_snapshots();
