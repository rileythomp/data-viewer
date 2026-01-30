-- Migration: Clean up deprecated columns, empty schema, and unused dataset_columns table

-- Drop deprecated columns from account_balances
-- These were superseded by account_group_memberships table in migration 007
ALTER TABLE account_balances DROP COLUMN IF EXISTS group_id;
ALTER TABLE account_balances DROP COLUMN IF EXISTS position_in_group;

-- Drop the now-unused index for group_id (if it exists)
DROP INDEX IF EXISTS idx_account_balances_group_id;

-- Drop the empty finances schema (created in 023, table dropped in 024)
DROP SCHEMA IF EXISTS finances CASCADE;

-- Drop dataset_columns table (column info can be derived from dynamic table schema)
DROP TABLE IF EXISTS dataset_columns CASCADE;
DROP INDEX IF EXISTS idx_dataset_columns_dataset_id;

-- Drop unused grid layout columns from dashboard_items (added outside of migrations)
ALTER TABLE dashboard_items DROP COLUMN IF EXISTS grid_x;
ALTER TABLE dashboard_items DROP COLUMN IF EXISTS grid_y;
ALTER TABLE dashboard_items DROP COLUMN IF EXISTS grid_h;
ALTER TABLE dashboard_items DROP COLUMN IF EXISTS grid_w;

-- Drop app_settings table (only used for total_formula feature which was never completed)
DROP TABLE IF EXISTS app_settings CASCADE;
