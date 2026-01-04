-- Add position column for drag-and-drop ordering
ALTER TABLE account_balances ADD COLUMN IF NOT EXISTS position INTEGER;

-- Initialize positions based on current alphabetical order
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY account_name) as new_position
  FROM account_balances
)
UPDATE account_balances
SET position = ranked.new_position
FROM ranked
WHERE account_balances.id = ranked.id;

-- Make position NOT NULL after setting initial values
ALTER TABLE account_balances ALTER COLUMN position SET NOT NULL;

-- Add index for efficient ordering queries
CREATE INDEX IF NOT EXISTS idx_account_balances_position ON account_balances(position);
