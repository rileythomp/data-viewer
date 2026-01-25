-- Add is_main column to dashboards table
-- Only one dashboard can be the main dashboard at a time
ALTER TABLE dashboards ADD COLUMN IF NOT EXISTS is_main BOOLEAN NOT NULL DEFAULT FALSE;

-- Create a partial unique index to ensure only one dashboard can be main
CREATE UNIQUE INDEX IF NOT EXISTS idx_dashboards_single_main ON dashboards (is_main) WHERE is_main = TRUE;
