-- Migration: Add table_name column to datasets
-- Table names are derived from dataset names (lowercase, underscores)
-- This allows human-readable table names instead of dataset_N

-- Add table_name column to datasets table
ALTER TABLE datasets ADD COLUMN IF NOT EXISTS table_name VARCHAR(255);

-- Create unique index on table_name to prevent conflicts
CREATE UNIQUE INDEX IF NOT EXISTS idx_datasets_table_name ON datasets(table_name) WHERE table_name IS NOT NULL;
