-- Create dashboard_balance_history table to track dashboard balance changes over time
CREATE TABLE IF NOT EXISTS dashboard_balance_history (
    id SERIAL PRIMARY KEY,
    dashboard_id INTEGER NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE,
    dashboard_name_snapshot VARCHAR(255) NOT NULL,
    balance DECIMAL(15, 2) NOT NULL,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_dashboard_balance_history_dashboard_id ON dashboard_balance_history(dashboard_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_balance_history_recorded_at ON dashboard_balance_history(recorded_at DESC);
