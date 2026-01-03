-- Create group_balance_history table to track group balance changes over time
CREATE TABLE IF NOT EXISTS group_balance_history (
    id SERIAL PRIMARY KEY,
    group_id INTEGER NOT NULL REFERENCES account_groups(id) ON DELETE CASCADE,
    group_name_snapshot VARCHAR(255) NOT NULL,
    balance DECIMAL(15, 2) NOT NULL,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_group_balance_history_group_id ON group_balance_history(group_id);
CREATE INDEX IF NOT EXISTS idx_group_balance_history_recorded_at ON group_balance_history(recorded_at DESC);
