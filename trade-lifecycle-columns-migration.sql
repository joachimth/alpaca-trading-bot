-- Additive migration for broker lifecycle timestamps on trades.
-- Apply once to legacy databases that predate lifecycle timestamp persistence.
ALTER TABLE trades ADD COLUMN submitted_at TEXT;
ALTER TABLE trades ADD COLUMN filled_at TEXT;
ALTER TABLE trades ADD COLUMN canceled_at TEXT;
ALTER TABLE trades ADD COLUMN expired_at TEXT;
ALTER TABLE trades ADD COLUMN failed_at TEXT;
ALTER TABLE trades ADD COLUMN replaced_at TEXT;
