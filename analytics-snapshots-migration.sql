-- Trading Analytics snapshots (release 2.8.0)
-- Idempotent; safe to run on existing databases.
CREATE TABLE IF NOT EXISTS analytics_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  snapshot_date TEXT NOT NULL,
  strategy TEXT NOT NULL,
  period TEXT NOT NULL DEFAULT 'all',
  metrics TEXT NOT NULL,
  analysis_version TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(snapshot_date, strategy, period)
);
CREATE INDEX IF NOT EXISTS idx_analytics_snapshots_date ON analytics_snapshots(strategy, snapshot_date);
