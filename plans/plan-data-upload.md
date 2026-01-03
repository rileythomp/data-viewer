## Plan: Data Upload Feature

Add a complete data upload system allowing users to upload CSV/JSON files, view a paginated list of their uploads, and inspect uploaded data through a detail view. This requires a new database table, full backend CRUD operations with file parsing, and three new frontend pages integrated into the navigation.

### Steps

1. **Create database migration** - Add [migrations/012_add_uploads.sql](migrations/012_add_uploads.sql) with `uploads` table containing `id`, `name`, `description`, `file_name`, `file_type`, `file_size`, `row_count`, `columns` (JSONB), `data` (JSONB), `created_at`, `updated_at`, with CHECK constraint for file_type and index on `created_at DESC`.

2. **Add backend model** - Create [backend/internal/models/upload.go](backend/internal/models/upload.go) with `Upload` struct, `CreateUploadRequest`, `UploadListResponse`, and `UploadDataResponse` types following patterns in [models/dashboard.go](backend/internal/models/dashboard.go).

3. **Implement repository layer** - Create [backend/internal/repository/upload_repo.go](backend/internal/repository/upload_repo.go) with `GetAll` (paginated), `GetByID`, `GetData` (paginated row access), `Create`, and `Delete` methods, following patterns in [dashboard_repo.go](backend/internal/repository/dashboard_repo.go).

4. **Implement handlers with file parsing** - Create [backend/internal/handlers/uploads.go](backend/internal/handlers/uploads.go) with multipart form handling (`r.ParseMultipartForm`), CSV parsing via `encoding/csv`, JSON parsing via `encoding/json`, and endpoints for list/create/detail/delete/data following patterns in [handlers/dashboards.go](backend/internal/handlers/dashboards.go).

5. **Register API routes** - Update [backend/internal/router/router.go](backend/internal/router/router.go) to add `/api/uploads` (GET, POST), `/api/uploads/{id}` (GET, DELETE), and `/api/uploads/{id}/data` (GET).

6. **Create frontend API service** - Add `uploadsApi` to [frontend/src/services/](frontend/src/services/) with `getAll`, `getById`, `getData`, `create` (FormData), and `delete` methods.

7. **Create UploadList component** - Add [frontend/src/components/UploadList.jsx](frontend/src/components/UploadList.jsx) with paginated list, create button, and clickable cards showing name, file type, row count, and date, following [DashboardList.jsx](frontend/src/components/DashboardList.jsx).

8. **Create UploadCreate component** - Add [frontend/src/components/UploadCreate.jsx](frontend/src/components/UploadCreate.jsx) with form for name, description, and file input (accept=".csv,.json"), file validation, and FormData submission, following [DashboardCreate.jsx](frontend/src/components/DashboardCreate.jsx).

9. **Create UploadDetail component** - Add [frontend/src/components/UploadDetail.jsx](frontend/src/components/UploadDetail.jsx) with metadata display, paginated data table for CSV (column headers + rows) or formatted JSON viewer, delete functionality, and back navigation.

10. **Integrate navigation and routing** - Update [frontend/src/components/NavBar.jsx](frontend/src/components/NavBar.jsx) to add Upload icon link, and [frontend/src/App.jsx](frontend/src/App.jsx) to add `/uploads`, `/uploads/new`, `/uploads/:id` routes.

### Further Considerations

1. **File size limit** — What maximum file size should be allowed? Recommend 10MB default with configurable limit.
2. **Data storage approach** — Store data in JSONB column (simpler, enables queries) vs. file system (better for large files)? JSONB recommended for this initial implementation.
3. **Update functionality** — Should users be able to re-upload/update an existing upload, or only create new + delete old?
