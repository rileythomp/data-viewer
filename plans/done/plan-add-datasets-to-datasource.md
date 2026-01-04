# Implementation Plan: Add Datasets to Data Source from Upload Detail Page

## Overview

Enable users to associate an upload (data source) with datasets directly from the Upload Detail page. This mirrors the existing "Add Source" functionality in DatasetDetail but works in reverse - showing which datasets contain the upload and allowing users to add the upload to additional datasets.

## UI Design

The Upload Detail page will have a new **"Datasets"** section placed between the metadata bar and the Data Preview section:

1. **Section Header**: "Datasets" with an "Add to Dataset" button
2. **Datasets List**: Shows datasets that contain this upload with:
   - Clickable dataset name to navigate to dataset detail
   - Remove button (X icon) to remove upload from that dataset
3. **Add Panel**: Expandable panel showing available datasets to add to (same pattern as DatasetDetail)

## Files to Modify

### Backend

| File | Changes |
|------|---------|
| `backend/internal/repository/dataset_repo.go` | Add `GetBySourceUploadID()` method |
| `backend/internal/handlers/datasets.go` | Add `GetBySourceUploadID()` handler |
| `backend/internal/router/router.go` | Register route `GET /uploads/{id}/datasets` |

### Frontend

| File | Changes |
|------|---------|
| `frontend/src/services/api.js` | Add `uploadsApi.getDatasets()` method |
| `frontend/src/components/UploadDetail.jsx` | Add datasets section with list and add functionality |
| `frontend/src/App.css` | Add optional hover styles for clickable items |

## Implementation Steps

### Step 1: Backend - Repository Method

Add to `backend/internal/repository/dataset_repo.go` (after `RemoveSource` method ~line 238):

```go
// DatasetWithSourceInfo includes the source junction table ID for removal
type DatasetWithSourceInfo struct {
    models.Dataset
    SourceJunctionID int `json:"source_junction_id"` // ID from dataset_sources table
}

func (r *DatasetRepository) GetBySourceUploadID(uploadID int) ([]DatasetWithSourceInfo, error) {
    query := `
        SELECT d.id, d.name, d.description, d.row_count, d.status,
               COALESCE(d.error_message, ''), d.created_at, d.updated_at, ds.id as source_junction_id
        FROM datasets d
        INNER JOIN dataset_sources ds ON d.id = ds.dataset_id
        WHERE ds.source_type = 'upload' AND ds.source_id = $1
        ORDER BY d.name
    `
    rows, err := r.db.Query(query, uploadID)
    // ... scan and return datasets with source_junction_id
}
```

### Step 2: Backend - Handler Method

Add to `backend/internal/handlers/datasets.go` (after `Rebuild` method):

```go
func (h *DatasetHandler) GetBySourceUploadID(w http.ResponseWriter, r *http.Request) {
    vars := mux.Vars(r)
    uploadID, _ := strconv.Atoi(vars["id"])
    datasets, err := h.repo.GetBySourceUploadID(uploadID)
    // ... return JSON response
}
```

### Step 3: Backend - Route Registration

Add to `backend/internal/router/router.go` (after line 94, with upload routes):

```go
api.HandleFunc("/uploads/{id}/datasets", datasetHandler.GetBySourceUploadID).Methods("GET")
```

### Step 4: Frontend - API Method

Add to `frontend/src/services/api.js` in `uploadsApi` object:

```javascript
getDatasets: async (id) => {
    const res = await fetch(`${API_BASE}/uploads/${id}/datasets`);
    if (!res.ok) throw new Error('Failed to fetch datasets for upload');
    return res.json();
},
```

### Step 5: Frontend - UploadDetail Component

Modify `frontend/src/components/UploadDetail.jsx`:

1. **Update imports** (line 3): Add `Database`, `Plus`, `X` icons
2. **Update imports** (line 4): Add `datasetsApi` import
3. **Add state** (after line 15):
   - `containingDatasets`, `showAddToDataset`, `availableDatasets`, `addingToDataset`, `datasetsLoading`
4. **Add functions** (after line 42):
   - `fetchContainingDatasets()` - fetch datasets containing this upload
   - `fetchAvailableDatasets()` - fetch all datasets, filter out ones already containing upload
   - `handleAddToDataset(datasetId)` - add upload to selected dataset
   - `handleRemoveFromDataset(datasetId, sourceJunctionId)` - remove upload from dataset using the junction table ID (with confirmation)
5. **Add useEffect hooks** (after line 66):
   - Fetch containing datasets when upload loads (if status=completed)
   - Fetch available datasets when add panel opens
6. **Add UI section** (after line 227, before error display):
   - Datasets section with header and "Add to Dataset" button
   - Expandable add panel with available datasets list
   - List of containing datasets with:
     - Clickable name to navigate to dataset detail
     - Remove button (X icon) with confirmation dialog

### Step 6: Frontend - CSS (Optional)

Add to `frontend/src/App.css`:

```css
.source-list-item.clickable {
    cursor: pointer;
}
.source-list-item.clickable:hover {
    background-color: var(--color-bg-secondary);
}
```

## UI/UX Details

- **Section visibility**: Only show when upload status is `completed`
- **Click behavior**: Clicking a dataset navigates to `/datasets/{id}`
- **Add panel**: Same pattern as DatasetDetail - shows available datasets with Plus icon
- **Empty states**:
  - "This upload is not part of any dataset." when not in any datasets
  - "No datasets available. Create a dataset first." when no datasets to add to
- **Loading states**: Show loading indicator while fetching datasets

## Existing Code to Reuse

- CSS classes from DatasetDetail: `.dataset-sources-section`, `.section-header`, `.add-source-panel`, `.available-sources-list`, `.source-list-item`
- API pattern: `datasetsApi.addSource(datasetId, 'upload', uploadId)` already exists
- UI pattern: Expandable add panel from DatasetDetail (lines 268-295)
