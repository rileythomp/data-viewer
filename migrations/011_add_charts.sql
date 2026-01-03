CREATE TABLE IF NOT EXISTS charts (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT DEFAULT '',
    position INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chart_items (
    id SERIAL PRIMARY KEY,
    chart_id INTEGER NOT NULL REFERENCES charts(id) ON DELETE CASCADE,
    item_type VARCHAR(10) NOT NULL CHECK (item_type IN ('account', 'group')),
    item_id INTEGER NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(chart_id, item_type, item_id)
);

CREATE INDEX IF NOT EXISTS idx_chart_items_chart ON chart_items(chart_id);
