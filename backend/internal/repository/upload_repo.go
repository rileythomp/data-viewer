package repository

import (
	"database/sql"
	"encoding/json"
	"fmt"

	"finance-tracker/internal/models"
)

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
		SELECT id, name, description, file_name, file_type, file_size, row_count, columns, created_at, updated_at
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
		if err := rows.Scan(&u.ID, &u.Name, &u.Description, &u.FileName, &u.FileType, &u.FileSize, &u.RowCount, &columnsJSON, &u.CreatedAt, &u.UpdatedAt); err != nil {
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
		SELECT id, name, description, file_name, file_type, file_size, row_count, columns, created_at, updated_at
		FROM uploads
		WHERE id = $1
	`
	var u models.Upload
	var columnsJSON []byte
	err := r.db.QueryRow(query, id).Scan(&u.ID, &u.Name, &u.Description, &u.FileName, &u.FileType, &u.FileSize, &u.RowCount, &columnsJSON, &u.CreatedAt, &u.UpdatedAt)
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

	// Get paginated data
	offset := (page - 1) * pageSize
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

	dataJSON, err := json.Marshal(req.Data)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal data: %w", err)
	}

	rowCount := len(req.Data)

	query := `
		INSERT INTO uploads (name, description, file_name, file_type, file_size, row_count, columns, data)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id, name, description, file_name, file_type, file_size, row_count, columns, created_at, updated_at
	`
	var u models.Upload
	var returnedColumnsJSON []byte
	err = r.db.QueryRow(query,
		req.Name,
		req.Description,
		req.FileName,
		req.FileType,
		req.FileSize,
		rowCount,
		columnsJSON,
		dataJSON,
	).Scan(&u.ID, &u.Name, &u.Description, &u.FileName, &u.FileType, &u.FileSize, &u.RowCount, &returnedColumnsJSON, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to create upload: %w", err)
	}
	if len(returnedColumnsJSON) > 0 {
		json.Unmarshal(returnedColumnsJSON, &u.Columns)
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

	_, err = r.db.Exec("DELETE FROM uploads WHERE id = $1", id)
	if err != nil {
		return fmt.Errorf("failed to delete upload: %w", err)
	}
	return nil
}
