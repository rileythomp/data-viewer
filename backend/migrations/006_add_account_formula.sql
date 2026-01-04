-- Add formula calculation fields to account_balances
ALTER TABLE account_balances
ADD COLUMN is_calculated BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE account_balances
ADD COLUMN formula JSONB DEFAULT NULL;
