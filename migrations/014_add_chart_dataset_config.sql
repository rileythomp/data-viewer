-- Configuration for dataset-based charts
CREATE TABLE IF NOT EXISTS chart_dataset_config (
    id SERIAL PRIMARY KEY,
    chart_id INTEGER NOT NULL UNIQUE REFERENCES charts(id) ON DELETE CASCADE,
    dataset_id INTEGER NOT NULL REFERENCES datasets(id) ON DELETE RESTRICT,
    chart_type VARCHAR(10) NOT NULL CHECK (chart_type IN ('line', 'pie')),

    -- Line chart configuration
    x_column VARCHAR(255),
    y_columns JSONB DEFAULT '[]'::jsonb,

    -- Pie chart aggregation configuration
    aggregation_field VARCHAR(255),
    aggregation_value VARCHAR(255),
    aggregation_operator VARCHAR(10) CHECK (aggregation_operator IN ('SUM', 'COUNT')),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chart_dataset_config_chart ON chart_dataset_config(chart_id);
CREATE INDEX IF NOT EXISTS idx_chart_dataset_config_dataset ON chart_dataset_config(dataset_id);
