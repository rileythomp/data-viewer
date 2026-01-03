# Data Upload System Overview

## Summary

The data upload system allows users to upload CSV or JSON files which are parsed and stored in PostgreSQL as structured JSONB data for later viewing and analysis.

---

## Supported Formats

| Format | How It's Parsed |
|--------|-----------------|
| **CSV** | First row becomes column headers, remaining rows become data |
| **JSON** | Array of objects (or single object) with keys as columns, values as rows |

**Limits:** Max file size is 10MB.

---

## Data Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Frontend   │────▶│   Handler    │────▶│  Repository  │────▶│  PostgreSQL  │
│  Upload Form │     │  Parse File  │     │  Store Data  │     │    uploads   │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
```

### Step-by-Step

1. **Frontend** — User selects a file, enters a name and optional description, then submits
2. **Handler** — Detects file type by extension (`.csv` or `.json`), reads content, and parses it into columns + rows
3. **Repository** — Converts columns and rows to JSONB format and inserts into the database
4. **Storage** — Data is stored with metadata (name, file type, row count) plus the actual data as JSONB arrays

---

## Database Schema

The `uploads` table stores all uploaded data:

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL | Primary key |
| `name` | VARCHAR(255) | User-provided name |
| `description` | TEXT | Optional description |
| `file_name` | VARCHAR(255) | Original filename |
| `file_type` | VARCHAR(10) | `'csv'` or `'json'` |
| `file_size` | INTEGER | Size in bytes |
| `row_count` | INTEGER | Number of data rows |
| `columns` | JSONB | Array of column names, e.g. `["institution", "account", "amount"]` |
| `data` | JSONB | Array of row arrays, e.g. `[["RBC", "Savings", 1000], ...]` |
| `created_at` | TIMESTAMP | When uploaded |

---

## Parsing Logic

### CSV
- Uses Go's standard `encoding/csv` package
- First row → column headers
- All remaining rows → data (stored as string values)

### JSON
- Tries to parse as an array of objects first
- Falls back to wrapping a single object in an array
- Object keys from the first item become column names
- Values are extracted in column order for each row

---

## Validation

| Layer | What's Checked |
|-------|----------------|
| **Frontend** | File type (csv/json), file size (≤10MB), name required |
| **Backend** | File extension, successful parsing, name not empty |
| **Database** | `file_type` constrained to `'csv'` or `'json'` |

---

## Key Files

| Purpose | File |
|---------|------|
| HTTP Handlers + Parsing | `backend/internal/handlers/uploads.go` |
| Database Operations | `backend/internal/repository/upload_repo.go` |
| Data Models | `backend/internal/models/upload.go` |
| DB Migration | `migrations/012_add_uploads.sql` |
| Frontend Upload Form | `frontend/src/components/UploadCreate.jsx` |
| Frontend List View | `frontend/src/components/UploadList.jsx` |
