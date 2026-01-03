package models

import "time"

type Upload struct {
	ID          int       `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	FileName    string    `json:"file_name"`
	FileType    string    `json:"file_type"`
	FileSize    int       `json:"file_size"`
	RowCount    int       `json:"row_count"`
	Columns     []string  `json:"columns"`
	Data        [][]any   `json:"data,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
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
