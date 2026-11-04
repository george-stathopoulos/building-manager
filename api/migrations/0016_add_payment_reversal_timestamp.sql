-- Add reversal timestamp to existing production databases; preserve all payment records.
ALTER TABLE payment_declarations ADD COLUMN reversed_at TEXT;
