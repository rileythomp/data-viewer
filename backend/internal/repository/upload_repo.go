package repository

import (
	"database/sql"
	"encoding/json"
	"fmt"

	"finance-tracker/internal/models"
)

const batchSize = 100 // Number of rows to insert per transaction batch

type UploadRepository struct {
	db *sql.DB
}

func NewUploadRepository(db *sql.DB) *UploadRepository {
	return &UploadRepository{db: db}
}

func (r *UploadRepository) GetAll(page, pageSize int) (*models.UploadListResponse, error) {
	// Get total count
	var total int
	err := r.db.QueryRow("SELECT COUNT(*) FROM uploads").Scan(&total)
	if err != nil {
		return nil, fmt.Errorf("failed to count uploads: %w", err)
	}

	// Get paginated uploads (without data field for list view)
	offset := (page - 1) * pageSize
	query := `
		SELECT id, name, description, file_name, file_type, file_size, row_count, columns,
		       COALESCE(status, 'completed') as status, COALESCE(error_message, '') as error_message,
		       created_at, updated_at
		FROM uploads
		ORDER BY created_at DESC
		LIMIT $1 OFFSET $2
	`
	rows, err := r.db.Query(query, pageSize, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to query uploads: %w", err)
	}
	defer rows.Close()

	var uploads []models.Upload
	for rows.Next() {
		var u models.Upload
		var columnsJSON []byte
		if err := rows.Scan(&u.ID, &u.Name, &u.Description, &u.FileName, &u.FileType, &u.FileSize, &u.RowCount, &columnsJSON, &u.Status, &u.ErrorMessage, &u.CreatedAt, &u.UpdatedAt); err != nil {
			return nil, fmt.Errorf("failed to scan upload: %w", err)
		}
		if len(columnsJSON) > 0 {
			json.Unmarshal(columnsJSON, &u.Columns)
		}
		uploads = append(uploads, u)
	}

	return &models.UploadListResponse{
		Uploads:  uploads,
		Total:    total,
		Page:     page,
		PageSize: pageSize,
	}, nil
}

func (r *UploadRepository) GetByID(id int) (*models.Upload, error) {
	query := `
		SELECT id, name, description, file_name, file_type, file_size, row_count, columns,
		       COALESCE(status, 'completed') as status, COALESCE(error_message, '') as error_message,
		       created_at, updated_at
		FROM uploads
		WHERE id = $1
	`
	var u models.Upload
	var columnsJSON []byte
	err := r.db.QueryRow(query, id).Scan(&u.ID, &u.Name, &u.Description, &u.FileName, &u.FileType, &u.FileSize, &u.RowCount, &columnsJSON, &u.Status, &u.ErrorMessage, &u.CreatedAt, &u.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get upload: %w", err)
	}
	if len(columnsJSON) > 0 {
		json.Unmarshal(columnsJSON, &u.Columns)
	}
	return &u, nil
}

func (r *UploadRepository) GetData(id int, page, pageSize int) (*models.UploadDataResponse, error) {
	// First get the upload metadata
	upload, err := r.GetByID(id)
	if err != nil {
		return nil, err
	}
	if upload == nil {
		return nil, nil
	}

	offset := (page - 1) * pageSize

	// Check if data exists in the normalized upload_rows table
	var normalizedCount int
	err = r.db.QueryRow("SELECT COUNT(*) FROM upload_rows WHERE upload_id = $1", id).Scan(&normalizedCount)
	if err != nil {
		return nil, fmt.Errorf("failed to count upload rows: %w", err)
	}

	if normalizedCount > 0 {
		// Use database-level pagination from upload_rows
		query := `
			SELECT data FROM upload_rows
			WHERE upload_id = $1
			ORDER BY row_index
			LIMIT $2 OFFSET $3
		`
		rows, err := r.db.Query(query, id, pageSize, offset)
		if err != nil {
			return nil, fmt.Errorf("failed to get upload rows: %w", err)
		}
		defer rows.Close()

		var paginatedData [][]any
		for rows.Next() {
			var dataJSON []byte
			if err := rows.Scan(&dataJSON); err != nil {
				return nil, fmt.Errorf("failed to scan upload row: %w", err)
			}
			var rowData []any
			if len(dataJSON) > 0 {
				json.Unmarshal(dataJSON, &rowData)
			}
			paginatedData = append(paginatedData, rowData)
		}

		return &models.UploadDataResponse{
			Columns:  upload.Columns,
			Data:     paginatedData,
			Total:    normalizedCount,
			Page:     page,
			PageSize: pageSize,
		}, nil
	}

	// Fallback: read from legacy data JSONB column (for backwards compatibility)
	query := `
		SELECT data
		FROM uploads
		WHERE id = $1
	`
	var dataJSON []byte
	err = r.db.QueryRow(query, id).Scan(&dataJSON)
	if err != nil {
		return nil, fmt.Errorf("failed to get upload data: %w", err)
	}

	var allData [][]any
	if len(dataJSON) > 0 {
		json.Unmarshal(dataJSON, &allData)
	}

	// Calculate pagination
	total := len(allData)
	end := offset + pageSize
	if end > total {
		end = total
	}
	var paginatedData [][]any
	if offset < total {
		paginatedData = allData[offset:end]
	}

	return &models.UploadDataResponse{
		Columns:  upload.Columns,
		Data:     paginatedData,
		Total:    total,
		Page:     page,
		PageSize: pageSize,
	}, nil
}

