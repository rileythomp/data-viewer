# Plan: Deprecate Legacy Upload Storage

## Overview

Remove backwards compatibility code for the legacy `uploads.data` JSONB column and fully commit to the normalized `upload_rows` table storage pattern.

## Background

The codebase currently supports two storage mechanisms for upload data:
- **Legacy**: `uploads.data` JSONB column (monolithic array storage)
- **Current**: `upload_rows` table (normalized row-by-row storage)

All new uploads use `upload_rows`, but fallback code exists to read from `uploads.data`. Since no legacy data needs to be preserved, we can remove all of this code.

---

## Step 1: Create Migration to Drop Legacy Column

### New File: `migrations/014_drop_legacy_data_column.sql`

```sql
-- Drop the legacy data column (all data now in upload_rows)
ALTER TABLE uploads DROP COLUMN IF EXISTS data;

-- Make status NOT NULL now that all records have it
ALTER TABLE uploads ALTER COLUMN status SET NOT NULL;
ALTER TABLE uploads ALTER COLUMN status DROP DEFAULT;
ALTER TABLE uploads ALTER COLUMN status SET DEFAULT 'completed';
```

---

## Step 2: Remove Legacy Code from upload_repo.go

### File: `backend/internal/repository/upload_repo.go`

**2a. Remove fallback in `GetData()` method (lines 144-178)**

Delete the entire fallback block starting with the comment `// Fallback: read from legacy data JSONB column`. The function should only use the `upload_rows` path.

**2b. Remove `data` column from INSERT in `Create()` (line 199)**

Change:
```go
INSERT INTO uploads (name, description, file_name, file_type, file_size, row_count, columns, data, status)
VALUES ($1, $2, $3, $4, $5, $6, $7, '[]', 'completed')
```

To:
```go
INSERT INTO uploads (name, description, file_name, file_type, file_size, row_count, columns, status)
VALUES ($1, $2, $3, $4, $5, $6, $7, 'completed')
```

**2c. Remove `data` column from INSERT in `CreateMetadata()` (line 279)**

Change:
```go
INSERT INTO uploads (name, description, file_name, file_type, file_size, row_count, columns, data, status)
VALUES ($1, $2, $3, $4, $5, 0, $6, '[]', $7)
```

To:
```go
INSERT INTO uploads (name, description, file_name, file_type, file_size, row_count, columns, status)
VALUES ($1, $2, $3, $4, $5, 0, $6, $7)
```

**2d. Remove COALESCE wrappers for status (4 locations)**

| Line | Change |
|------|--------|
| 33 | `COALESCE(status, 'completed') as status` → `status` |
| 69 | `COALESCE(status, 'completed') as status` → `status` |
| 202 | `COALESCE(status, 'completed') as status` → `status` |
| 282 | `COALESCE(status, 'completed') as status` → `status` |

---

## Step 3: Remove Legacy Code from dataset_repo.go

### File: `backend/internal/repository/dataset_repo.go`

**3a. Remove fallback in `BuildDataset()` method (lines 394-407)**

Delete the `else` block that reads from `uploads.data`. Simplify to always read from `upload_rows`.

Before:
```go
if normalizedCount > 0 {
    // Read from normalized upload_rows table
    rows, err := r.db.Query(...)
    ...
} else {
    // Fallback: read from legacy data JSONB column
    var dataJSON []byte
    err = r.db.QueryRow("SELECT data FROM uploads WHERE id = $1", source.SourceID).Scan(&dataJSON)
    ...
}
```

After:
```go
// Read from upload_rows table
rows, err := r.db.Query("SELECT data FROM upload_rows WHERE upload_id = $1 ORDER BY row_index", source.SourceID)
...
```

Also remove the `normalizedCount` check since it's no longer needed.

---

## Step 4: Update Documentation

### File: `docs/data-upload-overview.md`

1. **Line 16**: Change `10MB` to `50MB`
2. **Line 52**: Remove the `data` column row from the schema table
3. Add a new row for `status` column
4. Add reference to `upload_rows` table storage

---

## Files to Modify

| File | Action |
|------|--------|
| `migrations/014_drop_legacy_data_column.sql` | **CREATE** |
| `backend/internal/repository/upload_repo.go` | Remove fallback code, update INSERTs, remove COALESCE |
| `backend/internal/repository/dataset_repo.go` | Remove fallback code in BuildDataset |
| `docs/data-upload-overview.md` | Update schema docs |

---

## Execution Order

1. Create migration `014_drop_legacy_data_column.sql`
2. Update `upload_repo.go`
3. Update `dataset_repo.go`
4. Update documentation
5. Run migration
6. Test application
