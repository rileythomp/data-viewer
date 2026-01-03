-- Schema for dataset data tables (isolation)
CREATE SCHEMA IF NOT EXISTS datasets_data;

-- Dataset metadata
CREATE TABLE IF NOT EXISTS datasets (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT DEFAULT '',
    row_count INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'building', 'ready', 'error')),
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Dataset sources (polymorphic)
CREATE TABLE IF NOT EXISTS dataset_sources (
    id SERIAL PRIMARY KEY,
    dataset_id INTEGER NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
    source_type VARCHAR(20) NOT NULL CHECK (source_type IN ('upload', 'table', 'dataset')),
    source_id INTEGER NOT NULL,
    position INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Dataset columns (inferred + overrides)
CREATE TABLE IF NOT EXISTS dataset_columns (
    id SERIAL PRIMARY KEY,
    dataset_id INTEGER NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    inferred_type VARCHAR(50) DEFAULT 'text',
    override_type VARCHAR(50),
    position INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_dataset_sources_dataset_id ON dataset_sources(dataset_id);
CREATE INDEX IF NOT EXISTS idx_dataset_columns_dataset_id ON dataset_columns(dataset_id);
