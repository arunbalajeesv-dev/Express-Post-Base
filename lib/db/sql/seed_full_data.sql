-- ================================================================
--  FULL MOCK DATA SEED
--  Tests: Dashboard, Call Logs, Reports, Customers, Schedule,
--         Agent Profile (calls + visits + export), Customer Detail
--
--  Safe to re-run — customers use ON CONFLICT DO NOTHING.
--  Run in Supabase SQL Editor.
-- ================================================================

DO $$
DECLARE
  -- Agent IDs
  a1 INT; a2 INT;

  -- Customer IDs
  c1  INT; c2  INT; c3  INT; c4  INT; c5  INT; c6  INT;
  c7  INT; c8  INT; c9  INT; c10 INT; c11 INT; c12 INT;

BEGIN

  -- ── Pick agents ───────────────────────────────────────────────
  SELECT id INTO a1 FROM users WHERE role = 'Sales' ORDER BY id LIMIT 1 OFFSET 0;
  SELECT id INTO a2 FROM users WHERE role = 'Sales' ORDER BY id LIMIT 1 OFFSET 1;
  IF a2 IS NULL THEN a2 := a1; END IF;

  -- ── Insert customers (skip if mobile already exists) ──────────
  INSERT INTO customers (name, mobile, company_name) VALUES
    ('Arun Selvam',    '9841001001', 'Chennai Constructions Pvt Ltd')
  ON CONFLICT (mobile) DO NOTHING;

  INSERT INTO customers (name, mobile, company_name) VALUES
    ('Priya Menon',    '9841001002', 'Menon Builders')
  ON CONFLICT (mobile) DO NOTHING;

  INSERT INTO customers (name, mobile, company_name) VALUES
    ('Karthik Raja',   '9841001003', 'KR Infrastructure')
  ON CONFLICT (mobile) DO NOTHING;

  INSERT INTO customers (name, mobile, company_name) VALUES
    ('Suma Devi',      '9841001004', NULL)
  ON CONFLICT (mobile) DO NOTHING;

  INSERT INTO customers (name, mobile, company_name) VALUES
    ('Rajesh Kumar',   '9841001005', 'Rajesh Constructions')
  ON CONFLICT (mobile) DO NOTHING;

  INSERT INTO customers (name, mobile, company_name) VALUES
    ('Fatima Khan',    '9841001006', 'Khan Developers')
  ON CONFLICT (mobile) DO NOTHING;

  INSERT INTO customers (name, mobile, company_name) VALUES
    ('Vijay Anand',    '9841001007', 'VA Builders')
  ON CONFLICT (mobile) DO NOTHING;

  INSERT INTO customers (name, mobile, company_name) VALUES
    ('Lakshmi Priya',  '9841001008', NULL)
  ON CONFLICT (mobile) DO NOTHING;

  INSERT INTO customers (name, mobile, company_name) VALUES
    ('Senthil Nathan', '9841001009', 'SN Constructions')
  ON CONFLICT (mobile) DO NOTHING;

  INSERT INTO customers (name, mobile, company_name) VALUES
    ('Divya Krishnan', '9841001010', 'DK Homes')
  ON CONFLICT (mobile) DO NOTHING;

  INSERT INTO customers (name, mobile, company_name) VALUES
    ('Mani Shankar',   '9841001011', 'MS Infrastructure')
  ON CONFLICT (mobile) DO NOTHING;

  INSERT INTO customers (name, mobile, company_name) VALUES
    ('Renu Devi',      '9841001012', NULL)
  ON CONFLICT (mobile) DO NOTHING;

  -- ── Fetch inserted customer IDs ───────────────────────────────
  SELECT id INTO c1  FROM customers WHERE mobile = '9841001001';
  SELECT id INTO c2  FROM customers WHERE mobile = '9841001002';
  SELECT id INTO c3  FROM customers WHERE mobile = '9841001003';
  SELECT id INTO c4  FROM customers WHERE mobile = '9841001004';
  SELECT id INTO c5  FROM customers WHERE mobile = '9841001005';
  SELECT id INTO c6  FROM customers WHERE mobile = '9841001006';
  SELECT id INTO c7  FROM customers WHERE mobile = '9841001007';
  SELECT id INTO c8  FROM customers WHERE mobile = '9841001008';
  SELECT id INTO c9  FROM customers WHERE mobile = '9841001009';
  SELECT id INTO c10 FROM customers WHERE mobile = '9841001010';
  SELECT id INTO c11 FROM customers WHERE mobile = '9841001011';
  SELECT id INTO c12 FROM customers WHERE mobile = '9841001012';

  -- ── Visits (12 entries, spread over last 45 days) ─────────────
  -- Columns: user_id, customer_id, area, site_stage, feedback,
  --          visit_date, visit_time, notes, location_link, customer_type
  INSERT INTO visits (user_id, customer_id, area, site_stage, feedback, visit_date, visit_time, notes, location_link, customer_type) VALUES
    (a1, c1,  'Anna Nagar',      'New Site/ Foundation',  'Interested',     NOW() - INTERVAL '40 days', '09:30', 'New plot, owner planning G+2. Interested in cement and steel pricing.',  '', 'Owner'),
    (a2, c2,  'T.Nagar',         'Brickwork',             'Potential',      NOW() - INTERVAL '35 days', '11:00', 'Brickwork in progress. Showed interest in ACC cement.',                  '', 'Contractor'),
    (a1, c3,  'Velachery',       'Plastering',            'Interested',     NOW() - INTERVAL '30 days', '10:15', 'Plastering stage. Asked for quotes on wall putty and primer.',           '', 'Owner'),
    (a2, c4,  'Tambaram',        'Roofing',               'Potential',      NOW() - INTERVAL '25 days', '14:00', 'Roof slab casting next week. Need TMT bars urgently.',                   '', 'Owner'),
    (a1, c5,  'Adyar',           'Painting/ Tiles',       'Interested',     NOW() - INTERVAL '22 days', '09:00', 'Final stage. Interested in tiles and waterproofing solutions.',          '', 'Owner'),
    (a2, c6,  'OMR',             'Plumbing/ Electrical',  'Interested',     NOW() - INTERVAL '18 days', '10:30', 'Plumbing work ongoing. Asked for CPVC pipe rates.',                      '', 'Contractor'),
    (a1, c7,  'Chromepet',       'Finishing Stage',       'Interested',     NOW() - INTERVAL '15 days', '08:45', 'Almost done. Looking for interior finish materials.',                   '', 'Owner'),
    (a2, c8,  'Porur',           'Brickwork',             'Not Interested', NOW() - INTERVAL '12 days', '13:00', 'Using local supplier. Not interested currently.',                        '', 'Owner'),
    (a1, c9,  'Perambur',        'New Site/ Foundation',  'Interested',     NOW() - INTERVAL '10 days', '09:30', 'New construction. Open to discussing bulk pricing for cement.',          '', 'Owner'),
    (a2, c10, 'Guindy',          'Plastering',            'Potential',      NOW() - INTERVAL '7 days',  '11:30', 'Plastering in progress. Evaluating multiple suppliers.',                 '', 'Contractor'),
    (a1, c11, 'Nungambakkam',    'Roofing',               'Interested',     NOW() - INTERVAL '4 days',  '10:00', 'Roofing slab in 2 weeks. Requested detailed product list and pricing.',  '', 'Owner'),
    (a2, c12, 'Sholinganallur',  'Painting/ Tiles',       'Potential',      NOW() - INTERVAL '2 days',  '15:00', 'Finishing soon. Interested in premium tiles for living area.',           '', 'Owner');

  -- ── Call Logs (15 entries, varied statuses & dates) ───────────
  INSERT INTO call_logs
    (customer_id, agent_id, call_date, call_status, call_summary,
     quotation_sent, quotation_number,
     converted_to_sale, invoice_number, sale_value,
     next_schedule_date)
  VALUES

  -- 1. Connected — general follow up
  (c1, a1,
   NOW() - INTERVAL '38 days',
   'Connected',
   'Spoke with owner about foundation progress. Shared cement brand options. He will review and call back.',
   FALSE, NULL, FALSE, NULL, NULL, NULL),

  -- 2. Quotation Sent
  (c1, a1,
   NOW() - INTERVAL '30 days',
   'Quotation Sent',
   'Owner requested quote for 800 bags of OPC 53 cement and 3 tons of TMT bars. Shared detailed quotation over WhatsApp.',
   TRUE, 'QT-2026-001', FALSE, NULL, NULL, NULL),

  -- 3. Converted — sale closed for c1
  (c1, a1,
   NOW() - INTERVAL '22 days',
   'Converted',
   'Customer confirmed order for 800 bags cement and 3 tons TMT bars after price negotiation. Payment received.',
   TRUE, 'QT-2026-001', TRUE, 'INV-2026-101', 142000.00, NULL),

  -- 4. Callback Requested
  (c2, a2,
   NOW() - INTERVAL '33 days',
   'Callback Requested',
   'Customer was at site during call. Asked to call back Thursday between 10-11 AM.',
   FALSE, NULL, FALSE, NULL, NULL, NOW() - INTERVAL '30 days'),

  -- 5. Quotation Sent for c2
  (c2, a2,
   NOW() - INTERVAL '28 days',
   'Quotation Sent',
   'Brickwork ongoing. Customer asked for quote on 500 bags of cement. Shared QT-2026-002.',
   TRUE, 'QT-2026-002', FALSE, NULL, NULL, NULL),

  -- 6. Converted — c2 closed
  (c2, a2,
   NOW() - INTERVAL '20 days',
   'Converted',
   'Confirmed order for 500 bags OPC cement. Invoice raised. Delivery scheduled for Monday.',
   TRUE, 'QT-2026-002', TRUE, 'INV-2026-102', 89500.00, NULL),

  -- 7. Not Connected
  (c3, a1,
   NOW() - INTERVAL '28 days',
   'Not Connected',
   'Called twice, phone switched off. Will retry tomorrow morning.',
   FALSE, NULL, FALSE, NULL, NULL, NULL),

  -- 8. Connected — plastering discussion
  (c3, a1,
   NOW() - INTERVAL '20 days',
   'Connected',
   'Discussed plastering material needs. Customer comparing prices. Interested in river sand and wall putty. Will decide by weekend.',
   FALSE, NULL, FALSE, NULL, NULL, NULL),

  -- 9. Quotation Sent for c3
  (c3, a1,
   NOW() - INTERVAL '12 days',
   'Quotation Sent',
   'Sent quote for wall putty (50 bags) and river sand (10 units). Customer reviewing.',
   TRUE, 'QT-2026-003', FALSE, NULL, NULL, NOW() + INTERVAL '3 days'),

  -- 10. Not Interested
  (c4, a2,
   NOW() - INTERVAL '23 days',
   'Not Interested',
   'Customer said construction stalled due to permit delay. Not interested in purchasing for now.',
   FALSE, NULL, FALSE, NULL, NULL, NULL),

  -- 11. Connected — roofing discussion
  (c5, a1,
   NOW() - INTERVAL '20 days',
   'Connected',
   'Final painting stage. Interested in waterproofing coat for terrace. Shared product brochure.',
   FALSE, NULL, FALSE, NULL, NULL, NULL),

  -- 12. Quotation Sent + upcoming conversion
  (c5, a1,
   NOW() - INTERVAL '10 days',
   'Quotation Sent',
   'Sent pricing for Dr. Fixit waterproofing solution (2 drums) and tile adhesive (20 bags).',
   TRUE, 'QT-2026-004', FALSE, NULL, NULL, NOW() + INTERVAL '5 days'),

  -- 13. Callback Requested — scheduled in future (tests Schedule page)
  (c9, a1,
   NOW() - INTERVAL '8 days',
   'Callback Requested',
   'Customer interested in bulk cement for foundation work. Requested detailed pricing. Scheduled callback for next week.',
   FALSE, NULL, FALSE, NULL, NULL, NOW() + INTERVAL '4 days'),

  -- 14. Connected — recent call
  (c11, a1,
   NOW() - INTERVAL '3 days',
   'Connected',
   'Roofing slab casting confirmed for next Monday. Customer wants 600 bags of cement. Sending quotation today.',
   FALSE, NULL, FALSE, NULL, NULL, NULL),

  -- 15. Quotation Sent — very recent
  (c11, a1,
   NOW() - INTERVAL '1 day',
   'Quotation Sent',
   'Shared quote for 600 bags OPC 53 cement and 4 tons Fe500 TMT bars. Customer reviewing overnight.',
   TRUE, 'QT-2026-005', FALSE, NULL, NULL, NOW() + INTERVAL '2 days');

  RAISE NOTICE 'Seed completed: 12 customers, 12 visits, 15 call logs inserted.';
END;
$$;

-- ── VERIFY ───────────────────────────────────────────────────────
SELECT 'Customers' AS entity, COUNT(*) FROM customers WHERE mobile LIKE '984100100%'
UNION ALL
SELECT 'Visits',   COUNT(*) FROM visits   WHERE customer_id IN (SELECT id FROM customers WHERE mobile LIKE '984100100%')
UNION ALL
SELECT 'Call Logs',COUNT(*) FROM call_logs WHERE customer_id IN (SELECT id FROM customers WHERE mobile LIKE '984100100%');
