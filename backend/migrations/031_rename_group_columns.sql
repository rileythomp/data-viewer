-- Rename group_name and group_description to name and description
-- This unifies the naming between groups and institutions

ALTER TABLE account_groups RENAME COLUMN group_name TO name;
ALTER TABLE account_groups RENAME COLUMN group_description TO description;
