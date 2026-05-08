-- ================================================================
--  ADD 'future_interested' TO call_disposition ENUM
--  PostgreSQL enums are append-only — values cannot be removed,
--  only added. 'nurture_later' stays in the type but is no longer
--  used by the form. Run in Supabase SQL Editor.
-- ================================================================

ALTER TYPE call_disposition ADD VALUE IF NOT EXISTS 'future_interested';

-- ── VERIFY ───────────────────────────────────────────────────────
SELECT enumlabel
FROM pg_enum
WHERE enumtypid = 'call_disposition'::regtype
ORDER BY enumsortorder;
