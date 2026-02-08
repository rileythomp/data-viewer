package storage

import (
	"database/sql"
	"fmt"
	"strings"
	"unicode"
)

// PostgresStorage implements DatasetStorage using PostgreSQL
type PostgresStorage struct {
	db *sql.DB
}

// NewPostgresStorage creates a new PostgreSQL storage instance
func NewPostgresStorage(db *sql.DB) *PostgresStorage {
	return &PostgresStorage{db: db}
}

// ToTableName converts a dataset name to a valid PostgreSQL table name.
// It converts to lowercase, replaces spaces and special characters with underscores,
// removes invalid characters, and ensures the result is a valid identifier.
func ToTableName(datasetName string) string {
	// Convert to lowercase
	result := strings.ToLower(datasetName)

	// Replace common separators with underscores
	result = strings.ReplaceAll(result, " ", "_")
	result = strings.ReplaceAll(result, "-", "_")
	result = strings.ReplaceAll(result, ".", "_")

	// Remove any characters that aren't alphanumeric or underscore
	var sb strings.Builder
	for _, c := range result {
		if unicode.IsLetter(c) || unicode.IsDigit(c) || c == '_' {
			sb.WriteRune(c)
		}
	}
	result = sb.String()

	// Collapse multiple consecutive underscores
	for strings.Contains(result, "__") {
		result = strings.ReplaceAll(result, "__", "_")
	}

	// Trim leading/trailing underscores
	result = strings.Trim(result, "_")

	// Ensure it's not empty
	if result == "" {
		result = "dataset"
	}

	// Ensure it doesn't start with a digit (invalid for PostgreSQL identifiers)
	if len(result) > 0 && result[0] >= '0' && result[0] <= '9' {
		result = "ds_" + result
	}

	return result
}

// fullyQualifiedTableName returns the schema-qualified table name
func fullyQualifiedTableName(tableName string) string {
	return fmt.Sprintf("dataset_data.%s", tableName)
}

// sanitizeColumnName sanitizes a column name for use in SQL
// It wraps the name in double quotes and escapes any existing double quotes
func sanitizeColumnName(name string) string {
	escaped := strings.ReplaceAll(name, "\"", "\"\"")
	return fmt.Sprintf("\"%s\"", escaped)
}

// CreateDatasetTable creates a new table for a dataset with the given columns
func (s *PostgresStorage) CreateDatasetTable(tableName string, columns []string) error {
	fqTableName := fullyQualifiedTableName(tableName)

	// Build column definitions
	var colDefs []string
	colDefs = append(colDefs, "row_index INTEGER NOT NULL PRIMARY KEY")
	for _, col := range columns {
		colDefs = append(colDefs, fmt.Sprintf("%s TEXT", sanitizeColumnName(col)))
	}

	query := fmt.Sprintf("CREATE TABLE %s (%s)", fqTableName, strings.Join(colDefs, ", "))
	_, err := s.db.Exec(query)
	if err != nil {
		return fmt.Errorf("failed to create dataset table: %w", err)
	}

	return nil
}

// DropDatasetTable drops the table for a dataset
func (s *PostgresStorage) DropDatasetTable(tableName string) error {
	fqTableName := fullyQualifiedTableName(tableName)
	query := fmt.Sprintf("DROP TABLE IF EXISTS %s", fqTableName)
	_, err := s.db.Exec(query)
	if err != nil {
		return fmt.Errorf("failed to drop dataset table: %w", err)
	}
	return nil
}

// TableExists checks if a dataset's table exists
func (s *PostgresStorage) TableExists(tableName string) (bool, error) {
	var exists bool
	err := s.db.QueryRow(`
		SELECT EXISTS (
			SELECT 1 FROM information_schema.tables
			WHERE table_schema = 'dataset_data' AND table_name = $1
		)
	`, tableName).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("failed to check table existence: %w", err)
	}
	return exists, nil
}

