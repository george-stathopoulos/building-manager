-- Explicitly requested one-time cleanup of ALL announcements and private messages.
-- Do not touch financial, heating, payment, or audit tables.
-- Read receipts and recipient mappings depend on announcements and must be removed first.
DELETE FROM announcement_reads;
DELETE FROM announcement_recipients;
DELETE FROM announcements;
-- Replies and read timestamps are columns in resident_messages; deleting the rows clears both.
DELETE FROM resident_messages;
