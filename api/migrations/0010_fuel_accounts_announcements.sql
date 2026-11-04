-- Fuel account configuration and historical reference. No historic spreadsheet estimate is treated as a payment.
CREATE TABLE IF NOT EXISTS fuel_settings (
 id INTEGER PRIMARY KEY CHECK(id=1),
 liters_per_cm REAL NOT NULL CHECK(liters_per_cm>0 AND liters_per_cm<=1000),
 price_cents_per_liter INTEGER NOT NULL CHECK(price_cents_per_liter>0 AND price_cents_per_liter<=100000),
 updated_by TEXT REFERENCES users(id),
 updated_at TEXT NOT NULL
);
INSERT OR IGNORE INTO fuel_settings(id,liters_per_cm,price_cents_per_liter,updated_at) VALUES(1,20,100,datetime('now'));

-- Optional reconciled opening position, established by the administrator.
-- Historical spent amounts are ESTIMATES, not invoices; negatives are not payment arrears.
CREATE TABLE IF NOT EXISTS fuel_openings (
 apartment_id TEXT PRIMARY KEY REFERENCES apartments(id),
 as_of TEXT NOT NULL,
 deposited_cents INTEGER NOT NULL CHECK(deposited_cents>=0),
 estimated_consumed_cents INTEGER NOT NULL CHECK(estimated_consumed_cents>=0),
 note TEXT NOT NULL DEFAULT '',
 confirmed_by TEXT NOT NULL REFERENCES users(id),
 confirmed_at TEXT NOT NULL
);

-- Snapshot figures were transcribed from the 2026-04-22 spreadsheet. For reference only.
-- These are NOT inserted into payments or active fuel openings automatically.
CREATE TABLE IF NOT EXISTS fuel_legacy_snapshots (
 apartment_id TEXT PRIMARY KEY REFERENCES apartments(id),
 as_of TEXT NOT NULL,
 reported_deposited_cents INTEGER NOT NULL,
 reported_estimated_consumed_cents INTEGER NOT NULL,
 source TEXT NOT NULL
);
INSERT OR IGNORE INTO fuel_legacy_snapshots(apartment_id,as_of,reported_deposited_cents,reported_estimated_consumed_cents,source)
 SELECT a.id,'2026-04-22',50000,
  CASE a.code WHEN 'A1' THEN 64206 WHEN 'A2' THEN 929 WHEN 'A3' THEN 44033 WHEN 'B1' THEN 42432 WHEN 'B2' THEN 0 WHEN 'B3' THEN 76576 END,
  'Historical Google Sheet 2026-04-22 (unverified estimates; not invoices or confirmed payments)'
 FROM apartments a WHERE a.code IN ('A1','A2','A3','B1','B2','B3');

-- The source spreadsheet documents a Jan 20 refill of approximately 1,000 L, after its
-- pre-delivery 42 cm measurement. Reconstruct this physical delivery, NOT a payment.
INSERT INTO fuel_deliveries(id,delivered_on,liters,cost_cents,note,created_by,created_at)
 SELECT lower(hex(randomblob(16))),'2026-01-20',1000,105000,
 'Historical sheet: ~1000 L refill after 42 cm pre-refill reading; €1.05/L noted. Estimated import; confirm details.',
 u.id,datetime('now')
 FROM (SELECT id FROM users WHERE role='admin' ORDER BY created_at LIMIT 1) u
 WHERE NOT EXISTS(SELECT 1 FROM fuel_deliveries WHERE delivered_on='2026-01-20');
INSERT INTO audit_events(id,actor_id,action,entity_type,entity_id,details,created_at)
 SELECT lower(hex(randomblob(16))),NULL,'historical_fuel_delivery_reference','fuel_delivery','2026-01-20',
 '{"source":"Google Sheet 2026-04-22","liters":1000,"cost_cents":105000,"status":"estimated reference, not an invoice","timing":"after 2026-01-20 pre-refill tank measurement"}',datetime('now')
 WHERE EXISTS(SELECT 1 FROM fuel_deliveries WHERE delivered_on='2026-01-20')
 AND NOT EXISTS(SELECT 1 FROM audit_events WHERE action='historical_fuel_delivery_reference' AND entity_id='2026-01-20');

CREATE TABLE IF NOT EXISTS announcements (
 id TEXT PRIMARY KEY,
 title TEXT NOT NULL,
 body TEXT NOT NULL,
 published_at TEXT NOT NULL,
 created_by TEXT NOT NULL REFERENCES users(id),
 created_at TEXT NOT NULL,
 archived_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_announcements_published ON announcements(published_at DESC);
CREATE TABLE IF NOT EXISTS announcement_reads (
 announcement_id TEXT NOT NULL REFERENCES announcements(id),
 apartment_id TEXT NOT NULL REFERENCES apartments(id),
 read_at TEXT NOT NULL,
 PRIMARY KEY(announcement_id,apartment_id)
);
CREATE INDEX IF NOT EXISTS idx_announcement_reads_apartment ON announcement_reads(apartment_id);
