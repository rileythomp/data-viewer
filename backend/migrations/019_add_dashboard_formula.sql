-- Add custom balance formula support to dashboards
ALTER TABLE dashboards ADD COLUMN is_calculated BOOLEAN DEFAULT FALSE;
ALTER TABLE dashboards ADD COLUMN formula JSONB;
