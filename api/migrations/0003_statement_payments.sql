CREATE TABLE IF NOT EXISTS statement_payments (
 month TEXT NOT NULL REFERENCES monthly_statements(month),
 apartment_id TEXT NOT NULL REFERENCES apartments(id),
 paid_cents INTEGER NOT NULL DEFAULT 0 CHECK(paid_cents >= 0),
 paid_on TEXT,
 updated_by TEXT REFERENCES users(id),
 updated_at TEXT NOT NULL,
 PRIMARY KEY(month,apartment_id)
);
CREATE INDEX IF NOT EXISTS idx_statement_payments_month ON statement_payments(month);
