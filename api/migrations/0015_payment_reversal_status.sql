-- Preserve original declaration and its confirmation history without rebuilding FK tables.
ALTER TABLE payment_declarations ADD COLUMN reversed_at TEXT;
