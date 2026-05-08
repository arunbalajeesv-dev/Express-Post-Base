-- ================================================================
--  COLD CALLING MODULE — RESTRUCTURE MIGRATION
--  Run in Supabase SQL Editor.
-- ================================================================

BEGIN;

-- ── 1. ADD status + scheduled_for TO calls ───────────────────────
ALTER TABLE calls
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'completed',
  ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMPTZ;

-- Backfill any existing rows
UPDATE calls SET status = 'completed' WHERE status IS NULL OR status = '';

-- ── 2. CREATE quotations TABLE ───────────────────────────────────
CREATE TABLE IF NOT EXISTS quotations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id      INTEGER NOT NULL REFERENCES customers(id),
  quotation_number TEXT NOT NULL,
  quotation_date   DATE NOT NULL,
  quotation_value  NUMERIC(12,2) NOT NULL,
  created_by       INTEGER NOT NULL REFERENCES users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "quotations_select" ON quotations;
DROP POLICY IF EXISTS "quotations_insert" ON quotations;
DROP POLICY IF EXISTS "quotations_update" ON quotations;
DROP POLICY IF EXISTS "quotations_delete" ON quotations;

CREATE POLICY "quotations_select" ON quotations FOR SELECT USING (true);
CREATE POLICY "quotations_insert" ON quotations FOR INSERT WITH CHECK (true);
CREATE POLICY "quotations_update" ON quotations FOR UPDATE USING (true);
CREATE POLICY "quotations_delete" ON quotations FOR DELETE USING (true);

COMMIT;

-- ── VERIFY ───────────────────────────────────────────────────────
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'calls'
  AND column_name IN ('status', 'scheduled_for')
UNION ALL
SELECT 'quotations table' AS column_name, 'exists' AS data_type, ''
FROM information_schema.tables
WHERE table_name = 'quotations';
