-- ============================================================
--  SALES TRACKING APP — SAMPLE DATA SEED
--  Run: psql "$DATABASE_URL" -f scripts/seed.sql
-- ============================================================

BEGIN;

-- ── 1. BRANDS ────────────────────────────────────────────────
INSERT INTO brands (name) VALUES
  ('Asian Paints'),
  ('Birla White'),
  ('Ambuja Cement'),
  ('JSW Steel'),
  ('Saint-Gobain'),
  ('Berger Paints'),
  ('ACC Cement')
ON CONFLICT (name) DO NOTHING;

-- ── 2. SALES AGENTS ──────────────────────────────────────────
-- password = bcrypt("agent123", rounds=10) — pre-computed
INSERT INTO users (user_id, name, mobile, role, password)
SELECT 'agent02','Priya Sharma','9988776655','Sales','$2b$10$mY1Ug8kDXU8EheKq/59fBeBqGB0q./D5G306PaBC4qYXBwB4FHCVK'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE user_id='agent02');

INSERT INTO users (user_id, name, mobile, role, password)
SELECT 'agent03','Suresh Patel','9977665544','Sales','$2b$10$mY1Ug8kDXU8EheKq/59fBeBqGB0q./D5G306PaBC4qYXBwB4FHCVK'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE user_id='agent03');

INSERT INTO users (user_id, name, mobile, role, password)
SELECT 'agent04','Anita Verma','9966554433','Sales','$2b$10$mY1Ug8kDXU8EheKq/59fBeBqGB0q./D5G306PaBC4qYXBwB4FHCVK'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE user_id='agent04');

-- ── 3. CUSTOMERS ─────────────────────────────────────────────
INSERT INTO customers (name, mobile, company_name) VALUES
  ('Arjun Reddy',     '9800001111', 'Reddy Constructions'),
  ('Kavitha Nair',    '9800002222', 'Nair Builders Pvt Ltd'),
  ('Manoj Gupta',     '9800003333', 'Gupta Infrastructure'),
  ('Sunita Joshi',    '9800004444', NULL),
  ('Deepak Malhotra', '9800005555', 'Malhotra Homes'),
  ('Fatima Sheikh',   '9800006666', 'Sheikh Developers'),
  ('Ramesh Iyer',     '9800007777', NULL),
  ('Pooja Agarwal',   '9800008888', 'Agarwal Real Estate'),
  ('Vikram Singh',    '9800009999', 'Singh Construction Co'),
  ('Lakshmi Rao',     '9800010000', 'Rao Infra Projects'),
  ('Sunil Mehta',     '9800011111', NULL),
  ('Ananya Das',      '9800012222', 'Das Property Group')
ON CONFLICT (mobile) DO NOTHING;

-- ── 4. VISITS ────────────────────────────────────────────────
INSERT INTO visits
  (user_id, customer_id, area, layout, location_link, site_stage, feedback, notes, image_url, visit_date, visit_time)
SELECT
  u.id,
  c.id,
  v.area,
  v.layout,
  v.location_link,
  v.site_stage,
  v.feedback,
  v.notes,
  '/api/uploads/sample-site.jpg',
  (CURRENT_DATE - v.days_ago::int),
  v.visit_time::time
