-- Freeze the settlement boundary at the last historical tank measurement present when this migration runs.
-- Historical estimated fuel consumption is settled, but unused individual credits remain unknown.
CREATE TABLE IF NOT EXISTS fuel_settlement (
 id INTEGER PRIMARY KEY CHECK(id=1),
 settled_through TEXT NOT NULL,
 historical_arrears_cents INTEGER NOT NULL DEFAULT 0 CHECK(historical_arrears_cents=0),
 credit_status TEXT NOT NULL DEFAULT 'pending_reconciliation',
 created_at TEXT NOT NULL
);
INSERT OR IGNORE INTO fuel_settlement(id,settled_through,historical_arrears_cents,credit_status,created_at)
 SELECT 1,MAX(measured_on),0,'pending_reconciliation',datetime('now')
 FROM tank_measurements HAVING COUNT(*)>0;
