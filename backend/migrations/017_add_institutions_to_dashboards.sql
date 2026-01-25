-- Add 'institution' as a valid item_type for dashboard_items
-- First, increase the column size since 'institution' is 11 characters (was VARCHAR(10))
ALTER TABLE dashboard_items ALTER COLUMN item_type TYPE VARCHAR(100);

-- Update the check constraint to allow 'institution'
ALTER TABLE dashboard_items DROP CONSTRAINT IF EXISTS dashboard_items_item_type_check;
ALTER TABLE dashboard_items ADD CONSTRAINT dashboard_items_item_type_check
    CHECK (item_type IN ('account', 'group', 'institution'));
