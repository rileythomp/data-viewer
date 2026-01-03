package models

import "time"

type Upload struct {
	ID           int       `json:"id"`
	Name         string    `json:"name"`
	Description  string    `json:"description"`
	FileName     string    `json:"file_name"`
	FileType     string    `json:"file_type"`
	FileSize     int       `json:"file_size"`
	RowCount     int       `json:"row_count"`
	Columns      []string  `json:"columns"`
	Data         [][]any   `json:"data,omitempty"`
	Status       string    `json:"status"`
	ErrorMessage string    `json:"error_message,omitempty"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// UploadRow represents a single row of data in the normalized upload_rows table
type UploadRow struct {
	ID       int   `json:"id"`
	UploadID int   `json:"upload_id"`
	RowIndex int   `json:"row_index"`
	Data     []any `json:"data"`
}

type CreateUploadRequest struct {
	Name        string   `json:"name"`
	Description string   `json:"description"`
	FileName    string   `json:"file_name"`
	FileType    string   `json:"file_type"`
	FileSize    int      `json:"file_size"`
	Columns     []string `json:"columns"`
	Data        [][]any  `json:"data"`
}

// CreateUploadMetadataRequest is used to create upload metadata without data (for async processing)
type CreateUploadMetadataRequest struct {
	Name        string   `json:"name"`
	Description string   `json:"description"`
	FileName    string   `json:"file_name"`
	FileType    string   `json:"file_type"`
	FileSize    int      `json:"file_size"`
	Columns     []string `json:"columns"`
	Status      string   `json:"status"`
}

type UploadListResponse struct {
	Uploads  []Upload `json:"uploads"`
	Total    int      `json:"total"`
	Page     int      `json:"page"`
	PageSize int      `json:"page_size"`
}

type UploadDataResponse struct {
	Columns  []string `json:"columns"`
	Data     [][]any  `json:"data"`
	Total    int      `json:"total"`
	Page     int      `json:"page"`
	PageSize int      `json:"page_size"`
}