FROM (VALUES
  -- agent01 (7 visits)
  ('agent01','9800001111','North Zone','Green Valley Phase 2',     'https://maps.google.com/?q=12.9716,77.5946','Brickwork',            'Interested',     'Very keen on UltraTech, requested follow-up next week',         '1','09:15:00'),
  ('agent01','9800002222','South Zone','Prestige Lakeside',         'https://maps.google.com/?q=13.0827,80.2707','Plastering',           'Potential',      'Open to switching from competitor, needs pricing details',      '2','11:00:00'),
  ('agent01','9800003333','East Zone', 'Skylark Towers',            'https://maps.google.com/?q=19.0760,72.8777','Finishing Stage',      'Interested',     'Ready to place bulk order for Phase 3',                        '3','10:30:00'),
  ('agent01','9800004444','West Zone', NULL,                        'https://maps.google.com/?q=28.6139,77.2090','New Site/ Foundation', 'Not Interested', 'Already finalised with competitor, revisit in 3 months',        '5','14:00:00'),
  ('agent01','9800005555','Central',   'Lotus Grand',               'https://maps.google.com/?q=17.3850,78.4867','Roofing',              'Interested',     'Interested in JSW Steel + Asian Paints combo deal',            '7','09:45:00'),
  ('agent01','9800006666','Suburban',  'Sunrise Heights',           'https://maps.google.com/?q=22.5726,88.3639','Painting/ Tiles',      'Potential',      'Price negotiation pending, send updated quote',                 '9','15:30:00'),
  ('agent01','9800007777','North Zone','Palm Grove',                'https://maps.google.com/?q=18.5204,73.8567','Plumbing/ Electrical', 'Interested',     'Approved budget for Saint-Gobain glass panels',                '11','08:30:00'),
  -- agent02 (6 visits)
  ('agent02','9800008888','East Zone', 'Agarwal City Towers',       'https://maps.google.com/?q=12.9716,77.5946','Plastering',           'Interested',     'Builder interested in Birla White for entire project',          '1','10:00:00'),
  ('agent02','9800009999','South Zone','Singh Residency',           'https://maps.google.com/?q=13.0827,80.2707','Brickwork',            'Potential',      'Waiting for bank loan approval before ordering',                '2','11:30:00'),
  ('agent02','9800010000','North Zone','Rao Enclave',               'https://maps.google.com/?q=19.0760,72.8777','Painting/ Tiles',      'Interested',     'Closing next week, needs delivery schedule confirmed',          '4','09:00:00'),
  ('agent02','9800011111','West Zone', NULL,                        'https://maps.google.com/?q=28.6139,77.2090','Finishing Stage',      'Not Interested', 'Budget constraints, project on hold until Q3',                 '6','13:00:00'),
  ('agent02','9800012222','Central',   'Das Platinum',              'https://maps.google.com/?q=17.3850,78.4867','Roofing',              'Potential',      'Multiple vendors being evaluated, need competitive pricing',    '8','10:45:00'),
  ('agent02','9800001111','Suburban',  'Reddy Phase 1',             'https://maps.google.com/?q=22.5726,88.3639','New Site/ Foundation', 'Interested',     'Site just commenced, needs full material estimate',            '10','16:00:00'),
  -- agent03 (5 visits)
  ('agent03','9800002222','South Zone','Nair Greens',               'https://maps.google.com/?q=12.9716,77.5946','Brickwork',            'Potential',      'Comparing Ambuja vs UltraTech, share technical specs',          '1','09:30:00'),
  ('agent03','9800003333','East Zone', 'Gupta Signature',           'https://maps.google.com/?q=13.0827,80.2707','Plastering',           'Interested',     'Ready to proceed, needs invoice by end of week',               '3','11:15:00'),
  ('agent03','9800004444','North Zone','Joshi Towers',              'https://maps.google.com/?q=19.0760,72.8777','Finishing Stage',      'Interested',     'Referral from Rajesh Kumar, high priority lead',               '5','10:00:00'),
  ('agent03','9800005555','West Zone', 'Malhotra Heights',          'https://maps.google.com/?q=28.6139,77.2090','Painting/ Tiles',      'Potential',      'Requested sample products for on-site testing',                '7','14:30:00'),
  ('agent03','9800006666','Central',   NULL,                        'https://maps.google.com/?q=17.3850,78.4867','Roofing',              'Not Interested', 'Went with local vendor, keep in follow-up pipeline',           '12','12:00:00'),
  -- agent04 (6 visits)
  ('agent04','9800007777','North Zone','Ramesh Village Phase 2',    'https://maps.google.com/?q=22.5726,88.3639','Plumbing/ Electrical', 'Interested',     'Large housing project, needs 500 bags Ambuja Cement',          '2','08:45:00'),
  ('agent04','9800008888','South Zone','Pooja Heights',             'https://maps.google.com/?q=18.5204,73.8567','Brickwork',            'Potential',      'Decision maker on leave, revisit next Monday',                  '4','10:30:00'),
  ('agent04','9800009999','East Zone', 'Vikram Towers',             'https://maps.google.com/?q=12.9716,77.5946','Plastering',           'Interested',     'Signed LOI, procurement order expected this week',             '6','09:15:00'),
  ('agent04','9800010000','West Zone', 'Lakshmi Grand',             'https://maps.google.com/?q=13.0827,80.2707','New Site/ Foundation', 'Potential',      'Architect recommended our products, initial discussion done',   '8','14:00:00'),
  ('agent04','9800011111','Suburban',  NULL,                        'https://maps.google.com/?q=19.0760,72.8777','Painting/ Tiles',      'Interested',     'Wants Asian Paints + Berger combo, share colour chart',        '10','11:45:00'),
  ('agent04','9800012222','Central',   NULL,                        'https://maps.google.com/?q=28.6139,77.2090','Finishing Stage',      'Not Interested', 'Project cancelled by owner, remove from active pipeline',      '14','15:00:00')
) AS v(user_login, mobile, area, layout, location_link, site_stage, feedback, notes, days_ago, visit_time)
JOIN users u      ON u.user_id = v.user_login
JOIN customers c  ON c.mobile  = v.mobile;

