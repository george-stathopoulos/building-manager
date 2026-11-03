PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS users (
 id TEXT PRIMARY KEY,
 email TEXT NOT NULL COLLATE NOCASE UNIQUE,
 salt TEXT NOT NULL,
 password_hash TEXT NOT NULL,
 role TEXT NOT NULL CHECK(role IN ('admin','resident')),
 created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS apartments (
 id TEXT PRIMARY KEY,
 code TEXT NOT NULL UNIQUE,
 common_weight INTEGER NOT NULL DEFAULT 1 CHECK(common_weight > 0),
 heating_share_bp INTEGER NOT NULL CHECK(heating_share_bp >= 0)
);
INSERT OR IGNORE INTO apartments(id,code,common_weight,heating_share_bp) VALUES
 ('apt-a1','A1',1,1925),('apt-a2','A2',1,1400),('apt-a3','A3',1,1675),
 ('apt-b1','B1',1,1925),('apt-b2','B2',1,1400),('apt-b3','B3',1,1675);
CREATE TABLE IF NOT EXISTS memberships (
 user_id TEXT NOT NULL REFERENCES users(id),
 apartment_id TEXT NOT NULL REFERENCES apartments(id),
 created_at TEXT NOT NULL,
 PRIMARY KEY(user_id,apartment_id)
);
CREATE TABLE IF NOT EXISTS sessions (
 token_hash TEXT PRIMARY KEY,
 user_id TEXT NOT NULL REFERENCES users(id),
 expires_at TEXT NOT NULL,
 created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE TABLE IF NOT EXISTS invitations (
 token_hash TEXT PRIMARY KEY,
 email TEXT NOT NULL COLLATE NOCASE,
 apartment_id TEXT NOT NULL REFERENCES apartments(id),
 expires_at TEXT NOT NULL,
 used_at TEXT,
 created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS expenses (
 id TEXT PRIMARY KEY,
 month TEXT NOT NULL,
 category TEXT NOT NULL,
 description TEXT NOT NULL,
 amount_cents INTEGER NOT NULL CHECK(amount_cents > 0),
 method TEXT NOT NULL CHECK(method IN ('equal','shares')),
 created_by TEXT NOT NULL REFERENCES users(id),
 created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_expenses_month ON expenses(month);
CREATE TABLE IF NOT EXISTS expense_allocations (
 expense_id TEXT NOT NULL REFERENCES expenses(id),
 apartment_id TEXT NOT NULL REFERENCES apartments(id),
 amount_cents INTEGER NOT NULL CHECK(amount_cents >= 0),
 PRIMARY KEY(expense_id, apartment_id)
);
CREATE TABLE IF NOT EXISTS payments (
 id TEXT PRIMARY KEY,
 apartment_id TEXT NOT NULL REFERENCES apartments(id),
 kind TEXT NOT NULL CHECK(kind IN ('common','heating')),
 amount_cents INTEGER NOT NULL CHECK(amount_cents > 0),
 paid_on TEXT NOT NULL,
 created_by TEXT NOT NULL REFERENCES users(id),
 created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_payments_apartment ON payments(apartment_id);
CREATE TABLE IF NOT EXISTS tank_measurements (
 id TEXT PRIMARY KEY,
 measured_on TEXT NOT NULL UNIQUE,
 centimeters REAL NOT NULL CHECK(centimeters >= 0),
 created_by TEXT NOT NULL REFERENCES users(id),
 created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS heating_readings (
 id TEXT PRIMARY KEY,
 apartment_id TEXT NOT NULL REFERENCES apartments(id),
 measured_on TEXT NOT NULL,
 reading INTEGER NOT NULL CHECK(reading >= 0),
 created_by TEXT NOT NULL REFERENCES users(id),
 created_at TEXT NOT NULL,
 UNIQUE(apartment_id, measured_on)
);
CREATE INDEX IF NOT EXISTS idx_readings_apartment_date ON heating_readings(apartment_id,measured_on);
CREATE TABLE IF NOT EXISTS fuel_deliveries (
 id TEXT PRIMARY KEY,
 delivered_on TEXT NOT NULL,
 liters REAL NOT NULL CHECK(liters > 0),
 cost_cents INTEGER NOT NULL CHECK(cost_cents > 0),
 note TEXT NOT NULL DEFAULT '',
 created_by TEXT NOT NULL REFERENCES users(id),
 created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS audit_events (
 id TEXT PRIMARY KEY,
 actor_id TEXT REFERENCES users(id),
 action TEXT NOT NULL,
 entity_type TEXT NOT NULL,
 entity_id TEXT NOT NULL,
 details TEXT NOT NULL DEFAULT '{}',
 created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS login_attempts (
 email TEXT PRIMARY KEY COLLATE NOCASE,
 attempts INTEGER NOT NULL,
 window_start TEXT NOT NULL
);
