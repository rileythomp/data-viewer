package storage

// DatasetStorage defines the interface for storing and retrieving dataset data.
// Different implementations can use different storage backends (PostgreSQL, files, etc.)
// The tableName parameter is the sanitized table name derived from the dataset name.
type DatasetStorage interface {
	// StoreData stores rows for a dataset, replacing any existing data.
	// datasetID is used for storing column metadata, tableName is the target table.
	StoreData(datasetID int, tableName string, columns []string, rows [][]any) error

	// AppendData appends rows to an existing dataset
	AppendData(datasetID int, tableName string, rows [][]any) error

	// GetData retrieves paginated data for a dataset
	GetData(datasetID int, tableName string, page, pageSize int, sortColumn, sortDirection string) (*DataPage, error)

	// GetRowCount returns the total number of rows for a dataset
	GetRowCount(tableName string) (int, error)

	// DeleteData removes all data for a dataset
	DeleteData(tableName string) error

	// GetColumns returns the column names for a dataset by querying the table schema
	GetColumns(datasetID int, tableName string) ([]string, error)

	// CreateDatasetTable creates a new table for a dataset with the given columns
	CreateDatasetTable(tableName string, columns []string) error

	// DropDatasetTable drops the table for a dataset
	DropDatasetTable(tableName string) error

	// TableExists checks if a dataset's table exists
	TableExists(tableName string) (bool, error)
}

// DataPage represents a page of dataset data
type DataPage struct {
	Columns  []string
	Rows     [][]any
	Total    int
	Page     int
	PageSize int
}
