-- Create join table for many-to-many relationship between accounts and groups
CREATE TABLE IF NOT EXISTS account_group_memberships (
    id SERIAL PRIMARY KEY,
    account_id INTEGER NOT NULL REFERENCES account_balances(id) ON DELETE CASCADE,
    group_id INTEGER NOT NULL REFERENCES account_groups(id) ON DELETE CASCADE,
    position_in_group INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(account_id, group_id)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_memberships_account ON account_group_memberships(account_id);
CREATE INDEX IF NOT EXISTS idx_memberships_group ON account_group_memberships(group_id);
CREATE INDEX IF NOT EXISTS idx_memberships_group_position ON account_group_memberships(group_id, position_in_group);

-- Migrate existing data from group_id column
INSERT INTO account_group_memberships (account_id, group_id, position_in_group)
SELECT id, group_id, position_in_group
FROM account_balances
WHERE group_id IS NOT NULL
ON CONFLICT (account_id, group_id) DO NOTHING;
