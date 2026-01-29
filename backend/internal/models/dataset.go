package models

import "time"

type Dataset struct {
	ID             int             `json:"id"`
	Name           string          `json:"name"`
	Description    string          `json:"description"`
	FolderPath     string          `json:"folder_path"`
	RowCount       int             `json:"row_count"`
	Status         string          `json:"status"` // pending, syncing, ready, error
	ErrorMessage   string          `json:"error_message,omitempty"`
	LastCommitHash string          `json:"last_commit_hash,omitempty"`
	LastSyncedAt   *time.Time      `json:"last_synced_at,omitempty"`
	Columns        []DatasetColumn `json:"columns,omitempty"`
	CreatedAt      time.Time       `json:"created_at"`
	UpdatedAt      time.Time       `json:"updated_at"`
}

type DatasetColumn struct {
	ID           int    `json:"id"`
	DatasetID    int    `json:"dataset_id"`
	Name         string `json:"name"`
	InferredType string `json:"inferred_type"`
	OverrideType string `json:"override_type,omitempty"`
	Position     int    `json:"position"`
}

type CreateDatasetRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	FolderPath  string `json:"folder_path"`
}

type DatasetListResponse struct {
	Datasets []Dataset `json:"datasets"`
	Total    int       `json:"total"`
	Page     int       `json:"page"`
	PageSize int       `json:"page_size"`
}

type DatasetDataResponse struct {
	Columns  []string `json:"columns"`
	Rows     [][]any  `json:"rows"`
	Total    int      `json:"total"`
	Page     int      `json:"page"`
	PageSize int      `json:"page_size"`
	Syncing  bool     `json:"syncing"` // True if data is currently being synced
}
