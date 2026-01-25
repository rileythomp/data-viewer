-- Add 'chart' as a valid item_type for dashboard_items
ALTER TABLE dashboard_items DROP CONSTRAINT IF EXISTS dashboard_items_item_type_check;
ALTER TABLE dashboard_items ADD CONSTRAINT dashboard_items_item_type_check
    CHECK (item_type IN ('account', 'group', 'institution', 'chart'));
