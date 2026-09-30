-- Legacy upgrade for databases created before positions.strategy was in schema.sql.
-- Apply once through the normal D1 migration process before enabling strategy cycles.
ALTER TABLE positions ADD COLUMN strategy TEXT;
