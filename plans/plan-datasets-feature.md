# Dataset Feature Implementation Plan

## Overview

A "dataset" is a named entity whose data is stored in a dedicated Postgres table (in a `datasets_data` schema). Users can create datasets from one or more CSV uploads, view the unioned data as a paginated/sortable table, and later extend to database tables or other datasets as sources.

## Key Design Decisions

| Decision | Choice |
|----------|--------|
| **Terminology** | "Dataset" (not "data store") |
| **Data storage** | Actual Postgres tables in separate `datasets_data` schema |
| **Data sources** | Read-only views; support uploads, database tables, other datasets |
| **Schema handling** | Inferred from sources, with optional explicit overrides |
| **Query capabilities** | Sorting and pagination only (for now) |
| **Caching strategy** | TBD - keeping options open |

## Data Source Types

1. **Compilation of uploads** (Phase 1) - Union of multiple CSV/JSON uploads
2. **Database tables** (Phase 2) - Direct reference to existing Postgres tables
3. **Other datasets** (Phase 3) - Derived datasets referencing other datasets

---

## Implementation Steps

### Step 1: Database Migration

**File**: `migrations/013_add_datasets.sql`

Create:
- `datasets` table (metadata: id, name, description, timestamps)
- `dataset_sources` junction table (polymorphic: source_type = 'upload' | 'table' | 'dataset', source_id)
- `dataset_columns` table (column definitions with inferred/override types)
- `datasets_data` schema for dynamic data tables

```sql
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
```

Dynamic data tables will be created as: `datasets_data.dataset_{id}`

---

### Step 2: Backend Model

**File**: `backend/internal/models/dataset.go`

```go
type Dataset struct {
    ID           int             `json:"id"`
    Name         string          `json:"name"`
    Description  string          `json:"description"`
    RowCount     int             `json:"row_count"`
    Status       string          `json:"status"` // pending, building, ready, error
    ErrorMessage string          `json:"error_message,omitempty"`
    Sources      []DatasetSource `json:"sources,omitempty"`
    Columns      []DatasetColumn `json:"columns,omitempty"`
    CreatedAt    time.Time       `json:"created_at"`
    UpdatedAt    time.Time       `json:"updated_at"`
}

type DatasetSource struct {
    ID         int       `json:"id"`
    DatasetID  int       `json:"dataset_id"`
    SourceType string    `json:"source_type"` // upload, table, dataset
    SourceID   int       `json:"source_id"`
    SourceName string    `json:"source_name,omitempty"` // populated on read
    Position   int       `json:"position"`
    CreatedAt  time.Time `json:"created_at"`
}

type DatasetColumn struct {
    ID           int    `json:"id"`
    DatasetID    int    `json:"dataset_id"`
    Name         string `json:"name"`
    InferredType string `json:"inferred_type"`
    OverrideType string `json:"override_type,omitempty"`
    Position     int    `json:"position"`
}

type CreateDatasetRequest struct {
    Name        string `json:"name"`
    Description string `json:"description"`
    SourceIDs   []int  `json:"source_ids"` // upload IDs for Phase 1
}

type DatasetDataResponse struct {
    Columns  []string        `json:"columns"`
    Rows     [][]interface{} `json:"rows"`
    Total    int             `json:"total"`
    Page     int             `json:"page"`
    PageSize int             `json:"page_size"`
}
```

---

### Step 3: Backend Repository

**File**: `backend/internal/repository/dataset_repo.go`

Key methods:
- `GetAll(page, pageSize)` - List datasets with pagination
- `GetByID(id)` - Get dataset with sources and columns
- `Create(req)` - Create dataset metadata, trigger build
- `Delete(id)` - Delete metadata and drop dynamic table
- `AddSource(datasetID, sourceType, sourceID)` - Add source, trigger rebuild
- `RemoveSource(datasetID, sourceID)` - Remove source, trigger rebuild
- `BuildDataset(id)` - Create/rebuild dynamic table from sources
- `GetData(id, page, pageSize, sortColumn, sortDirection)` - Query dynamic table

Build process:
1. Set status to 'building'
2. Drop existing `datasets_data.dataset_{id}` if exists
3. Infer columns from first source
4. Create table with inferred schema
5. Insert data from all sources (UNION approach)
6. Update row_count and set status to 'ready'
7. On error, set status to 'error' with message

---

### Step 4: Backend Handler

**File**: `backend/internal/handlers/datasets.go`

