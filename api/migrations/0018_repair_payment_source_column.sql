-- Production schema drift: migration 0013 was recorded but the payments column is absent.
-- This adds only the missing nullable column, preserving all existing payment rows.
ALTER TABLE payments ADD COLUMN source_declaration_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_declaration_source ON payments(source_declaration_id) WHERE source_declaration_id IS NOT NULL;
