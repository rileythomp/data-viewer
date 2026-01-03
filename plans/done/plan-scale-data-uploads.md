# Plan: Scale Data Upload for Large Files

Enable the data upload system to efficiently handle files much larger than 10MB by normalizing storage, streaming parsing, and adding background processing with progress feedback.

---

## Current Limitations

| Issue | Impact |
|-------|--------|
| All data in single JSONB column | Can't paginate at DB level; must load entire dataset |
| `io.ReadAll(file)` loads full file | Memory spike, OOM risk for large files |
| Application-level pagination | Fetches all data, slices in Go |
| Synchronous processing | Request timeout risk for large files |
| No upload progress | Poor UX for slow uploads |
| 10MB hard limit | Blocks legitimate large file use cases |

---

## Steps

### 1. Add normalized `upload_rows` table

Create migration to store one database row per data row:

```sql
CREATE TABLE upload_rows (
    id SERIAL PRIMARY KEY,
    upload_id INTEGER NOT NULL REFERENCES uploads(id) ON DELETE CASCADE,
    row_index INTEGER NOT NULL,
    data JSONB NOT NULL,
    UNIQUE(upload_id, row_index)
);
CREATE INDEX idx_upload_rows_upload_id ON upload_rows(upload_id);
CREATE INDEX idx_upload_rows_pagination ON upload_rows(upload_id, row_index);
```

### 2. Add `status` field to uploads

Extend `backend/internal/models/upload.go` and schema:

```sql
ALTER TABLE uploads ADD COLUMN status VARCHAR(20) DEFAULT 'completed' 
    CHECK (status IN ('pending', 'processing', 'completed', 'failed'));
ALTER TABLE uploads ADD COLUMN error_message TEXT DEFAULT '';
```

### 3. Implement batch insertion in repository

Update `backend/internal/repository/upload_repo.go`:
- Insert rows in batches (100-500 rows per transaction)
- Write to `upload_rows` instead of single JSONB blob
- Use transactions for atomicity

### 4. Stream CSV/JSON parsing

Refactor `parseCSV`/`parseJSON` in `backend/internal/handlers/uploads.go`:
- Use `csv.Reader` for streaming CSV (read row by row)
- Use `json.Decoder` for streaming JSON
- Yield rows incrementally instead of loading all into memory

### 5. Add background processing

- Return `202 Accepted` immediately after metadata insert
- Process file data in a goroutine
- Update status to `completed` or `failed` on finish
- Store error message if processing fails

### 6. Implement database-level pagination

Replace in-memory slicing in `GetData`:

```sql
SELECT data FROM upload_rows 
WHERE upload_id = $1 
ORDER BY row_index 
LIMIT $2 OFFSET $3
```

### 7. Add frontend progress & polling

Update `frontend/src/components/UploadCreate.jsx`:
- Use XHR with `upload.onprogress` for progress bar
- Poll `/api/uploads/:id` until status is `completed` or `failed`
- Show processing spinner and status messages

---

## Further Considerations

1. **Migration strategy**: Should we keep backward compatibility with the existing `data` JSONB column, or migrate existing uploads to the new `upload_rows` table?

2. **File size limit**: With streaming, what new limit makes sense? 50MB? 100MB? Unlimited with timeout protection?

3. **Error recovery**: For failed uploads mid-processing, should we support resume or require re-upload?

4. **Render constraints**: Free tier has limited memory/CPU. Background goroutines work, but paid tier would allow dedicated workers.

---

## Priority Order

| Priority | Task | Effort | Impact |
|----------|------|--------|--------|
| 1 | Normalize to `upload_rows` table | Medium | High - unlocks all other improvements |
| 2 | Add status field | Low | Medium - enables async processing |
| 3 | Batch insertion | Medium | High - reduces memory usage |
| 4 | Database-level pagination | Low | High - fast reads for large uploads |
| 5 | Streaming parsing | Medium | High - handles arbitrarily large files |
| 6 | Background processing | Medium | Medium - prevents timeouts |
| 7 | Frontend progress | Low | Low - UX improvement |

---

## Key Files to Modify

| File | Changes |
|------|---------|
| `migrations/013_normalize_uploads.sql` | New migration for `upload_rows` table and status field |
| `backend/internal/models/upload.go` | Add `Status`, `ErrorMessage` fields; add `UploadRow` model |
| `backend/internal/repository/upload_repo.go` | Batch inserts, streaming reads, status updates |
| `backend/internal/handlers/uploads.go` | Streaming parsers, background processing, 202 response |
| `frontend/src/components/UploadCreate.jsx` | Progress bar, status polling |
| `frontend/src/components/UploadDetail.jsx` | Show processing status |
