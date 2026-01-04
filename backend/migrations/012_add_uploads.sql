CREATE TABLE IF NOT EXISTS uploads (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT DEFAULT '',
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(10) NOT NULL CHECK (file_type IN ('csv', 'json')),
    file_size INTEGER NOT NULL,
    row_count INTEGER NOT NULL DEFAULT 0,
    columns JSONB DEFAULT '[]',
    data JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_uploads_created_at ON uploads(created_at DESC);
