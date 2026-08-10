-- Additive migration for broker-confirmed crypto protective intent metadata.
-- Safe to apply once before the hardening Worker starts writing crypto entries.
ALTER TABLE trades ADD COLUMN intent_stop_loss_price REAL;
ALTER TABLE trades ADD COLUMN intent_take_profit_price REAL;
