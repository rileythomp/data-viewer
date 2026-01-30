package repository

import (
	"database/sql"
	"fmt"

	"finance-tracker/internal/models"
	"finance-tracker/internal/service"
	"finance-tracker/internal/storage"
)

type DatasetRepository struct {
	db          *sql.DB
	storage     storage.DatasetStorage
	syncService *service.DatasetSyncService
}

func NewDatasetRepository(db *sql.DB, storage storage.DatasetStorage, syncService *service.DatasetSyncService) *DatasetRepository {
	return &DatasetRepository{
		db:          db,
		storage:     storage,
		syncService: syncService,
	}
}

func (r *DatasetRepository) GetAll(page, pageSize int) (*models.DatasetListResponse, error) {
	// Get total count
	var total int
	err := r.db.QueryRow("SELECT COUNT(*) FROM datasets").Scan(&total)
	if err != nil {
		return nil, fmt.Errorf("failed to count datasets: %w", err)
	}

	// Get paginated datasets
	offset := (page - 1) * pageSize
	query := `
		SELECT id, name, description, COALESCE(folder_path, ''), row_count, status,
		       COALESCE(error_message, ''), COALESCE(last_commit_hash, ''), last_synced_at,
		       created_at, updated_at
		FROM datasets
		ORDER BY created_at DESC
		LIMIT $1 OFFSET $2
	`
	rows, err := r.db.Query(query, pageSize, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to query datasets: %w", err)
	}
	defer rows.Close()

	var datasets []models.Dataset
	for rows.Next() {
		var d models.Dataset
		var lastSyncedAt sql.NullTime
		if err := rows.Scan(&d.ID, &d.Name, &d.Description, &d.FolderPath, &d.RowCount, &d.Status,
			&d.ErrorMessage, &d.LastCommitHash, &lastSyncedAt, &d.CreatedAt, &d.UpdatedAt); err != nil {
			return nil, fmt.Errorf("failed to scan dataset: %w", err)
		}
		if lastSyncedAt.Valid {
			d.LastSyncedAt = &lastSyncedAt.Time
		}
		datasets = append(datasets, d)
	}

	return &models.DatasetListResponse{
		Datasets: datasets,
		Total:    total,
		Page:     page,
		PageSize: pageSize,
	}, nil
}

func (r *DatasetRepository) GetByID(id int) (*models.Dataset, error) {
	query := `
		SELECT id, name, description, COALESCE(folder_path, ''), row_count, status,
		       COALESCE(error_message, ''), COALESCE(last_commit_hash, ''), last_synced_at,
		       created_at, updated_at
		FROM datasets
		WHERE id = $1
	`
	var d models.Dataset
	var lastSyncedAt sql.NullTime
	err := r.db.QueryRow(query, id).Scan(&d.ID, &d.Name, &d.Description, &d.FolderPath, &d.RowCount,
		&d.Status, &d.ErrorMessage, &d.LastCommitHash, &lastSyncedAt, &d.CreatedAt, &d.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get dataset: %w", err)
	}
	if lastSyncedAt.Valid {
		d.LastSyncedAt = &lastSyncedAt.Time
	}

	return &d, nil
}

// ValidationError represents a user-facing validation error
type ValidationError struct {
	Message string
}

func (e *ValidationError) Error() string {
	return e.Message
}

// IsValidationError checks if an error is a ValidationError
func IsValidationError(err error) bool {
	_, ok := err.(*ValidationError)
	return ok
}

func (r *DatasetRepository) Create(req *models.CreateDatasetRequest) (*models.Dataset, error) {
	if req.FolderPath == "" {
		return nil, &ValidationError{Message: "Folder path is required"}
	}

	// Initialize git repo and validate folder
	commitHash, err := r.syncService.InitializeDataset(req.FolderPath)
	if err != nil {
		return nil, &ValidationError{Message: fmt.Sprintf("Failed to initialize folder: %v", err)}
	}

	// Generate table name from dataset name
	tableName := storage.ToTableName(req.Name)

	tx, err := r.db.Begin()
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// Check if table name is unique, append suffix if needed
	tableName, err = r.ensureUniqueTableName(tx, tableName)
	if err != nil {
		return nil, fmt.Errorf("failed to generate unique table name: %w", err)
	}

	// Create dataset with folder path and table name
	query := `
		INSERT INTO datasets (name, description, folder_path, last_commit_hash, table_name, status)
		VALUES ($1, $2, $3, $4, $5, 'pending')
		RETURNING id, name, description, COALESCE(folder_path, ''), row_count, status,
		          COALESCE(error_message, ''), COALESCE(last_commit_hash, ''), last_synced_at,
		          created_at, updated_at
	`
	var d models.Dataset
	var lastSyncedAt sql.NullTime
	err = tx.QueryRow(query, req.Name, req.Description, req.FolderPath, commitHash, tableName).Scan(
		&d.ID, &d.Name, &d.Description, &d.FolderPath, &d.RowCount, &d.Status,
		&d.ErrorMessage, &d.LastCommitHash, &lastSyncedAt, &d.CreatedAt, &d.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create dataset: %w", err)
	}
	if lastSyncedAt.Valid {
		d.LastSyncedAt = &lastSyncedAt.Time
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}

	// Perform initial sync to load data
	datasetInfo := &service.DatasetInfo{
		ID:         d.ID,
		Name:       d.Name,
		TableName:  tableName,
		FolderPath: d.FolderPath,
		Status:     d.Status,
	}
	_, _, err = r.syncService.SyncDataset(datasetInfo)
	if err != nil {
		// Error is already stored in the dataset by SyncDataset
		// Return the dataset with error status
	}

	// Return the updated dataset
	return r.GetByID(d.ID)
}

