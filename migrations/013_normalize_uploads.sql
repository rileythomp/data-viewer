-- Add normalized upload_rows table for scalable row storage
CREATE TABLE IF NOT EXISTS upload_rows (
    id SERIAL PRIMARY KEY,
    upload_id INTEGER NOT NULL REFERENCES uploads(id) ON DELETE CASCADE,
    row_index INTEGER NOT NULL,
    data JSONB NOT NULL,
    UNIQUE(upload_id, row_index)
);

CREATE INDEX IF NOT EXISTS idx_upload_rows_upload_id ON upload_rows(upload_id);
CREATE INDEX IF NOT EXISTS idx_upload_rows_pagination ON upload_rows(upload_id, row_index);

-- Add status and error_message fields to uploads table
ALTER TABLE uploads ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'completed'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed'));
ALTER TABLE uploads ADD COLUMN IF NOT EXISTS error_message TEXT DEFAULT '';