func (r *UploadRepository) Create(req *models.CreateUploadRequest) (*models.Upload, error) {
	columnsJSON, err := json.Marshal(req.Columns)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal columns: %w", err)
	}

	rowCount := len(req.Data)

	// Start transaction for atomic insert
	tx, err := r.db.Begin()
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// Insert upload metadata (without data blob)
	query := `
		INSERT INTO uploads (name, description, file_name, file_type, file_size, row_count, columns, data, status)
		VALUES ($1, $2, $3, $4, $5, $6, $7, '[]', 'completed')
		RETURNING id, name, description, file_name, file_type, file_size, row_count, columns,
		          COALESCE(status, 'completed') as status, COALESCE(error_message, '') as error_message,
		          created_at, updated_at
	`
	var u models.Upload
	var returnedColumnsJSON []byte
	err = tx.QueryRow(query,
		req.Name,
		req.Description,
		req.FileName,
		req.FileType,
		req.FileSize,
		rowCount,
		columnsJSON,
	).Scan(&u.ID, &u.Name, &u.Description, &u.FileName, &u.FileType, &u.FileSize, &u.RowCount, &returnedColumnsJSON, &u.Status, &u.ErrorMessage, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to create upload: %w", err)
	}
	if len(returnedColumnsJSON) > 0 {
		json.Unmarshal(returnedColumnsJSON, &u.Columns)
	}

	// Insert rows in batches to the normalized table
	for i := 0; i < len(req.Data); i += batchSize {
		end := i + batchSize
		if end > len(req.Data) {
			end = len(req.Data)
		}
		batch := req.Data[i:end]

		for j, row := range batch {
			rowJSON, err := json.Marshal(row)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal row data: %w", err)
			}
			_, err = tx.Exec(
				"INSERT INTO upload_rows (upload_id, row_index, data) VALUES ($1, $2, $3)",
				u.ID, i+j, rowJSON,
			)
			if err != nil {
				return nil, fmt.Errorf("failed to insert upload row: %w", err)
			}
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}

	return &u, nil
}

func (r *UploadRepository) Delete(id int) error {
	// Check if upload exists
	upload, err := r.GetByID(id)
	if err != nil {
		return err
	}
	if upload == nil {
		return fmt.Errorf("upload not found")
	}

	// Delete will cascade to upload_rows due to ON DELETE CASCADE
	_, err = r.db.Exec("DELETE FROM uploads WHERE id = $1", id)
	if err != nil {
		return fmt.Errorf("failed to delete upload: %w", err)
	}
	return nil
}

// CreateMetadata creates upload metadata with pending status for async processing
func (r *UploadRepository) CreateMetadata(req *models.CreateUploadMetadataRequest) (*models.Upload, error) {
	columnsJSON, err := json.Marshal(req.Columns)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal columns: %w", err)
	}

	query := `
		INSERT INTO uploads (name, description, file_name, file_type, file_size, row_count, columns, data, status)
		VALUES ($1, $2, $3, $4, $5, 0, $6, '[]', $7)
		RETURNING id, name, description, file_name, file_type, file_size, row_count, columns,
		          COALESCE(status, 'completed') as status, COALESCE(error_message, '') as error_message,
		          created_at, updated_at
	`
	var u models.Upload
	var returnedColumnsJSON []byte
	err = r.db.QueryRow(query,
		req.Name,
		req.Description,
		req.FileName,
		req.FileType,
		req.FileSize,
		columnsJSON,
		req.Status,
	).Scan(&u.ID, &u.Name, &u.Description, &u.FileName, &u.FileType, &u.FileSize, &u.RowCount, &returnedColumnsJSON, &u.Status, &u.ErrorMessage, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to create upload metadata: %w", err)
	}
	if len(returnedColumnsJSON) > 0 {
		json.Unmarshal(returnedColumnsJSON, &u.Columns)
	}
	return &u, nil
}

// UpdateStatus updates the upload status and optionally the error message
func (r *UploadRepository) UpdateStatus(id int, status string, errorMessage string) error {
	query := `
		UPDATE uploads
		SET status = $2, error_message = $3, updated_at = NOW()
		WHERE id = $1
	`
	_, err := r.db.Exec(query, id, status, errorMessage)
	if err != nil {
		return fmt.Errorf("failed to update upload status: %w", err)
	}
	return nil
}

// UpdateRowCount updates the row count after processing
func (r *UploadRepository) UpdateRowCount(id int, rowCount int) error {
	query := `
		UPDATE uploads
		SET row_count = $2, updated_at = NOW()
		WHERE id = $1
	`
	_, err := r.db.Exec(query, id, rowCount)
	if err != nil {
		return fmt.Errorf("failed to update row count: %w", err)
	}
	return nil
}

// UpdateColumns updates the columns after parsing (for JSON where columns are discovered during parsing)
func (r *UploadRepository) UpdateColumns(id int, columns []string) error {
	columnsJSON, err := json.Marshal(columns)
	if err != nil {
		return fmt.Errorf("failed to marshal columns: %w", err)
	}

	query := `
		UPDATE uploads
		SET columns = $2, updated_at = NOW()
		WHERE id = $1
	`
	_, err = r.db.Exec(query, id, columnsJSON)
	if err != nil {
		return fmt.Errorf("failed to update columns: %w", err)
	}
	return nil
}

// InsertRowsBatch inserts a batch of rows to the upload_rows table
func (r *UploadRepository) InsertRowsBatch(uploadID int, startIndex int, rows [][]any) error {
	tx, err := r.db.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	for i, row := range rows {
		rowJSON, err := json.Marshal(row)
		if err != nil {
			return fmt.Errorf("failed to marshal row data: %w", err)
		}
		_, err = tx.Exec(
			"INSERT INTO upload_rows (upload_id, row_index, data) VALUES ($1, $2, $3)",
			uploadID, startIndex+i, rowJSON,
		)
		if err != nil {
			return fmt.Errorf("failed to insert upload row: %w", err)
		}
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}
	return nil
}
