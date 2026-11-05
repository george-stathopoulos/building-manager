CREATE TABLE IF NOT EXISTS announcement_recipients (
 announcement_id TEXT NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
 apartment_id TEXT NOT NULL REFERENCES apartments(id) ON DELETE CASCADE,
 PRIMARY KEY (announcement_id, apartment_id)
);
CREATE INDEX IF NOT EXISTS idx_announcement_recipients_apartment ON announcement_recipients(apartment_id);