Endpoints:
| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| GET | `/api/datasets` | GetAll | List datasets (paginated) |
| POST | `/api/datasets` | Create | Create dataset with initial sources |
| GET | `/api/datasets/{id}` | GetByID | Get dataset metadata |
| DELETE | `/api/datasets/{id}` | Delete | Delete dataset and data |
| GET | `/api/datasets/{id}/data` | GetData | Get paginated, sortable data |
| POST | `/api/datasets/{id}/sources` | AddSource | Add a source |
| DELETE | `/api/datasets/{id}/sources/{sourceId}` | RemoveSource | Remove a source |
| POST | `/api/datasets/{id}/rebuild` | Rebuild | Manually trigger rebuild |

Query parameters for GetData:
- `page` (default: 1)
- `page_size` (default: 50)
- `sort_column` (optional)
- `sort_direction` (optional: 'asc' or 'desc')

---

### Step 5: Router Registration

**File**: `backend/internal/router/router.go`

Add routes:
```go
datasetRepo := repository.NewDatasetRepository(db)
datasetHandler := handlers.NewDatasetHandler(datasetRepo)

api.HandleFunc("/datasets", datasetHandler.GetAll).Methods("GET")
api.HandleFunc("/datasets", datasetHandler.Create).Methods("POST")
api.HandleFunc("/datasets/{id}", datasetHandler.GetByID).Methods("GET")
api.HandleFunc("/datasets/{id}", datasetHandler.Delete).Methods("DELETE")
api.HandleFunc("/datasets/{id}/data", datasetHandler.GetData).Methods("GET")
api.HandleFunc("/datasets/{id}/sources", datasetHandler.AddSource).Methods("POST")
api.HandleFunc("/datasets/{id}/sources/{sourceId}", datasetHandler.RemoveSource).Methods("DELETE")
api.HandleFunc("/datasets/{id}/rebuild", datasetHandler.Rebuild).Methods("POST")
```

---

### Step 6: Frontend API Service

**File**: `frontend/src/services/api.js`

```javascript
export const datasetsApi = {
    getAll: async (page = 1, pageSize = 20) => { ... },
    getById: async (id) => { ... },
    getData: async (id, page = 1, pageSize = 50, sortColumn, sortDirection) => { ... },
    create: async (name, description, sourceIds) => { ... },
    addSource: async (id, sourceType, sourceId) => { ... },
    removeSource: async (id, sourceId) => { ... },
    rebuild: async (id) => { ... },
    delete: async (id) => { ... },
};
```

---

### Step 7: Frontend Components

**Files**:
- `frontend/src/components/DatasetList.jsx` - Card-based list with status indicators
- `frontend/src/components/DatasetCreate.jsx` - Form with multi-select for uploads
- `frontend/src/components/DatasetDetail.jsx` - Metadata, sources list, sortable data table

**DatasetDetail features**:
- Show dataset metadata (name, description, status, row count)
- List sources with ability to add/remove
- Paginated data table with column headers
- Clickable column headers for sorting
- Rebuild button to refresh data

---

## Open Questions / Future Considerations

### Schema Matching Strategy
When adding a second CSV to a dataset, how to handle column mismatches?

| Option | Pros | Cons |
|--------|------|------|
| **Exact match required** | Simple, predictable | Inflexible |
| **Union with nulls** | Flexible | Sparse data, confusing |
| **Intersection only** | Clean output | Data loss |

**Recommendation**: Start with exact match, error on mismatch.

### Data Refresh Strategy
When an underlying upload changes or is deleted:

| Option | Description |
|--------|-------------|
| **Manual rebuild** | User triggers rebuild explicitly |
| **Auto-refresh** | Detect changes, rebuild automatically |
| **Invalidate** | Mark dataset as stale, require rebuild |

**Recommendation**: Start with manual rebuild + invalidation on source delete.

### Column Type Inference
Should we infer types (number, date, boolean) from CSV values?

**Recommendation**: Start with all text columns, add type inference as enhancement.

### Dynamic Table Permissions
Confirm `datasets_data` schema approach works with Render/Postgres permissions.

---

## File Checklist

| Layer | File | Status |
|-------|------|--------|
| Migration | `migrations/013_add_datasets.sql` | ⬜ |
| Model | `backend/internal/models/dataset.go` | ⬜ |
| Repository | `backend/internal/repository/dataset_repo.go` | ⬜ |
| Handler | `backend/internal/handlers/datasets.go` | ⬜ |
| Router | `backend/internal/router/router.go` | ⬜ |
| API Service | `frontend/src/services/api.js` | ⬜ |
| List Component | `frontend/src/components/DatasetList.jsx` | ⬜ |
| Create Component | `frontend/src/components/DatasetCreate.jsx` | ⬜ |
| Detail Component | `frontend/src/components/DatasetDetail.jsx` | ⬜ |
| App Routes | `frontend/src/App.jsx` | ⬜ |
