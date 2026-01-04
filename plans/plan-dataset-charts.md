# Chart Creation Revamp: Dataset Data Source Support

## Overview

Add support for using datasets as chart data sources. Users will choose between:
1. **Accounts + Groups mode** (existing behavior)
2. **Dataset mode** (new) - with line chart or pie chart configuration

## Key Design Decisions

- **Either/Or data source**: Charts use accounts+groups OR a dataset, not both
- **Line charts**: Support multiple Y-axis columns (multiple lines)
- **Pie charts**: Show both pie chart visualization AND data table with aggregated values
- **Aggregation operators**: SUM and COUNT supported initially

---

## Implementation Plan

### 1. Database Schema

**New migration file: `migrations/014_add_chart_dataset_config.sql`**

```sql
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
```

---

### 2. Backend Model Updates

**File: `backend/internal/models/chart.go`**

Add new structs:
- `ChartDatasetConfig` - stores dataset chart configuration
- `ChartDatasetConfigInput` - input struct for create/update
- `DatasetPieChartData` / `DatasetPieChartItem` - pie chart response
- `DatasetLineChartData` / `DatasetLineChartSeries` - line chart response

Update existing structs:
- `CreateChartRequest` - add optional `DatasetConfig *ChartDatasetConfigInput`
- `UpdateChartRequest` - add optional `DatasetConfig *ChartDatasetConfigInput`
- `ChartWithItems` - add `DataSource` field ("accounts_groups" or "dataset"), plus dataset-specific response fields

---

### 3. Backend Repository Updates

**File: `backend/internal/repository/chart_repo.go`**

New methods:
- `getDatasetConfig(chartID int)` - fetch dataset configuration for a chart
- `saveDatasetConfig(tx, chartID, cfg)` - insert/update dataset config (uses UPSERT)
- `computeDatasetPieData(cfg)` - run GROUP BY aggregation query, return pie data
- `computeDatasetLineData(cfg)` - query data with X/Y columns, return line data

Modify existing methods:
- `GetWithItems()` - check for dataset config first; if present, call `getDatasetChartData()`, otherwise existing accounts/groups logic
- `Create()` - handle `DatasetConfig` in request; if present, call `saveDatasetConfig()`
- `Update()` - handle `DatasetConfig` in request; if switching modes, clear old config

Aggregation query for pie chart (example):
```sql
SELECT aggregation_field, SUM(CAST(NULLIF(aggregation_value, '') AS NUMERIC))
FROM datasets_data.dataset_{id}
WHERE aggregation_field IS NOT NULL AND aggregation_field != ''
GROUP BY aggregation_field
ORDER BY 2 DESC
```

---

### 4. Backend Handler Updates

**File: `backend/internal/handlers/charts.go`**

Update `Create()` and `Update()` handlers:
- Validate mutual exclusivity (dataset_config XOR account_ids/group_ids)
- Validate dataset config fields based on chart_type
- Line charts require: x_column, y_columns (non-empty)
- Pie charts require: aggregation_field, aggregation_value
- Default aggregation_operator to "SUM" if not provided

---

### 5. Frontend API Updates

**File: `frontend/src/services/api.js`**

Update `chartsApi.create()` and `chartsApi.update()`:
- Accept optional `datasetConfig` parameter
- Build request payload conditionally based on data source mode

---

### 6. Frontend ChartCreate Updates

**File: `frontend/src/components/ChartCreate.jsx`**

UI Changes:
1. Add data source toggle buttons: "Accounts & Groups" | "Dataset"
2. When "Dataset" selected:
   - Show dataset dropdown (filter to status='ready')
   - After dataset selected, show chart type toggle: "Line Chart" | "Pie Chart"
   - For line chart: X-column dropdown + Y-columns multi-select checkboxes
   - For pie chart: Group By column dropdown + Value column dropdown + Aggregation operator dropdown (SUM/COUNT)
3. Clear dataset state when switching back to accounts/groups mode

New state variables:
- `dataSource` ('accounts_groups' | 'dataset')
- `selectedDataset`, `datasetColumns`
- `chartType` ('line' | 'pie')
- `xColumn`, `yColumns[]`
- `aggregationField`, `aggregationValue`, `aggregationOperator`

---

### 7. Frontend ChartDetail Updates

**File: `frontend/src/components/ChartDetail.jsx`**

Rendering logic:
- Check `chart.data_source` field
- If "dataset": show dataset name badge, chart type badge, then render appropriate chart component
- If "accounts_groups": existing pie/line chart logic

Edit mode:
- If dataset mode: allow changing column selections and chart type
- If switching between modes, clear old configuration

---

### 8. New Frontend Components

**File: `frontend/src/components/DatasetPieChartView.jsx`**
- Renders pie chart using Recharts
- Renders data table below chart showing: Category, Value, Percentage columns
- Total row at bottom

**File: `frontend/src/components/DatasetLineChartView.jsx`**
- Renders line chart using Recharts
- Supports multiple lines (one per Y column)
- X-axis shows x_column values
- Custom tooltip showing all series values

---

## Files to Modify

| File | Changes |
|------|---------|
| `migrations/014_add_chart_dataset_config.sql` | NEW - create table |
| `backend/internal/models/chart.go` | Add dataset config structs, update request/response types |
| `backend/internal/repository/chart_repo.go` | Add dataset methods, refactor GetWithItems/Create/Update |
| `backend/internal/handlers/charts.go` | Add validation for dataset config |
| `frontend/src/services/api.js` | Update chartsApi.create/update signatures |
| `frontend/src/components/ChartCreate.jsx` | Add data source toggle, dataset config UI |
| `frontend/src/components/ChartDetail.jsx` | Add dataset chart rendering, update edit mode |
| `frontend/src/components/DatasetPieChartView.jsx` | NEW - pie chart + table component |
| `frontend/src/components/DatasetLineChartView.jsx` | NEW - line chart component |

---

## Implementation Order

1. **Database schema** - Create migration for chart_dataset_config table
2. **Backend models** - Add new structs to chart.go
3. **Backend repository** - Add dataset methods, refactor existing methods
4. **Backend handlers** - Add validation logic
5. **Frontend API** - Update api.js
6. **Frontend ChartCreate** - Add data source selection UI
7. **Frontend new components** - Create DatasetPieChartView and DatasetLineChartView
8. **Frontend ChartDetail** - Add rendering logic and edit mode support
9. **Testing and polish** - End-to-end testing, error handling, CSS

---

## Notes

- Dataset columns stored as TEXT; aggregation uses CAST to NUMERIC
- ON DELETE RESTRICT on dataset_id prevents accidental dataset deletion
- Color palette reused from existing accountColors array
