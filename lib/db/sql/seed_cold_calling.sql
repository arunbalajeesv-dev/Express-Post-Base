-- ================================================================
--  COLD CALLING MODULE — MOCK DATA SEED
--  Run this entire script in the Supabase SQL Editor.
--  Safe to re-run: customers upsert, calls/followups skip if
--  the customer already has seeded data.
-- ================================================================

BEGIN;

-- ── 1. ADD CITY COLUMN TO CUSTOMERS (idempotent) ─────────────────
ALTER TABLE customers ADD COLUMN IF NOT EXISTS city text;

-- ── 2. INSERT 5 CUSTOMERS ────────────────────────────────────────
INSERT INTO customers (name, mobile, company_name, city)
VALUES
  ('Ravi Kumar',    '+91 98401 11111', 'Ravi Traders',      'Chennai'),
  ('Priya Nair',    '+91 98402 22222', 'Priya Enterprises', 'Bangalore'),
  ('Arjun Mehta',   '+91 98403 33333', 'Mehta & Sons',      'Mumbai'),
  ('Sunita Sharma', '+91 98404 44444', 'Sharma Supplies',   'Delhi'),
  ('Karthik Raja',  '+91 98405 55555', 'Raja Industries',   'Coimbatore')
ON CONFLICT (mobile) DO UPDATE SET
  name         = EXCLUDED.name,
  company_name = EXCLUDED.company_name,
  city         = EXCLUDED.city;

-- ── 3. INSERT 2 CALLS PER CUSTOMER ───────────────────────────────
--  Assigned to the first Sales user found in the users table.
--  If no Sales user exists, falls back to the first user of any role.
INSERT INTO calls
  (customer_id, rep_id, started_at, ended_at, duration_seconds,
   outcome, disposition, notes, deal_stage, deal_value)
SELECT
  c.id,
  COALESCE(
    (SELECT id FROM users WHERE role = 'Sales' ORDER BY id LIMIT 1),
    (SELECT id FROM users ORDER BY id LIMIT 1)
  ) AS rep_id,
  NOW() - v.ago::interval                                        AS started_at,
  NOW() - v.ago::interval + (v.dur || ' seconds')::interval     AS ended_at,
  v.dur::int,
  v.outcome::call_outcome,
  v.dispo::call_disposition,
  v.notes,
  v.dstage::deal_stage,
  v.dval::numeric
FROM (VALUES
  -- Ravi Kumar — 2 calls (interested → proposal)
  ('+91 98401 11111','5 days 2 hours','240','answered',  'interested',
   'Interested in bulk cement supply for new warehouse. Wants pricing for 500 bags.',
   'interested','85000'),
  ('+91 98401 11111','2 days 1 hour', '420','answered',  'interested',
   'Confirmed product specs. Sending formal proposal by end of week.',
   'proposal','150000'),

  -- Priya Nair — missed first, answered second
  ('+91 98402 22222','6 days 3 hours','0',  'no_answer', NULL,
   'No response. Tried twice. Will retry next day.',
   'new_lead',NULL),
  ('+91 98402 22222','3 days 1 hour', '300','answered',  'interested',
   'Interested in paint products for office renovation. Budget approx Rs 45,000.',
   'interested','45000'),

  -- Arjun Mehta — voicemail then not interested
  ('+91 98403 33333','7 days 4 hours','45', 'voicemail', NULL,
   'Left voicemail requesting callback. Will share project details on call.',
   'new_lead',NULL),
  ('+91 98403 33333','4 days 2 hours','180','answered',  'not_interested',
   'Not looking to switch vendors currently. Revisit in Q3 2026.',
   'contacted',NULL),

  -- Sunita Sharma — nurture then proposal
  ('+91 98404 44444','8 days 1 hour', '360','answered',  'nurture_later',
   'Interested but budget cycle only starts Q3. Added to nurture list.',
   'contacted',NULL),
  ('+91 98404 44444','1 day 3 hours', '480','answered',  'interested',
   'Budget approved. Needs formal proposal for steel and paint with itemised breakdown.',
   'proposal','220000'),

  -- Karthik Raja — missed then interested
  ('+91 98405 55555','10 days 2 hours','0', 'no_answer', NULL,
   'No answer. Left callback message with receptionist.',
   'new_lead',NULL),
  ('+91 98405 55555','5 days 1 hour', '390','answered',  'interested',
   'Very keen on roofing materials for residential project. Requested on-site product demo.',
   'interested','95000')

) AS v(mobile, ago, dur, outcome, dispo, notes, dstage, dval)
JOIN customers c ON c.mobile = v.mobile
-- Skip if this customer already has seeded calls
WHERE NOT EXISTS (
  SELECT 1 FROM calls
  WHERE customer_id = c.id
);

