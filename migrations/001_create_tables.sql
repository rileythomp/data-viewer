-- Create account_balances table (stores current state of each account)
CREATE TABLE IF NOT EXISTS account_balances (
    id SERIAL PRIMARY KEY,
    account_name VARCHAR(255) NOT NULL UNIQUE,
    current_balance DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create balance_history table (stores every balance update)
CREATE TABLE IF NOT EXISTS balance_history (
    id SERIAL PRIMARY KEY,
    account_id INTEGER NOT NULL REFERENCES account_balances(id) ON DELETE CASCADE,
    account_name_snapshot VARCHAR(255) NOT NULL,
    balance DECIMAL(15, 2) NOT NULL,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_account_balances_name ON account_balances(account_name);
CREATE INDEX IF NOT EXISTS idx_account_balances_archived ON account_balances(is_archived);
CREATE INDEX IF NOT EXISTS idx_balance_history_account_id ON balance_history(account_id);
CREATE INDEX IF NOT EXISTS idx_balance_history_recorded_at ON balance_history(recorded_at DESC);
