ALTER TABLE trades ADD COLUMN client_order_id TEXT;
ALTER TABLE trades ADD COLUMN filled_qty REAL;
ALTER TABLE trades ADD COLUMN leaves_qty REAL;
ALTER TABLE trades ADD COLUMN broker_updated_at TEXT;
ALTER TABLE trades ADD COLUMN last_reconciled_at TEXT;
CREATE INDEX IF NOT EXISTS idx_trades_client_order_id ON trades(client_order_id);
CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status);
