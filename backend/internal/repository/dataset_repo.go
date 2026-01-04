package repository

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"strings"

	"finance-tracker/internal/models"
)

type DatasetRepository struct {
	db *sql.DB
}

func NewDatasetRepository(db *sql.DB) *DatasetRepository {
	return &DatasetRepository{db: db}
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
		SELECT id, name, description, row_count, status, COALESCE(error_message, ''), created_at, updated_at
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
		if err := rows.Scan(&d.ID, &d.Name, &d.Description, &d.RowCount, &d.Status, &d.ErrorMessage, &d.CreatedAt, &d.UpdatedAt); err != nil {
			return nil, fmt.Errorf("failed to scan dataset: %w", err)
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
		SELECT id, name, description, row_count, status, COALESCE(error_message, ''), created_at, updated_at
		FROM datasets
		WHERE id = $1
	`
	var d models.Dataset
	err := r.db.QueryRow(query, id).Scan(&d.ID, &d.Name, &d.Description, &d.RowCount, &d.Status, &d.ErrorMessage, &d.CreatedAt, &d.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get dataset: %w", err)
	}

	// Get sources with names
	sources, err := r.getSources(id)
	if err != nil {
		return nil, err
	}
	d.Sources = sources

	// Get columns
	columns, err := r.getColumns(id)
	if err != nil {
		return nil, err
	}
	d.Columns = columns

	return &d, nil
}

func (r *DatasetRepository) getSources(datasetID int) ([]models.DatasetSource, error) {
	query := `
		SELECT ds.id, ds.dataset_id, ds.source_type, ds.source_id, ds.position, ds.created_at,
		       COALESCE(u.name, '') as source_name
		FROM dataset_sources ds
		LEFT JOIN uploads u ON ds.source_type = 'upload' AND ds.source_id = u.id
		WHERE ds.dataset_id = $1
		ORDER BY ds.position
	`
	rows, err := r.db.Query(query, datasetID)
	if err != nil {
		return nil, fmt.Errorf("failed to query dataset sources: %w", err)
	}
	defer rows.Close()

	var sources []models.DatasetSource
	for rows.Next() {
		var s models.DatasetSource
		if err := rows.Scan(&s.ID, &s.DatasetID, &s.SourceType, &s.SourceID, &s.Position, &s.CreatedAt, &s.SourceName); err != nil {
			return nil, fmt.Errorf("failed to scan dataset source: %w", err)
		}
		sources = append(sources, s)
	}
	return sources, nil
}

func (r *DatasetRepository) getColumns(datasetID int) ([]models.DatasetColumn, error) {
	query := `
		SELECT id, dataset_id, name, inferred_type, COALESCE(override_type, ''), position
		FROM dataset_columns
		WHERE dataset_id = $1
		ORDER BY position
	`
	rows, err := r.db.Query(query, datasetID)
	if err != nil {
		return nil, fmt.Errorf("failed to query dataset columns: %w", err)
	}
	defer rows.Close()

	var columns []models.DatasetColumn
	for rows.Next() {
		var c models.DatasetColumn
		if err := rows.Scan(&c.ID, &c.DatasetID, &c.Name, &c.InferredType, &c.OverrideType, &c.Position); err != nil {
			return nil, fmt.Errorf("failed to scan dataset column: %w", err)
		}
		columns = append(columns, c)
	}
	return columns, nil
}

func (r *DatasetRepository) Create(req *models.CreateDatasetRequest) (*models.Dataset, error) {
	tx, err := r.db.Begin()
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// Create dataset
	query := `
		INSERT INTO datasets (name, description, status)
		VALUES ($1, $2, 'pending')
		RETURNING id, name, description, row_count, status, COALESCE(error_message, ''), created_at, updated_at
	`
	var d models.Dataset
	err = tx.QueryRow(query, req.Name, req.Description).Scan(
		&d.ID, &d.Name, &d.Description, &d.RowCount, &d.Status, &d.ErrorMessage, &d.CreatedAt, &d.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create dataset: %w", err)
	}

	// Add sources
	for i, sourceID := range req.SourceIDs {
		_, err = tx.Exec(`
			INSERT INTO dataset_sources (dataset_id, source_type, source_id, position)
			VALUES ($1, 'upload', $2, $3)
		`, d.ID, sourceID, i)
		if err != nil {
			return nil, fmt.Errorf("failed to add source: %w", err)
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}

	// Build the dataset (populate data table)
	if err := r.BuildDataset(d.ID); err != nil {
		// Update status to error
		r.db.Exec("UPDATE datasets SET status = 'error', error_message = $1 WHERE id = $2", err.Error(), d.ID)
	}

	// Return the updated dataset
	return r.GetByID(d.ID)
}

func (r *DatasetRepository) Delete(id int) error {
	// Check if dataset exists
	dataset, err := r.GetByID(id)
	if err != nil {
		return err
	}
	if dataset == nil {
		return fmt.Errorf("dataset not found")
	}

	// Drop the data table
	tableName := fmt.Sprintf("datasets_data.dataset_%d", id)
	_, err = r.db.Exec(fmt.Sprintf("DROP TABLE IF EXISTS %s", tableName))
	if err != nil {
		return fmt.Errorf("failed to drop data table: %w", err)
	}

	// Delete the dataset (cascades to sources and columns)
	_, err = r.db.Exec("DELETE FROM datasets WHERE id = $1", id)
	if err != nil {
		return fmt.Errorf("failed to delete dataset: %w", err)
	}

	return nil
}

func (r *DatasetRepository) AddSource(datasetID int, sourceType string, sourceID int) error {
	// Get next position
	var maxPos int
	r.db.QueryRow("SELECT COALESCE(MAX(position), -1) FROM dataset_sources WHERE dataset_id = $1", datasetID).Scan(&maxPos)

	_, err := r.db.Exec(`
		INSERT INTO dataset_sources (dataset_id, source_type, source_id, position)
		VALUES ($1, $2, $3, $4)
	`, datasetID, sourceType, sourceID, maxPos+1)
	if err != nil {
		return fmt.Errorf("failed to add source: %w", err)
	}

	// Rebuild dataset
	return r.BuildDataset(datasetID)
}

func (r *DatasetRepository) RemoveSource(datasetID, sourceID int) error {
	_, err := r.db.Exec("DELETE FROM dataset_sources WHERE dataset_id = $1 AND id = $2", datasetID, sourceID)
	if err != nil {
		return fmt.Errorf("failed to remove source: %w", err)
	}

	// Rebuild dataset
	return r.BuildDataset(datasetID)
}

// DatasetWithSourceInfo includes the source junction table ID for removal operations
type DatasetWithSourceInfo struct {
	models.Dataset
	SourceJunctionID int `json:"source_junction_id"`
}

// GetBySourceUploadID returns all datasets that contain the specified upload as a source
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
	if err != nil {
		return nil, fmt.Errorf("failed to query datasets by source: %w", err)
	}
	defer rows.Close()

	var datasets []DatasetWithSourceInfo
	for rows.Next() {
		var d DatasetWithSourceInfo
		if err := rows.Scan(&d.ID, &d.Name, &d.Description, &d.RowCount, &d.Status,
			&d.ErrorMessage, &d.CreatedAt, &d.UpdatedAt, &d.SourceJunctionID); err != nil {
			return nil, fmt.Errorf("failed to scan dataset: %w", err)
		}
		datasets = append(datasets, d)
	}
	return datasets, nil
}

func (r *DatasetRepository) BuildDataset(id int) error {
	// Get dataset name for logging
	var datasetName string
	r.db.QueryRow("SELECT name FROM datasets WHERE id = $1", id).Scan(&datasetName)
	log.Printf("[BuildDataset] Starting build for dataset '%s' (ID: %d)", datasetName, id)

	// Set status to building
	_, err := r.db.Exec("UPDATE datasets SET status = 'building', error_message = NULL, updated_at = NOW() WHERE id = $1", id)
	if err != nil {
		log.Printf("[BuildDataset] ERROR: Failed to update status for dataset '%s': %v", datasetName, err)
		return fmt.Errorf("failed to update status: %w", err)
	}

	// Get sources
	sources, err := r.getSources(id)
	if err != nil {
		log.Printf("[BuildDataset] ERROR: Failed to get sources for dataset '%s': %v", datasetName, err)
		r.setError(id, err.Error())
		return err
	}

	log.Printf("[BuildDataset] Found %d sources for dataset '%s'", len(sources), datasetName)

	if len(sources) == 0 {
		log.Printf("[BuildDataset] No sources found, marking dataset '%s' as ready with 0 rows", datasetName)
		// No sources, mark as ready with 0 rows
		_, err = r.db.Exec("UPDATE datasets SET status = 'ready', row_count = 0, updated_at = NOW() WHERE id = $1", id)
		if err != nil {
			return err
		}
		// Clear columns
		r.db.Exec("DELETE FROM dataset_columns WHERE dataset_id = $1", id)
		return nil
	}

	// Get columns from first source
	var firstColumns []string
	if sources[0].SourceType == "upload" {
		var columnsJSON []byte
		err = r.db.QueryRow("SELECT columns FROM uploads WHERE id = $1", sources[0].SourceID).Scan(&columnsJSON)
		if err != nil {
			log.Printf("[BuildDataset] ERROR: Failed to get columns from source upload '%s': %v", sources[0].SourceName, err)
			r.setError(id, "failed to get columns from source upload")
			return fmt.Errorf("failed to get columns from source: %w", err)
		}
		json.Unmarshal(columnsJSON, &firstColumns)
		log.Printf("[BuildDataset] Got %d columns from source upload '%s': %v", len(firstColumns), sources[0].SourceName, firstColumns)
	}

	if len(firstColumns) == 0 {
		log.Printf("[BuildDataset] ERROR: Source has no columns for dataset '%s'", datasetName)
		r.setError(id, "source has no columns")
		return fmt.Errorf("source has no columns")
	}

	// Validate all sources have matching columns
	for i, source := range sources[1:] {
		if source.SourceType == "upload" {
			var columnsJSON []byte
			err = r.db.QueryRow("SELECT columns FROM uploads WHERE id = $1", source.SourceID).Scan(&columnsJSON)
			if err != nil {
				r.setError(id, fmt.Sprintf("failed to get columns from source %d", i+2))
				return fmt.Errorf("failed to get columns from source %d: %w", i+2, err)
			}
			var cols []string
			json.Unmarshal(columnsJSON, &cols)
			if !columnsMatch(firstColumns, cols) {
				r.setError(id, fmt.Sprintf("column mismatch with source %d: expected %v, got %v", i+2, firstColumns, cols))
				return fmt.Errorf("column mismatch with source %d", i+2)
			}
		}
	}

	// Update dataset_columns
	r.db.Exec("DELETE FROM dataset_columns WHERE dataset_id = $1", id)
	for i, col := range firstColumns {
		r.db.Exec(`
			INSERT INTO dataset_columns (dataset_id, name, inferred_type, position)
			VALUES ($1, $2, 'text', $3)
		`, id, col, i)
	}

	// Create/recreate the data table
	tableName := fmt.Sprintf("datasets_data.dataset_%d", id)
	r.db.Exec(fmt.Sprintf("DROP TABLE IF EXISTS %s", tableName))

	// Build column definitions for create table
	colDefs := make([]string, len(firstColumns))
	for i, col := range firstColumns {
		// Sanitize column name for SQL
		safeName := sanitizeColumnName(col)
		colDefs[i] = fmt.Sprintf("%s TEXT", safeName)
	}
	createSQL := fmt.Sprintf("CREATE TABLE %s (id SERIAL PRIMARY KEY, %s)", tableName, strings.Join(colDefs, ", "))
	_, err = r.db.Exec(createSQL)
	if err != nil {
		r.setError(id, "failed to create data table: "+err.Error())
		return fmt.Errorf("failed to create data table: %w", err)
	}

	// Insert data from all sources
	totalRows := 0
	for _, source := range sources {
		if source.SourceType == "upload" {
			log.Printf("[BuildDataset] Processing source upload '%s' (ID: %d)", source.SourceName, source.SourceID)

			// Check if data exists in the normalized upload_rows table
			var normalizedCount int
			err = r.db.QueryRow("SELECT COUNT(*) FROM upload_rows WHERE upload_id = $1", source.SourceID).Scan(&normalizedCount)
			if err != nil {
				log.Printf("[BuildDataset] ERROR: Failed to count upload_rows for upload '%s': %v", source.SourceName, err)
				continue
			}

			log.Printf("[BuildDataset] Found %d rows in upload_rows for upload '%s'", normalizedCount, source.SourceName)

			var sourceRows [][]any

			if normalizedCount > 0 {
				// Read from normalized upload_rows table
				rows, err := r.db.Query("SELECT data FROM upload_rows WHERE upload_id = $1 ORDER BY row_index", source.SourceID)
				if err != nil {
					log.Printf("[BuildDataset] ERROR: Failed to query upload_rows for upload '%s': %v", source.SourceName, err)
					continue
				}

				for rows.Next() {
					var rowJSON []byte
					if err := rows.Scan(&rowJSON); err != nil {
						log.Printf("[BuildDataset] ERROR: Failed to scan row from upload_rows: %v", err)
						continue
					}

					var row []any
					if err := json.Unmarshal(rowJSON, &row); err != nil {
						log.Printf("[BuildDataset] ERROR: Failed to unmarshal row data: %v", err)
						continue
					}
					sourceRows = append(sourceRows, row)
				}
				rows.Close()
			} else {
				// Fallback: read from legacy data JSONB column
				log.Printf("[BuildDataset] No rows in upload_rows, falling back to legacy data column for upload '%s'", source.SourceName)
				var dataJSON []byte
				err = r.db.QueryRow("SELECT data FROM uploads WHERE id = $1", source.SourceID).Scan(&dataJSON)
				if err != nil {
					log.Printf("[BuildDataset] ERROR: Failed to get legacy data for upload '%s': %v", source.SourceName, err)
					continue
				}

				if len(dataJSON) > 0 {
					if err := json.Unmarshal(dataJSON, &sourceRows); err != nil {
						log.Printf("[BuildDataset] ERROR: Failed to unmarshal legacy data for upload '%s': %v", source.SourceName, err)
						continue
					}
				}
				log.Printf("[BuildDataset] Found %d rows in legacy data column for upload '%s'", len(sourceRows), source.SourceName)
			}

			// Insert all rows from this source
			rowCount := 0
			for _, row := range sourceRows {
				// Build insert statement
				safeColNames := make([]string, len(firstColumns))
				placeholders := make([]string, len(firstColumns))
				values := make([]any, len(firstColumns))
				for i, col := range firstColumns {
					safeColNames[i] = sanitizeColumnName(col)
					placeholders[i] = fmt.Sprintf("$%d", i+1)
					if i < len(row) {
						values[i] = fmt.Sprintf("%v", row[i])
					} else {
						values[i] = ""
					}
				}
				insertSQL := fmt.Sprintf("INSERT INTO %s (%s) VALUES (%s)",
					tableName,
					strings.Join(safeColNames, ", "),
					strings.Join(placeholders, ", "),
				)
				_, err = r.db.Exec(insertSQL, values...)
				if err != nil {
					log.Printf("[BuildDataset] ERROR: Failed to insert row into dataset table: %v", err)
					continue
				}
				totalRows++
				rowCount++
			}

			log.Printf("[BuildDataset] Inserted %d rows from upload '%s', %d total rows so far for dataset '%s'", rowCount, source.SourceName, totalRows, datasetName)
		}
	}

	// Update dataset with row count and status
	log.Printf("[BuildDataset] Build complete for dataset '%s'. Total rows inserted: %d", datasetName, totalRows)
	_, err = r.db.Exec("UPDATE datasets SET status = 'ready', row_count = $1, updated_at = NOW() WHERE id = $2", totalRows, id)
	if err != nil {
		log.Printf("[BuildDataset] ERROR: Failed to update dataset '%s' status: %v", datasetName, err)
		return fmt.Errorf("failed to update dataset status: %w", err)
	}

	log.Printf("[BuildDataset] Dataset '%s' marked as ready with %d rows", datasetName, totalRows)
	return nil
}

func (r *DatasetRepository) GetData(id int, page, pageSize int, sortColumn, sortDirection string) (*models.DatasetDataResponse, error) {
	// Get dataset to check it exists and is ready
	dataset, err := r.GetByID(id)
	if err != nil {
		return nil, err
	}
	if dataset == nil {
		return nil, nil
	}
	if dataset.Status != "ready" {
		return nil, fmt.Errorf("dataset is not ready (status: %s)", dataset.Status)
	}

	tableName := fmt.Sprintf("datasets_data.dataset_%d", id)

	// Get column names
	columnNames := make([]string, len(dataset.Columns))
	for i, col := range dataset.Columns {
		columnNames[i] = col.Name
	}

	// Build query
	safeColNames := make([]string, len(columnNames))
	for i, col := range columnNames {
		safeColNames[i] = sanitizeColumnName(col)
	}
	selectCols := strings.Join(safeColNames, ", ")

	// Validate sort column
	orderClause := "id"
	if sortColumn != "" {
		safeSortCol := sanitizeColumnName(sortColumn)
		// Verify column exists
		for _, col := range safeColNames {
			if col == safeSortCol {
				orderClause = safeSortCol
				if sortDirection == "desc" {
					orderClause += " DESC"
				} else {
					orderClause += " ASC"
				}
				break
			}
		}
	}

	offset := (page - 1) * pageSize
	query := fmt.Sprintf("SELECT %s FROM %s ORDER BY %s LIMIT $1 OFFSET $2", selectCols, tableName, orderClause)
	rows, err := r.db.Query(query, pageSize, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to query data: %w", err)
	}
	defer rows.Close()

	var data [][]any
	for rows.Next() {
		values := make([]any, len(columnNames))
		valuePtrs := make([]any, len(columnNames))
		for i := range values {
			valuePtrs[i] = &values[i]
		}
		if err := rows.Scan(valuePtrs...); err != nil {
			return nil, fmt.Errorf("failed to scan row: %w", err)
		}
		// Convert sql.NullString and []byte to string
		row := make([]any, len(values))
		for i, v := range values {
			switch val := v.(type) {
			case []byte:
				row[i] = string(val)
			case nil:
				row[i] = ""
			default:
				row[i] = val
			}
		}
		data = append(data, row)
	}

	return &models.DatasetDataResponse{
		Columns:  columnNames,
		Rows:     data,
		Total:    dataset.RowCount,
		Page:     page,
		PageSize: pageSize,
	}, nil
}

func (r *DatasetRepository) setError(id int, message string) {
	r.db.Exec("UPDATE datasets SET status = 'error', error_message = $1, updated_at = NOW() WHERE id = $2", message, id)
}

func columnsMatch(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}

func sanitizeColumnName(name string) string {
	// Replace spaces and special chars with underscores, lowercase
	result := strings.ToLower(name)
	result = strings.ReplaceAll(result, " ", "_")
	result = strings.ReplaceAll(result, "-", "_")
	result = strings.ReplaceAll(result, ".", "_")
	// Remove any other non-alphanumeric chars except underscore
	var sb strings.Builder
	for _, c := range result {
		if (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c == '_' {
			sb.WriteRune(c)
		}
	}
	result = sb.String()
	if result == "" {
		result = "column"
	}
	// Ensure it doesn't start with a number
	if result[0] >= '0' && result[0] <= '9' {
		result = "col_" + result
	}
	return result
}
