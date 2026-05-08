-- ================================================================
--  SEED call_logs with 6 test entries
--  Uses subqueries to auto-pick real customer & agent IDs.
--  Run in Supabase SQL Editor.
-- ================================================================

DO $$
DECLARE
  c1 INT; c2 INT; c3 INT; c4 INT; c5 INT; c6 INT;
  a1 INT; a2 INT;
BEGIN
  -- Pick first 6 customers
  SELECT id INTO c1 FROM customers ORDER BY id LIMIT 1 OFFSET 0;
  SELECT id INTO c2 FROM customers ORDER BY id LIMIT 1 OFFSET 1;
  SELECT id INTO c3 FROM customers ORDER BY id LIMIT 1 OFFSET 2;
  SELECT id INTO c4 FROM customers ORDER BY id LIMIT 1 OFFSET 3;
  SELECT id INTO c5 FROM customers ORDER BY id LIMIT 1 OFFSET 4;
  SELECT id INTO c6 FROM customers ORDER BY id LIMIT 1 OFFSET 5;

  -- Pick first 2 agents (Sales role)
  SELECT id INTO a1 FROM users WHERE role = 'Sales' ORDER BY id LIMIT 1 OFFSET 0;
  SELECT id INTO a2 FROM users WHERE role = 'Sales' ORDER BY id LIMIT 1 OFFSET 1;

  -- Fallback: if only 1 agent, use same for both
  IF a2 IS NULL THEN a2 := a1; END IF;
  -- Fallback: if fewer than 6 customers, reuse
  IF c4 IS NULL THEN c4 := c1; END IF;
  IF c5 IS NULL THEN c5 := c2; END IF;
  IF c6 IS NULL THEN c6 := c3; END IF;

  INSERT INTO call_logs
    (customer_id, agent_id, call_date, call_status, call_summary,
     quotation_sent, quotation_number,
     converted_to_sale, invoice_number, sale_value,
     next_schedule_date)
  VALUES
    -- 1. Connected — just a conversation
    (c1, a1,
     NOW() - INTERVAL '5 days',
     'Connected',
     'Spoke with the owner. He is actively constructing the second floor. Interested in cement and steel. Will call back next week.',
     FALSE, NULL, FALSE, NULL, NULL,
     NULL),

    -- 2. Callback Requested
    (c2, a1,
     NOW() - INTERVAL '4 days',
     'Callback Requested',
     'Customer was busy at site. Asked to call back on Thursday morning between 10-11 AM.',
     FALSE, NULL, FALSE, NULL, NULL,
     NOW() + INTERVAL '3 days'),

    -- 3. Quotation Sent
    (c3, a2,
     NOW() - INTERVAL '3 days',
     'Quotation Sent',
     'Discussed requirements for roofing material. Customer asked for a quote on 500 bags of cement. Quotation shared over WhatsApp.',
     TRUE, 'QT-2025-001', FALSE, NULL, NULL,
     NULL),

    -- 4. Not Interested
    (c4, a2,
     NOW() - INTERVAL '2 days',
     'Not Interested',
     'Customer said construction is on hold due to financing issues. Not interested at this time.',
     FALSE, NULL, FALSE, NULL, NULL,
     NULL),

    -- 5. Converted — sale closed
    (c5, a1,
     NOW() - INTERVAL '1 day',
     'Converted',
     'Customer confirmed the order after reviewing the quotation. Sale closed for 500 bags of cement and 2 tons of steel.',
     TRUE, 'QT-2025-002', TRUE, 'INV-2025-101', 87500.00,
     NULL),

    -- 6. Not Connected
    (c6, a2,
     NOW() - INTERVAL '6 hours',
     'Not Connected',
     'Called twice, no answer. Will try again tomorrow.',
     FALSE, NULL, FALSE, NULL, NULL,
     NULL);

  RAISE NOTICE 'Inserted 6 test call_logs entries successfully.';
END;
$$;

-- Verify
SELECT
  cl.id,
  c.name  AS customer,
  u.name  AS agent,
  cl.call_status,
  cl.call_date::DATE AS date,
  cl.sale_value
FROM call_logs cl
JOIN customers c ON c.id = cl.customer_id
JOIN users     u ON u.id = cl.agent_id
ORDER BY cl.call_date DESC;
