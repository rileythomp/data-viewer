-- Migration: Add app_settings table for configurable total formula
-- This table stores application-wide settings as key-value pairs with JSONB values

CREATE TABLE IF NOT EXISTS app_settings (
    key VARCHAR(255) PRIMARY KEY,
    value JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default total_formula setting (disabled, empty formula)
INSERT INTO app_settings (key, value)
VALUES ('total_formula', '{"is_enabled": false, "formula": []}')
ON CONFLICT (key) DO NOTHING;