-- ── 4. INSERT 1 FOLLOW-UP PER CUSTOMER ───────────────────────────
--  Linked to each customer's most recently inserted call.
INSERT INTO call_follow_ups
  (call_id, customer_id, assigned_to, scheduled_at, type, status, notes)
SELECT
  (SELECT id FROM calls WHERE customer_id = c.id ORDER BY id DESC LIMIT 1) AS call_id,
  c.id,
  COALESCE(
    (SELECT id FROM users WHERE role = 'Sales' ORDER BY id LIMIT 1),
    (SELECT id FROM users ORDER BY id LIMIT 1)
  ) AS assigned_to,
  NOW() + v.ahead::interval AS scheduled_at,
  v.ftype::call_followup_type,
  v.fstatus::call_followup_status,
  v.fnotes
FROM (VALUES
  ('+91 98401 11111','1 day',   'call_back',     'pending',
   'Call back to confirm proposal details and finalise deal value.'),
  ('+91 98402 22222','2 days',  'send_proposal', 'pending',
   'Send paint product proposal with full pricing to Priya Enterprises.'),
  ('+91 98403 33333','7 days',  'check_in',      'done',
   'Checked in — not interested at this time. Revisit in Q3 2026.'),
  ('+91 98404 44444','0 hours', 'send_proposal', 'pending',
   'Send itemised steel and paint proposal today. High priority.'),
  ('+91 98405 55555','3 days',  'demo',          'pending',
   'Arrange roofing materials demo at Raja Industries site in Coimbatore.')
) AS v(mobile, ahead, ftype, fstatus, fnotes)
JOIN customers c ON c.mobile = v.mobile
-- Skip if this customer already has a follow-up
WHERE NOT EXISTS (
  SELECT 1 FROM call_follow_ups
  WHERE customer_id = c.id
);

COMMIT;

-- ── CONFIRMATION SUMMARY ─────────────────────────────────────────
--  Run this block separately after the transaction above to verify.
SELECT tbl AS "Table", cnt::int AS "Rows"
FROM (
  SELECT 'users (total)'      AS tbl, COUNT(*)::bigint AS cnt FROM users
  UNION ALL
  SELECT 'users (Sales role)', COUNT(*) FROM users WHERE role = 'Sales'
  UNION ALL
  SELECT 'customers seeded',   COUNT(*) FROM customers
  WHERE mobile IN ('+91 98401 11111','+91 98402 22222','+91 98403 33333',
                   '+91 98404 44444','+91 98405 55555')
  UNION ALL
  SELECT 'calls seeded',       COUNT(*) FROM calls c
  JOIN customers cu ON cu.id = c.customer_id
  WHERE cu.mobile IN ('+91 98401 11111','+91 98402 22222','+91 98403 33333',
                      '+91 98404 44444','+91 98405 55555')
  UNION ALL
  SELECT 'follow-ups seeded',  COUNT(*) FROM call_follow_ups cf
  JOIN customers cu ON cu.id = cf.customer_id
  WHERE cu.mobile IN ('+91 98401 11111','+91 98402 22222','+91 98403 33333',
                      '+91 98404 44444','+91 98405 55555')
) t;
