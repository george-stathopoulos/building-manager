-- PIN authentication for one resident identity per apartment. Existing email accounts remain intact.
CREATE TABLE IF NOT EXISTS apartment_pin_credentials (
 apartment_id TEXT PRIMARY KEY REFERENCES apartments(id),
 user_id TEXT NOT NULL UNIQUE REFERENCES users(id),
 salt TEXT NOT NULL,
 pin_hash TEXT NOT NULL,
 must_change INTEGER NOT NULL DEFAULT 1 CHECK(must_change IN (0,1)),
 updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS apartment_pin_attempts (
 apartment_id TEXT PRIMARY KEY REFERENCES apartments(id),
 attempts INTEGER NOT NULL,
 window_start TEXT NOT NULL
);
