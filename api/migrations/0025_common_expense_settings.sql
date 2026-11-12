CREATE TABLE IF NOT EXISTS common_expense_settings (
 id INTEGER PRIMARY KEY CHECK(id=1),
 a3_credit_enabled INTEGER NOT NULL DEFAULT 1 CHECK(a3_credit_enabled IN (0,1)),
 updated_by TEXT REFERENCES users(id),
 updated_at TEXT NOT NULL
);
INSERT OR IGNORE INTO common_expense_settings(id,a3_credit_enabled,updated_at) VALUES(1,1,datetime('now'));
