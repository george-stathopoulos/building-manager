-- Payment declarations are requests, not received money. Confirmation is recorded separately.
CREATE TABLE IF NOT EXISTS payment_declarations (
 id TEXT PRIMARY KEY,
 apartment_id TEXT NOT NULL REFERENCES apartments(id),
 kind TEXT NOT NULL CHECK(kind IN ('common','heating')),
 month TEXT,
 amount_cents INTEGER NOT NULL CHECK(amount_cents>0),
 declared_on TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed','rejected')),
 declared_by TEXT NOT NULL REFERENCES users(id),
 reviewed_by TEXT REFERENCES users(id),
 reviewed_at TEXT,
 created_at TEXT NOT NULL,
 CHECK((kind='common' AND month IS NOT NULL) OR (kind='heating' AND month IS NULL))
);
CREATE INDEX IF NOT EXISTS idx_payment_declarations_status ON payment_declarations(status,created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pending_common_declaration ON payment_declarations(apartment_id,month) WHERE kind='common' AND status='pending';
