-- Migration: Per-dataset table storage pattern
-- Each dataset gets its own table in the dataset_data schema
-- Tables have native columns instead of JSONB storage

-- Create the dataset_data schema for per-dataset tables
CREATE SCHEMA IF NOT EXISTS dataset_data;

-- Drop the old unified dataset_data table from finances schema
DROP TABLE IF EXISTS finances.dataset_data CASCADE;

-- Drop related indexes (if they exist independently)
DROP INDEX IF EXISTS finances.idx_finances_dataset_data_dataset_id;
DROP INDEX IF EXISTS finances.idx_finances_dataset_data_pagination;
