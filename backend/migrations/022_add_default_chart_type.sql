-- Add default_chart_type column to charts table for accounts/groups charts
-- This determines whether the chart shows as pie or line by default
ALTER TABLE charts ADD COLUMN IF NOT EXISTS default_chart_type VARCHAR(10) DEFAULT 'pie' CHECK (default_chart_type IN ('pie', 'line'));
