-- ================================================================
--  CREATE call_logs TABLE
--  Primary interaction tracking table — replaces the old `calls`
--  table for new entries. Run in Supabase SQL Editor.
-- ================================================================

CREATE TABLE IF NOT EXISTS call_logs (
  id                 SERIAL PRIMARY KEY,
  customer_id        INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  agent_id           INTEGER NOT NULL REFERENCES users(id),
  visit_id           INTEGER REFERENCES visits(id),
  call_date          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  call_status        TEXT NOT NULL CHECK (call_status IN (
                       'Connected',
                       'Not Connected',
                       'Callback Requested',
                       'Quotation Sent',
                       'Converted',
                       'Not Interested'
                     )),
  call_summary       TEXT NOT NULL,
  quotation_sent     BOOLEAN NOT NULL DEFAULT FALSE,
  quotation_number   TEXT,
  converted_to_sale  BOOLEAN NOT NULL DEFAULT FALSE,
  invoice_number     TEXT,
  sale_value         NUMERIC(12, 2),
  next_schedule_date TIMESTAMPTZ,
  notes              TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Row Level Security ────────────────────────────────────────────
ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_call_logs"
  ON call_logs FOR ALL
  USING (true)
  WITH CHECK (true);

-- ── Indexes ───────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_call_logs_customer_id ON call_logs(customer_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_agent_id    ON call_logs(agent_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_call_date   ON call_logs(call_date DESC);
CREATE INDEX IF NOT EXISTS idx_call_logs_next_sched  ON call_logs(next_schedule_date)
  WHERE next_schedule_date IS NOT NULL;

-- ── Auto-update updated_at ────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_call_logs_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_call_logs_updated_at ON call_logs;
CREATE TRIGGER trg_call_logs_updated_at
  BEFORE UPDATE ON call_logs
  FOR EACH ROW EXECUTE FUNCTION update_call_logs_updated_at();

-- ── VERIFY ───────────────────────────────────────────────────────
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'call_logs'
ORDER BY ordinal_position;
