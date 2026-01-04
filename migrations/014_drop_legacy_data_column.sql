-- Drop the legacy data column (all data now in upload_rows)
ALTER TABLE uploads DROP COLUMN IF EXISTS data;

-- Make status NOT NULL now that all records have it
ALTER TABLE uploads ALTER COLUMN status SET NOT NULL;
ALTER TABLE uploads ALTER COLUMN status DROP DEFAULT;
ALTER TABLE uploads ALTER COLUMN status SET DEFAULT 'completed';
