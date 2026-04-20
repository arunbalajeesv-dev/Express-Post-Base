CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  mobile TEXT NOT NULL,
  role TEXT NOT NULL,
  user_id TEXT NOT NULL,
  password TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  mobile TEXT NOT NULL UNIQUE,
  company_name TEXT,
  lead_status TEXT,
  lead_score INTEGER,
  last_interaction_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS brands (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS visits (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  area TEXT,
  site_stage TEXT,
  feedback TEXT,
  visit_date DATE NOT NULL,
  visit_time TIME NOT NULL,
  notes TEXT,
  image_url TEXT
);

CREATE TABLE IF NOT EXISTS visit_brands (
  id SERIAL PRIMARY KEY,
  visit_id INTEGER NOT NULL REFERENCES visits(id),
  brand_id INTEGER REFERENCES brands(id),
  custom_brand_name TEXT,
  CONSTRAINT visit_brands_brand_or_custom_check CHECK (
    brand_id IS NOT NULL OR custom_brand_name IS NOT NULL
  )
);

ALTER TABLE visit_brands DROP COLUMN IF EXISTS brand_name;

CREATE UNIQUE INDEX IF NOT EXISTS brands_lower_name_unique_idx
  ON brands (LOWER(name));

CREATE UNIQUE INDEX IF NOT EXISTS visit_brands_visit_brand_unique_idx
  ON visit_brands (visit_id, brand_id)
  WHERE brand_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS visit_brands_visit_custom_unique_idx
  ON visit_brands (visit_id, LOWER(custom_brand_name))
  WHERE custom_brand_name IS NOT NULL;

CREATE TABLE IF NOT EXISTS followups (
  id SERIAL PRIMARY KEY,
  visit_id INTEGER NOT NULL REFERENCES visits(id),
  followup_date DATE NOT NULL,
  status TEXT NOT NULL,
  notes TEXT
);