-- ── 5. VISIT BRANDS ──────────────────────────────────────────
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT v.id AS vid, b.id AS bid
    FROM (VALUES
      ('agent01','9800001111','North Zone','Brickwork',            'UltraTech'),
      ('agent01','9800001111','North Zone','Brickwork',            'Ambuja Cement'),
      ('agent01','9800002222','South Zone','Plastering',           'Birla White'),
      ('agent01','9800002222','South Zone','Plastering',           'Asian Paints'),
      ('agent01','9800003333','East Zone', 'Finishing Stage',      'UltraTech'),
      ('agent01','9800003333','East Zone', 'Finishing Stage',      'JSW Steel'),
      ('agent01','9800004444','West Zone', 'New Site/ Foundation', 'Ambuja Cement'),
      ('agent01','9800005555','Central',   'Roofing',              'JSW Steel'),
      ('agent01','9800005555','Central',   'Roofing',              'Asian Paints'),
      ('agent01','9800006666','Suburban',  'Painting/ Tiles',      'Asian Paints'),
      ('agent01','9800006666','Suburban',  'Painting/ Tiles',      'Berger Paints'),
      ('agent01','9800007777','North Zone','Plumbing/ Electrical', 'Saint-Gobain'),
      ('agent02','9800008888','East Zone', 'Plastering',           'Birla White'),
      ('agent02','9800008888','East Zone', 'Plastering',           'UltraTech'),
      ('agent02','9800009999','South Zone','Brickwork',            'Ambuja Cement'),
      ('agent02','9800010000','North Zone','Painting/ Tiles',      'Asian Paints'),
      ('agent02','9800010000','North Zone','Painting/ Tiles',      'Berger Paints'),
      ('agent02','9800011111','West Zone', 'Finishing Stage',      'ACC Cement'),
      ('agent02','9800012222','Central',   'Roofing',              'UltraTech'),
      ('agent02','9800012222','Central',   'Roofing',              'ACC Cement'),
      ('agent02','9800001111','Suburban',  'New Site/ Foundation', 'Ambuja Cement'),
      ('agent02','9800001111','Suburban',  'New Site/ Foundation', 'JSW Steel'),
      ('agent03','9800002222','South Zone','Brickwork',            'Ambuja Cement'),
      ('agent03','9800002222','South Zone','Brickwork',            'UltraTech'),
      ('agent03','9800003333','East Zone', 'Plastering',           'Birla White'),
      ('agent03','9800004444','North Zone','Finishing Stage',      'UltraTech'),
      ('agent03','9800004444','North Zone','Finishing Stage',      'Asian Paints'),
      ('agent03','9800005555','West Zone', 'Painting/ Tiles',      'Asian Paints'),
      ('agent03','9800005555','West Zone', 'Painting/ Tiles',      'Saint-Gobain'),
      ('agent03','9800006666','Central',   'Roofing',              'Berger Paints'),
      ('agent04','9800007777','North Zone','Plumbing/ Electrical', 'Ambuja Cement'),
      ('agent04','9800007777','North Zone','Plumbing/ Electrical', 'JSW Steel'),
      ('agent04','9800008888','South Zone','Brickwork',            'Birla White'),
      ('agent04','9800008888','South Zone','Brickwork',            'ACC Cement'),
      ('agent04','9800009999','East Zone', 'Plastering',           'UltraTech'),
      ('agent04','9800009999','East Zone', 'Plastering',           'Ambuja Cement'),
      ('agent04','9800010000','West Zone', 'New Site/ Foundation', 'ACC Cement'),
      ('agent04','9800010000','West Zone', 'New Site/ Foundation', 'JSW Steel'),
      ('agent04','9800011111','Suburban',  'Painting/ Tiles',      'Asian Paints'),
      ('agent04','9800011111','Suburban',  'Painting/ Tiles',      'Berger Paints'),
      ('agent04','9800012222','Central',   'Finishing Stage',      'Saint-Gobain')
    ) AS m(user_login, mobile, area, site_stage, brand_name)
    JOIN users u      ON u.user_id    = m.user_login
    JOIN customers c  ON c.mobile     = m.mobile
    JOIN visits v     ON v.user_id    = u.id
                    AND v.customer_id = c.id
                    AND v.area        = m.area
                    AND v.site_stage  = m.site_stage
    JOIN brands b     ON b.name       = m.brand_name
  LOOP
    INSERT INTO visit_brands (visit_id, brand_id)
    SELECT r.vid, r.bid
    WHERE NOT EXISTS (
      SELECT 1 FROM visit_brands WHERE visit_id = r.vid AND brand_id = r.bid
    );
  END LOOP;
