CREATE TABLE IF NOT EXISTS resident_messages (
 id TEXT PRIMARY KEY,
 apartment_id TEXT NOT NULL REFERENCES apartments(id),
 sender_user_id TEXT NOT NULL REFERENCES users(id),
 subject TEXT NOT NULL,
 body TEXT NOT NULL,
 created_at TEXT NOT NULL,
 read_at TEXT,
 reply TEXT,
 replied_at TEXT,
 replied_by TEXT REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_resident_messages_created ON resident_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_resident_messages_apartment ON resident_messages(apartment_id,created_at DESC);