-- Administrator PIN must be provisioned via authenticated Cloudflare D1 access; never through a public default.
CREATE TABLE IF NOT EXISTS admin_pin_credentials (
 user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 salt TEXT NOT NULL,
 pin_hash TEXT NOT NULL,
 must_change INTEGER NOT NULL DEFAULT 1 CHECK(must_change IN (0,1))
);