END$$;

-- ── 6. FOLLOW-UPS ────────────────────────────────────────────
INSERT INTO followups (visit_id, followup_date, status, notes, sale_amount, invoice_number, converted_at)
SELECT
  v.id,
  f.followup_date::date,
  f.status,
  f.notes,
  NULLIF(f.sale_amount, '')::numeric,
  NULLIF(f.invoice_number, ''),
  CASE WHEN f.status = 'Converted' THEN NOW() ELSE NULL END
FROM (VALUES
  -- Pending
  ('agent01','9800001111','North Zone','Brickwork',            (CURRENT_DATE+2)::text,  'Pending',   'Confirm order quantity and delivery schedule',            '',             ''),
  ('agent01','9800002222','South Zone','Plastering',           (CURRENT_DATE+4)::text,  'Pending',   'Check if bank loan approval is through',                 '',             ''),
  ('agent01','9800003333','East Zone', 'Finishing Stage',      (CURRENT_DATE+3)::text,  'Pending',   'Share revised quote for Phase 3 materials',               '',             ''),
  ('agent02','9800008888','East Zone', 'Plastering',           (CURRENT_DATE+5)::text,  'Pending',   'Follow up after site engineer review',                   '',             ''),
  ('agent02','9800009999','South Zone','Brickwork',            (CURRENT_DATE+1)::text,  'Pending',   'Decision expected, call Monday morning',                 '',             ''),
  ('agent03','9800002222','South Zone','Brickwork',            (CURRENT_DATE+6)::text,  'Pending',   'Send Ambuja vs UltraTech technical comparison sheet',    '',             ''),
  ('agent04','9800007777','North Zone','Plumbing/ Electrical', (CURRENT_DATE+3)::text,  'Pending',   'Check if site engineer review is complete',              '',             ''),
  ('agent04','9800009999','East Zone', 'Plastering',           (CURRENT_DATE+7)::text,  'Pending',   'Procurement order expected, follow up with purchase team','',            ''),
  ('agent04','9800011111','Suburban',  'Painting/ Tiles',      (CURRENT_DATE+9)::text,  'Pending',   'Share colour chart for Asian Paints + Berger combo',    '',             ''),
  -- Completed
  ('agent01','9800005555','Central',   'Roofing',              (CURRENT_DATE-3)::text,  'Completed', 'Met site engineer, product approved for project',        '',             ''),
  ('agent02','9800010000','North Zone','Painting/ Tiles',      (CURRENT_DATE-5)::text,  'Completed', 'Submitted final quote, awaiting purchase order',         '',             ''),
  ('agent03','9800003333','East Zone', 'Plastering',           (CURRENT_DATE-2)::text,  'Completed', 'Sample products delivered, feedback very positive',      '',             ''),
  ('agent04','9800008888','South Zone','Brickwork',            (CURRENT_DATE-4)::text,  'Completed', 'Architect meeting done, spec included in BOQ',           '',             ''),
  ('agent02','9800012222','Central',   'Roofing',              (CURRENT_DATE-6)::text,  'Completed', 'Site visit done, proposal submitted to management',      '',             ''),
  -- Converted
  ('agent01','9800007777','North Zone','Plumbing/ Electrical', (CURRENT_DATE-8)::text,  'Converted', 'Order placed for 200 units Saint-Gobain glass panels',   '148000', 'INV-2026-021'),
  ('agent01','9800004444','West Zone', 'New Site/ Foundation', (CURRENT_DATE-12)::text, 'Converted', 'Bulk order confirmed for Painting/Tiles phase materials','235000', 'INV-2026-022'),
  ('agent02','9800011111','West Zone', 'Finishing Stage',      (CURRENT_DATE-6)::text,  'Converted', 'Full project supply agreement signed and PO received',   '415000', 'INV-2026-023'),
  ('agent03','9800004444','North Zone','Finishing Stage',      (CURRENT_DATE-9)::text,  'Converted', 'Purchase order received for Finishing Stage materials',   '189500', 'INV-2026-024'),
  ('agent04','9800010000','West Zone', 'New Site/ Foundation', (CURRENT_DATE-7)::text,  'Converted', 'Large combo deal, Asian Paints + Berger confirmed',      '327000', 'INV-2026-025'),
  ('agent03','9800005555','West Zone', 'Painting/ Tiles',      (CURRENT_DATE-11)::text, 'Converted', 'Closed deal on UltraTech + Asian Paints full package',   '278000', 'INV-2026-026')
) AS f(user_login, mobile, area, site_stage, followup_date, status, notes, sale_amount, invoice_number)
JOIN users u      ON u.user_id    = f.user_login
JOIN customers c  ON c.mobile     = f.mobile
JOIN visits v     ON v.user_id    = u.id
               AND v.customer_id  = c.id
               AND v.area         = f.area
               AND v.site_stage   = f.site_stage;

COMMIT;

-- ── Summary ───────────────────────────────────────────────────
\echo ''
\echo '=== Seed Complete ==='
SELECT table_name, rows FROM (VALUES
  ('users',        (SELECT count(*)::int FROM users)),
  ('customers',    (SELECT count(*)::int FROM customers)),
  ('brands',       (SELECT count(*)::int FROM brands)),
  ('visits',       (SELECT count(*)::int FROM visits)),
  ('visit_brands', (SELECT count(*)::int FROM visit_brands)),
  ('followups',    (SELECT count(*)::int FROM followups)),
  ('  Pending',    (SELECT count(*)::int FROM followups WHERE status='Pending')),
  ('  Completed',  (SELECT count(*)::int FROM followups WHERE status='Completed')),
  ('  Converted',  (SELECT count(*)::int FROM followups WHERE status='Converted'))
) AS t(table_name, rows);
