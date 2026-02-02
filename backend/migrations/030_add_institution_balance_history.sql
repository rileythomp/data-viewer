-- Migration: Add 'institution' as an allowed entity_type for balance history
-- This allows storing balance history for institutions alongside accounts, groups, and dashboards

-- Drop existing check constraint and recreate with 'institution' included
ALTER TABLE entity_balance_history
DROP CONSTRAINT IF EXISTS entity_balance_history_entity_type_check;

ALTER TABLE entity_balance_history
ADD CONSTRAINT entity_balance_history_entity_type_check
CHECK (entity_type IN ('account', 'group', 'institution', 'dashboard'));
