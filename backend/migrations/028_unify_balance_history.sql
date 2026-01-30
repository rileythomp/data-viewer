-- Migration: Unify balance history tables into single polymorphic table
-- This consolidates balance_history, group_balance_history, and dashboard_balance_history

-- Create unified balance history table
CREATE TABLE entity_balance_history (
    id SERIAL PRIMARY KEY,
    entity_type VARCHAR(20) NOT NULL CHECK (entity_type IN ('account', 'group', 'dashboard')),
    entity_id INTEGER NOT NULL,
    entity_name_snapshot VARCHAR(255) NOT NULL,
    balance DECIMAL(15, 2) NOT NULL,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create composite index for efficient lookups by entity type and id
CREATE INDEX idx_entity_balance_history_lookup
    ON entity_balance_history(entity_type, entity_id, recorded_at DESC);

-- Migrate existing data from account balance_history
INSERT INTO entity_balance_history (entity_type, entity_id, entity_name_snapshot, balance, recorded_at)
SELECT 'account', account_id, account_name_snapshot, balance, recorded_at
FROM balance_history;

-- Migrate existing data from group_balance_history
INSERT INTO entity_balance_history (entity_type, entity_id, entity_name_snapshot, balance, recorded_at)
SELECT 'group', group_id, group_name_snapshot, balance, recorded_at
FROM group_balance_history;

-- Migrate existing data from dashboard_balance_history
INSERT INTO entity_balance_history (entity_type, entity_id, entity_name_snapshot, balance, recorded_at)
SELECT 'dashboard', dashboard_id, dashboard_name_snapshot, balance, recorded_at
FROM dashboard_balance_history;

-- Drop old tables and their indexes
DROP TABLE balance_history;
DROP TABLE group_balance_history;
DROP TABLE dashboard_balance_history;
