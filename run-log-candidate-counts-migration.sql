-- Durable run observability for analyzed and filtered candidate counts.
ALTER TABLE run_log ADD COLUMN analyzed_candidates INTEGER NOT NULL DEFAULT 0;
ALTER TABLE run_log ADD COLUMN filtered_candidates INTEGER NOT NULL DEFAULT 0;
