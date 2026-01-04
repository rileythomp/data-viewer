-- Add formula calculation fields to account_groups
ALTER TABLE account_groups
ADD COLUMN is_calculated BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE account_groups
ADD COLUMN formula JSONB DEFAULT NULL;