// StoreData stores rows for a dataset, replacing any existing data
func (s *PostgresStorage) StoreData(datasetID int, tableName string, columns []string, rows [][]any) error {
	tx, err := s.db.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// Drop existing table if it exists
	fqTableName := fullyQualifiedTableName(tableName)
	_, err = tx.Exec(fmt.Sprintf("DROP TABLE IF EXISTS %s", fqTableName))
	if err != nil {
		return fmt.Errorf("failed to drop existing table: %w", err)
	}

	// Build column definitions for CREATE TABLE
	var colDefs []string
	colDefs = append(colDefs, "row_index INTEGER NOT NULL PRIMARY KEY")
	for _, col := range columns {
		colDefs = append(colDefs, fmt.Sprintf("%s TEXT", sanitizeColumnName(col)))
	}

	createQuery := fmt.Sprintf("CREATE TABLE %s (%s)", fqTableName, strings.Join(colDefs, ", "))
	_, err = tx.Exec(createQuery)
	if err != nil {
		return fmt.Errorf("failed to create dataset table: %w", err)
	}

	// Insert new data in batches
	const batchSize = 100
	for i := 0; i < len(rows); i += batchSize {
		end := i + batchSize
		if end > len(rows) {
			end = len(rows)
		}
		batch := rows[i:end]

		if err := s.insertBatch(tx, fqTableName, columns, i, batch); err != nil {
			return err
		}
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}

func (s *PostgresStorage) insertBatch(tx *sql.Tx, tableName string, columns []string, startIndex int, rows [][]any) error {
	if len(rows) == 0 {
		return nil
	}

	// Build column names for INSERT
	colNames := []string{"row_index"}
	for _, col := range columns {
		colNames = append(colNames, sanitizeColumnName(col))
	}

	// Build the INSERT statement with multiple value rows
	var valuePlaceholders []string
	var args []any
	paramIndex := 1

	for i, row := range rows {
		var placeholders []string
		placeholders = append(placeholders, fmt.Sprintf("$%d", paramIndex))
		args = append(args, startIndex+i)
		paramIndex++

		for _, val := range row {
			placeholders = append(placeholders, fmt.Sprintf("$%d", paramIndex))
			args = append(args, val)
			paramIndex++
		}
		valuePlaceholders = append(valuePlaceholders, fmt.Sprintf("(%s)", strings.Join(placeholders, ", ")))
	}

	query := fmt.Sprintf("INSERT INTO %s (%s) VALUES %s",
		tableName,
		strings.Join(colNames, ", "),
		strings.Join(valuePlaceholders, ", "))

	_, err := tx.Exec(query, args...)
	if err != nil {
		return fmt.Errorf("failed to insert rows: %w", err)
	}

	return nil
}

// AppendData appends rows to an existing dataset
func (s *PostgresStorage) AppendData(datasetID int, tableName string, rows [][]any) error {
	fqTableName := fullyQualifiedTableName(tableName)

	// Get columns
	columns, err := s.GetColumns(datasetID, tableName)
	if err != nil {
		return fmt.Errorf("failed to get columns: %w", err)
	}

	// Get current max row_index
	var maxIndex int
	err = s.db.QueryRow(fmt.Sprintf("SELECT COALESCE(MAX(row_index), -1) FROM %s", fqTableName)).Scan(&maxIndex)
	if err != nil {
		return fmt.Errorf("failed to get max row index: %w", err)
	}

	startIndex := maxIndex + 1

	tx, err := s.db.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	const batchSize = 100
	for i := 0; i < len(rows); i += batchSize {
		end := i + batchSize
		if end > len(rows) {
			end = len(rows)
		}
		batch := rows[i:end]

		if err := s.insertBatch(tx, fqTableName, columns, startIndex+i, batch); err != nil {
			return err
		}
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}

// GetData retrieves paginated data for a dataset
func (s *PostgresStorage) GetData(datasetID int, tableName string, page, pageSize int, sortColumn, sortDirection string) (*DataPage, error) {
	fqTableName := fullyQualifiedTableName(tableName)

	// Get columns
	columns, err := s.GetColumns(datasetID, tableName)
	if err != nil {
		return nil, err
	}

	// Get total count
	total, err := s.GetRowCount(tableName)
	if err != nil {
		return nil, err
	}

	// Build column select list
	var selectCols []string
	for _, col := range columns {
		selectCols = append(selectCols, sanitizeColumnName(col))
	}

	// Build ORDER BY clause
	orderClause := "row_index"
	if sortColumn != "" && sortDirection != "" {
		// Verify column exists
		columnExists := false
		for _, col := range columns {
			if col == sortColumn {
				columnExists = true
				break
			}
		}
		if columnExists {
			dir := "ASC"
			if sortDirection == "desc" {
				dir = "DESC"
			}
			orderClause = fmt.Sprintf("%s %s", sanitizeColumnName(sortColumn), dir)
		}
	}

	offset := (page - 1) * pageSize
	query := fmt.Sprintf("SELECT %s FROM %s ORDER BY %s LIMIT $1 OFFSET $2",
		strings.Join(selectCols, ", "),
		fqTableName,
		orderClause)

	dbRows, err := s.db.Query(query, pageSize, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to query data: %w", err)
	}
	defer dbRows.Close()

	var rows [][]any
	for dbRows.Next() {
		// Create a slice of interface pointers for scanning
		values := make([]any, len(columns))
		valuePtrs := make([]any, len(columns))
		for i := range values {
			valuePtrs[i] = &values[i]
		}

		if err := dbRows.Scan(valuePtrs...); err != nil {
			return nil, fmt.Errorf("failed to scan row: %w", err)
		}

		// Convert sql.NullString or other types to plain values
		row := make([]any, len(columns))
		for i, v := range values {
			if v == nil {
				row[i] = nil
			} else if b, ok := v.([]byte); ok {
				row[i] = string(b)
			} else {
				row[i] = v
			}
		}
		rows = append(rows, row)
	}

	return &DataPage{
		Columns:  columns,
		Rows:     rows,
		Total:    total,
		Page:     page,
		PageSize: pageSize,
	}, nil
}

// GetAllData retrieves all data for a dataset (for export)
func (s *PostgresStorage) GetAllData(datasetID int, tableName string) (*DataPage, error) {
	fqTableName := fullyQualifiedTableName(tableName)

	// Get columns
	columns, err := s.GetColumns(datasetID, tableName)
	if err != nil {
		return nil, err
	}

	// Get total count
	total, err := s.GetRowCount(tableName)
	if err != nil {
		return nil, err
	}

	// Build column select list
	var selectCols []string
	for _, col := range columns {
		selectCols = append(selectCols, sanitizeColumnName(col))
	}

	query := fmt.Sprintf("SELECT %s FROM %s ORDER BY row_index",
		strings.Join(selectCols, ", "),
		fqTableName)

	dbRows, err := s.db.Query(query)
	if err != nil {
		return nil, fmt.Errorf("failed to query data: %w", err)
	}
	defer dbRows.Close()

	var rows [][]any
	for dbRows.Next() {
		values := make([]any, len(columns))
		valuePtrs := make([]any, len(columns))
		for i := range values {
			valuePtrs[i] = &values[i]
		}

		if err := dbRows.Scan(valuePtrs...); err != nil {
			return nil, fmt.Errorf("failed to scan row: %w", err)
		}

		row := make([]any, len(columns))
		for i, v := range values {
			if v == nil {
				row[i] = nil
			} else if b, ok := v.([]byte); ok {
				row[i] = string(b)
			} else {
				row[i] = v
			}
		}
		rows = append(rows, row)
	}

	return &DataPage{
		Columns:  columns,
		Rows:     rows,
		Total:    total,
		Page:     1,
		PageSize: total,
	}, nil
}

// GetRowCount returns the total number of rows for a dataset
func (s *PostgresStorage) GetRowCount(tableName string) (int, error) {
	fqTableName := fullyQualifiedTableName(tableName)

	// Check if table exists first
	exists, err := s.TableExists(tableName)
	if err != nil {
		return 0, err
	}
	if !exists {
		return 0, nil
	}

	var count int
	err = s.db.QueryRow(fmt.Sprintf("SELECT COUNT(*) FROM %s", fqTableName)).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("failed to count rows: %w", err)
	}
	return count, nil
}

// DeleteData removes all data for a dataset by dropping its table
func (s *PostgresStorage) DeleteData(tableName string) error {
	return s.DropDatasetTable(tableName)
}

// GetColumns returns the column names for a dataset by querying the table schema
func (s *PostgresStorage) GetColumns(datasetID int, tableName string) ([]string, error) {
	// Query column names from information_schema, excluding row_index
	rows, err := s.db.Query(`
		SELECT column_name FROM information_schema.columns
		WHERE table_schema = 'dataset_data' AND table_name = $1 AND column_name != 'row_index'
		ORDER BY ordinal_position
	`, tableName)
	if err != nil {
		return nil, fmt.Errorf("failed to query columns: %w", err)
	}
	defer rows.Close()

	var columns []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, fmt.Errorf("failed to scan column: %w", err)
		}
		columns = append(columns, name)
	}
	return columns, nil
}