// ensureUniqueTableName checks if a table name is unique and appends a suffix if needed
func (r *DatasetRepository) ensureUniqueTableName(tx *sql.Tx, baseName string) (string, error) {
	tableName := baseName
	suffix := 1

	for {
		var exists bool
		err := tx.QueryRow("SELECT EXISTS(SELECT 1 FROM datasets WHERE table_name = $1)", tableName).Scan(&exists)
		if err != nil {
			return "", err
		}
		if !exists {
			return tableName, nil
		}
		suffix++
		tableName = fmt.Sprintf("%s_%d", baseName, suffix)
	}
}

func (r *DatasetRepository) Delete(id int) error {
	// Get dataset info including table name
	info, err := r.GetDatasetInfo(id)
	if err != nil {
		return err
	}
	if info == nil {
		return fmt.Errorf("dataset not found")
	}

	// Delete data from storage using table name
	if info.TableName != "" {
		if err := r.storage.DeleteData(info.TableName); err != nil {
			return fmt.Errorf("failed to delete data: %w", err)
		}
	}

	// Delete the dataset (cascades to columns)
	_, err = r.db.Exec("DELETE FROM datasets WHERE id = $1", id)
	if err != nil {
		return fmt.Errorf("failed to delete dataset: %w", err)
	}

	return nil
}

// GetDatasetInfo returns the minimal dataset info needed for sync operations
func (r *DatasetRepository) GetDatasetInfo(id int) (*service.DatasetInfo, error) {
	query := `
		SELECT id, name, COALESCE(table_name, ''), folder_path, last_commit_hash, status
		FROM datasets
		WHERE id = $1
	`
	var info service.DatasetInfo
	var folderPath sql.NullString
	err := r.db.QueryRow(query, id).Scan(&info.ID, &info.Name, &info.TableName, &folderPath, &info.LastCommitHash, &info.Status)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get dataset info: %w", err)
	}
	if folderPath.Valid {
		info.FolderPath = folderPath.String
	}

	// If table_name is not set (legacy dataset), generate and save it
	if info.TableName == "" {
		info.TableName = storage.ToTableName(info.Name)
		// Try to save it back to the database (best effort)
		_, _ = r.db.Exec("UPDATE datasets SET table_name = $1 WHERE id = $2 AND table_name IS NULL", info.TableName, id)
	}

	return &info, nil
}

func (r *DatasetRepository) SyncDataset(id int) error {
	info, err := r.GetDatasetInfo(id)
	if err != nil {
		return err
	}
	if info == nil {
		return fmt.Errorf("dataset not found")
	}
	if info.FolderPath == "" {
		return fmt.Errorf("dataset has no folder path configured")
	}

	_, _, err = r.syncService.SyncDataset(info)
	return err
}

func (r *DatasetRepository) GetData(id int, page, pageSize int, sortColumn, sortDirection string) (*models.DatasetDataResponse, error) {
	// Get dataset info for sync check
	info, err := r.GetDatasetInfo(id)
	if err != nil {
		return nil, err
	}
	if info == nil {
		return nil, nil
	}

	// Check if currently syncing
	isSyncing := r.syncService.IsSyncing(id)

	// If not syncing, check if sync is needed and trigger it
	if !isSyncing && info.FolderPath != "" {
		needsSync, err := r.syncService.NeedsSync(info)
		if err == nil && needsSync {
			// Start sync in background
			go func() {
				r.syncService.SyncDataset(info)
			}()
			isSyncing = true
		}
	}

	// Get current data from storage (may be stale if syncing)
	dataPage, err := r.storage.GetData(id, info.TableName, page, pageSize, sortColumn, sortDirection)
	if err != nil {
		// If no data exists yet, return empty response with syncing flag
		if isSyncing {
			return &models.DatasetDataResponse{
				Columns:  []string{},
				Rows:     [][]any{},
				Total:    0,
				Page:     page,
				PageSize: pageSize,
				Syncing:  true,
			}, nil
		}
		return nil, err
	}

	return &models.DatasetDataResponse{
		Columns:  dataPage.Columns,
		Rows:     dataPage.Rows,
		Total:    dataPage.Total,
		Page:     dataPage.Page,
		PageSize: dataPage.PageSize,
		Syncing:  isSyncing,
	}, nil
}

func (r *DatasetRepository) IsSyncing(id int) bool {
	return r.syncService.IsSyncing(id)
}
