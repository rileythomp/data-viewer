package datasource

import (
	"encoding/csv"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

// FolderData represents the combined data from all CSVs in a folder
type FolderData struct {
	Columns []string
	Rows    [][]any
	Files   []string // List of CSV files that were read
}

// FolderReader reads and combines CSV files from a folder
type FolderReader struct{}

// NewFolderReader creates a new folder reader
func NewFolderReader() *FolderReader {
	return &FolderReader{}
}

// ValidateFolder checks that the folder exists and contains valid CSV files
func (r *FolderReader) ValidateFolder(folderPath string) error {
	absPath, err := filepath.Abs(folderPath)
	if err != nil {
		return fmt.Errorf("invalid folder path: %w", err)
	}

	info, err := os.Stat(absPath)
	if os.IsNotExist(err) {
		return fmt.Errorf("folder does not exist: %s", absPath)
	}
	if err != nil {
		return fmt.Errorf("failed to access folder: %w", err)
	}
	if !info.IsDir() {
		return fmt.Errorf("path is not a directory: %s", absPath)
	}

	// Check for CSV files
	csvFiles, err := r.listCSVFiles(absPath)
	if err != nil {
		return err
	}
	if len(csvFiles) == 0 {
		return fmt.Errorf("folder contains no CSV files: %s", absPath)
	}

	return nil
}

// ReadFolder reads all CSV files in a folder and returns combined data
// Files are processed in alphabetical order for deterministic results
// All CSVs must have the same columns in the same order
func (r *FolderReader) ReadFolder(folderPath string) (*FolderData, error) {
	absPath, err := filepath.Abs(folderPath)
	if err != nil {
		return nil, fmt.Errorf("invalid folder path: %w", err)
	}

	csvFiles, err := r.listCSVFiles(absPath)
	if err != nil {
		return nil, err
	}
	if len(csvFiles) == 0 {
		return nil, fmt.Errorf("folder contains no CSV files: %s", absPath)
	}

	var result FolderData
	var expectedColumns []string

	for i, fileName := range csvFiles {
		filePath := filepath.Join(absPath, fileName)
		columns, rows, err := r.readCSVFile(filePath)
		if err != nil {
			return nil, fmt.Errorf("failed to read %s: %w", fileName, err)
		}

		if i == 0 {
			// First file sets the expected columns
			expectedColumns = columns
			result.Columns = columns
		} else {
			// Subsequent files must match columns exactly
			if err := r.validateColumnsMatch(expectedColumns, columns, fileName); err != nil {
				return nil, err
			}
		}

		result.Rows = append(result.Rows, rows...)
		result.Files = append(result.Files, fileName)
	}

	return &result, nil
}

// listCSVFiles returns a sorted list of CSV files in the folder
func (r *FolderReader) listCSVFiles(folderPath string) ([]string, error) {
	entries, err := os.ReadDir(folderPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read folder: %w", err)
	}

	var csvFiles []string
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		name := entry.Name()
		if strings.HasSuffix(strings.ToLower(name), ".csv") {
			csvFiles = append(csvFiles, name)
		}
	}

	// Sort alphabetically for deterministic order
	sort.Strings(csvFiles)
	return csvFiles, nil
}

// readCSVFile reads a single CSV file and returns columns and rows
func (r *FolderReader) readCSVFile(filePath string) ([]string, [][]any, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to open file: %w", err)
	}
	defer file.Close()

	reader := csv.NewReader(file)
	reader.FieldsPerRecord = -1 // Allow variable field counts (will catch in validation)

	// Read all records
	records, err := reader.ReadAll()
	if err != nil {
		return nil, nil, fmt.Errorf("failed to parse CSV: %w", err)
	}

	if len(records) == 0 {
		return nil, nil, fmt.Errorf("CSV file is empty")
	}

	// First row is headers
	headers := records[0]
	if len(headers) == 0 {
		return nil, nil, fmt.Errorf("CSV has no columns")
	}

	// Use columns in their original CSV order
	columns := headers

	// Convert remaining rows to []any
	var rows [][]any
	for i := 1; i < len(records); i++ {
		record := records[i]
		row := make([]any, len(columns))
		for j := range columns {
			if j < len(record) {
				row[j] = record[j]
			} else {
				row[j] = "" // Handle missing values
			}
		}
		rows = append(rows, row)
	}

	return columns, rows, nil
}

// validateColumnsMatch checks that two column sets are identical in order
func (r *FolderReader) validateColumnsMatch(expected, actual []string, fileName string) error {
	if len(expected) != len(actual) {
		return fmt.Errorf(
			"column mismatch in %s: expected %d columns, got %d",
			fileName, len(expected), len(actual),
		)
	}

	// Direct comparison - columns must be in the same order
	for i := range expected {
		if expected[i] != actual[i] {
			return fmt.Errorf(
				"column mismatch in %s: expected column %q at position %d, got %q",
				fileName, expected[i], i, actual[i],
			)
		}
	}

	return nil
}
