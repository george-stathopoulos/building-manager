-- Carry forward unused historic heating credit, never negative arrears.
-- Source values are the historical spreadsheet snapshot; preserve any administrator-confirmed opening.
-- A positive difference is unused prepaid fuel; a negative difference was settled and becomes zero.
INSERT INTO fuel_openings(apartment_id,as_of,deposited_cents,estimated_consumed_cents,note,confirmed_by,confirmed_at)
 SELECT l.apartment_id,s.settled_through,
  MAX(0,l.reported_deposited_cents-l.reported_estimated_consumed_cents),
  0,
  'Μεταφερόμενη θετική πίστωση από ιστορικό φύλλο 22/04/2026. Αρνητικά υπόλοιπα έχουν εξοφληθεί (0 €). Ελέγξτε τυχόν μεταγενέστερες καταθέσεις.',
  u.id,datetime('now')
 FROM fuel_legacy_snapshots l CROSS JOIN fuel_settlement s
 CROSS JOIN (SELECT id FROM users WHERE role='admin' ORDER BY created_at LIMIT 1) u
 WHERE NOT EXISTS(SELECT 1 FROM fuel_openings f WHERE f.apartment_id=l.apartment_id);
UPDATE fuel_settlement SET credit_status='carried_forward_from_historical_snapshot' WHERE id=1 AND credit_status='pending_reconciliation';
