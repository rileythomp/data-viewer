-- Add type column to distinguish groups from institutions
ALTER TABLE account_groups
ADD COLUMN IF NOT EXISTS entity_type VARCHAR(20) NOT NULL DEFAULT 'group';

-- Index for filtering by type
CREATE INDEX IF NOT EXISTS idx_account_groups_entity_type ON account_groups(entity_type);
