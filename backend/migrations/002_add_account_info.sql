-- Add account_info column for metadata
ALTER TABLE account_balances ADD COLUMN IF NOT EXISTS account_info TEXT DEFAULT '';
