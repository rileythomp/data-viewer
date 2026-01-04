-- Create account_groups table
CREATE TABLE IF NOT EXISTS account_groups (
    id SERIAL PRIMARY KEY,
    group_name VARCHAR(255) NOT NULL,
    group_description TEXT DEFAULT '',
    color VARCHAR(7) NOT NULL DEFAULT '#3b82f6',
    position INTEGER NOT NULL,
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add nullable foreign key to accounts
ALTER TABLE account_balances
ADD COLUMN group_id INTEGER REFERENCES account_groups(id) ON DELETE SET NULL;

-- Add position_in_group for ordering accounts within a group
ALTER TABLE account_balances
ADD COLUMN position_in_group INTEGER DEFAULT 0;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_account_groups_position ON account_groups(position);
CREATE INDEX IF NOT EXISTS idx_account_groups_archived ON account_groups(is_archived);
CREATE INDEX IF NOT EXISTS idx_account_balances_group_id ON account_balances(group_id);
