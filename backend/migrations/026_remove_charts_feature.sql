-- Remove charts feature entirely

-- First, delete any chart items from dashboards
DELETE FROM dashboard_items WHERE item_type = 'chart';

-- Update constraint to remove 'chart' as valid item_type
ALTER TABLE dashboard_items DROP CONSTRAINT IF EXISTS dashboard_items_item_type_check;
ALTER TABLE dashboard_items ADD CONSTRAINT dashboard_items_item_type_check
    CHECK (item_type IN ('account', 'group', 'institution'));

-- Drop chart-related tables (order matters due to foreign keys)
DROP TABLE IF EXISTS chart_dataset_config;
DROP TABLE IF EXISTS chart_items;
DROP TABLE IF EXISTS charts;
