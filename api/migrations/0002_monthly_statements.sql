CREATE TABLE IF NOT EXISTS monthly_statements (month TEXT PRIMARY KEY, address TEXT NOT NULL, method TEXT NOT NULL CHECK(method IN ('equal','shares')), items_json TEXT NOT NULL, names_json TEXT NOT NULL, updated_by TEXT REFERENCES users(id), created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS statement_revisions (id TEXT PRIMARY KEY, month TEXT NOT NULL, old_json TEXT, new_json TEXT NOT NULL, actor_id TEXT REFERENCES users(id), created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_statement_revisions_month ON statement_revisions(month,created_at);
