-- Migration: Change dataset storage pattern
-- Datasets now point to folder paths on disk containing CSV files
-- Data is stored in a single finances.dataset_data table
-- Git is used to track changes in the folder

-- Create finances schema for dataset data
CREATE SCHEMA IF NOT EXISTS finances;

-- Create the unified dataset_data table
CREATE TABLE IF NOT EXISTS finances.dataset_data (
    id SERIAL PRIMARY KEY,
    dataset_id INTEGER NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
    row_index INTEGER NOT NULL,
    data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_finances_dataset_data_dataset_id ON finances.dataset_data(dataset_id);
CREATE INDEX IF NOT EXISTS idx_finances_dataset_data_pagination ON finances.dataset_data(dataset_id, row_index);

-- Add folder_path and git tracking columns to datasets table
ALTER TABLE datasets ADD COLUMN IF NOT EXISTS folder_path TEXT;
ALTER TABLE datasets ADD COLUMN IF NOT EXISTS last_commit_hash TEXT;
ALTER TABLE datasets ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP WITH TIME ZONE;

-- Drop the old datasets_data schema and its tables (per-dataset tables)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'datasets_data') LOOP
        EXECUTE 'DROP TABLE IF EXISTS datasets_data.' || quote_ident(r.tablename) || ' CASCADE';
    END LOOP;
END $$;

DROP SCHEMA IF EXISTS datasets_data CASCADE;

-- Drop dataset_sources table (no longer using upload sources)
DROP TABLE IF EXISTS dataset_sources CASCADE;

-- Drop uploads-related tables
DROP TABLE IF EXISTS upload_rows CASCADE;
DROP TABLE IF EXISTS uploads CASCADE;

-- Update the status check constraint to include 'syncing' instead of 'building'
ALTER TABLE datasets DROP CONSTRAINT IF EXISTS datasets_status_check;
ALTER TABLE datasets ADD CONSTRAINT datasets_status_check
    CHECK (status IN ('pending', 'syncing', 'ready', 'error'));
