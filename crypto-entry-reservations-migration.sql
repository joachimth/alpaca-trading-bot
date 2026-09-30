-- Crypto entry reservation schema migration.
-- Apply once before deploying code that can submit crypto BUY orders.
-- Safe to reapply: both objects are created idempotently.

CREATE TABLE IF NOT EXISTS crypto_entry_reservations (
  reservation_key TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  symbol TEXT NOT NULL,
  notional_usd REAL NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('active','committed')),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_crypto_entry_reservations_expiry
  ON crypto_entry_reservations(status, expires_at);
