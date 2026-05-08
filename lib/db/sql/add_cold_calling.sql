-- Cold calling module migration
-- Run once in Supabase SQL Editor

-- Enums (safe to re-run: ignores duplicate_object errors)
DO $$ BEGIN
  CREATE TYPE call_outcome AS ENUM ('answered', 'no_answer', 'voicemail', 'wrong_number', 'callback_requested');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE call_disposition AS ENUM ('interested', 'not_interested', 'do_not_call', 'nurture_later');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE deal_stage AS ENUM ('new_lead', 'contacted', 'interested', 'proposal', 'closed_won', 'closed_lost');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE call_followup_type AS ENUM ('call_back', 'send_proposal', 'demo', 'check_in');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE call_followup_status AS ENUM ('pending', 'done', 'snoozed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- calls
CREATE TABLE IF NOT EXISTS calls (
  id               SERIAL PRIMARY KEY,
  customer_id      INTEGER NOT NULL REFERENCES customers(id),
  rep_id           INTEGER NOT NULL REFERENCES users(id),
  started_at       TIMESTAMPTZ,
  ended_at         TIMESTAMPTZ,
  duration_seconds INTEGER,
  outcome          call_outcome,
  disposition      call_disposition,
  notes            TEXT,
  deal_stage       deal_stage,
  deal_value       NUMERIC(12, 2),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- call_follow_ups (named to avoid conflict with the existing "followups" table)
CREATE TABLE IF NOT EXISTS call_follow_ups (
  id          SERIAL PRIMARY KEY,
  call_id     INTEGER NOT NULL REFERENCES calls(id),
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  assigned_to INTEGER NOT NULL REFERENCES users(id),
  scheduled_at TIMESTAMPTZ NOT NULL,
  type        call_followup_type NOT NULL,
  status      call_followup_status NOT NULL DEFAULT 'pending',
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- do_not_call (one entry per customer enforced by unique index)
CREATE TABLE IF NOT EXISTS do_not_call (
  id          SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  added_by    INTEGER NOT NULL REFERENCES users(id),
  reason      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS do_not_call_customer_unique_idx
  ON do_not_call (customer_id);

-- Row Level Security
-- Access control is enforced by the Express API layer (JWT middleware).
-- RLS is enabled with permissive policies so the service-role connection
-- (used by the API server) can always read/write, while direct client
-- access is gated at the API.
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_follow_ups ENABLE ROW LEVEL SECURITY;
ALTER TABLE do_not_call ENABLE ROW LEVEL SECURITY;

-- calls policies
DROP POLICY IF EXISTS "calls_select" ON calls;
DROP POLICY IF EXISTS "calls_insert" ON calls;
DROP POLICY IF EXISTS "calls_update" ON calls;
DROP POLICY IF EXISTS "calls_delete" ON calls;
CREATE POLICY "calls_select" ON calls FOR SELECT USING (true);
CREATE POLICY "calls_insert" ON calls FOR INSERT WITH CHECK (true);
CREATE POLICY "calls_update" ON calls FOR UPDATE USING (true);
CREATE POLICY "calls_delete" ON calls FOR DELETE USING (true);

-- call_follow_ups policies
DROP POLICY IF EXISTS "call_follow_ups_select" ON call_follow_ups;
DROP POLICY IF EXISTS "call_follow_ups_insert" ON call_follow_ups;
DROP POLICY IF EXISTS "call_follow_ups_update" ON call_follow_ups;
DROP POLICY IF EXISTS "call_follow_ups_delete" ON call_follow_ups;
CREATE POLICY "call_follow_ups_select" ON call_follow_ups FOR SELECT USING (true);
CREATE POLICY "call_follow_ups_insert" ON call_follow_ups FOR INSERT WITH CHECK (true);
CREATE POLICY "call_follow_ups_update" ON call_follow_ups FOR UPDATE USING (true);
CREATE POLICY "call_follow_ups_delete" ON call_follow_ups FOR DELETE USING (true);

-- do_not_call policies
DROP POLICY IF EXISTS "do_not_call_select" ON do_not_call;
DROP POLICY IF EXISTS "do_not_call_insert" ON do_not_call;
DROP POLICY IF EXISTS "do_not_call_update" ON do_not_call;
DROP POLICY IF EXISTS "do_not_call_delete" ON do_not_call;
CREATE POLICY "do_not_call_select" ON do_not_call FOR SELECT USING (true);
CREATE POLICY "do_not_call_insert" ON do_not_call FOR INSERT WITH CHECK (true);
CREATE POLICY "do_not_call_update" ON do_not_call FOR UPDATE USING (true);
CREATE POLICY "do_not_call_delete" ON do_not_call FOR DELETE USING (true);
