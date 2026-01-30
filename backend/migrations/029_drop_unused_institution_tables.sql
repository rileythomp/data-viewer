-- Drop unused legacy tables from abandoned institution rename approach
-- The codebase uses account_groups with entity_type column instead
DROP TABLE IF EXISTS account_institution_memberships CASCADE;
DROP TABLE IF EXISTS institutions CASCADE;
