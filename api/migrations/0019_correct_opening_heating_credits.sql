-- Administrator-approved opening credits at the 2026-04-22 settlement boundary.
-- Historical negative balances were settled and must remain zero.
-- A2 and B3 are owner apartments, excluded from payment collection.
-- Preserve historical snapshots, payment records, and consumption measurements.
UPDATE fuel_openings SET deposited_cents=CASE (SELECT code FROM apartments WHERE id=fuel_openings.apartment_id)
 WHEN 'A3' THEN 5967 WHEN 'B1' THEN 7568 ELSE 0 END,
 estimated_consumed_cents=0,
 note='Χειροκίνητη επιβεβαίωση διαχειριστή 2026-11-05: A1=0, A2=0 (ιδιοκτήτης), A3=59,67, B1=75,68, B2=0, B3=0 (ιδιοκτήτης). Ιστορικές αρνητικές οφειλές εξοφλημένες.'
WHERE apartment_id IN (SELECT id FROM apartments WHERE code IN ('A1','A2','A3','B1','B2','B3'));
INSERT INTO audit_events(id,actor_id,action,entity_type,entity_id,details,created_at)
SELECT lower(hex(randomblob(16))),NULL,'fuel_opening_admin_correction','fuel_settlement','2026-04-22',
'{"A1":0,"A2":0,"A3":5967,"B1":7568,"B2":0,"B3":0,"owner_apartments":["A2","B3"],"source":"explicit administrator instruction 2026-11-05"}',datetime('now');
