package models

import "time"

type Dataset struct {
	ID           int             `json:"id"`
	Name         string          `json:"name"`
	Description  string          `json:"description"`
	RowCount     int             `json:"row_count"`
	Status       string          `json:"status"` // pending, building, ready, error
	ErrorMessage string          `json:"error_message,omitempty"`
	Sources      []DatasetSource `json:"sources,omitempty"`
	Columns      []DatasetColumn `json:"columns,omitempty"`
	CreatedAt    time.Time       `json:"created_at"`
	UpdatedAt    time.Time       `json:"updated_at"`
}

type DatasetSource struct {
	ID         int       `json:"id"`
	DatasetID  int       `json:"dataset_id"`
	SourceType string    `json:"source_type"` // upload, table, dataset
	SourceID   int       `json:"source_id"`
	SourceName string    `json:"source_name,omitempty"` // populated on read
	Position   int       `json:"position"`
	CreatedAt  time.Time `json:"created_at"`
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
	SourceIDs   []int  `json:"source_ids"` // upload IDs for Phase 1
}

type AddSourceRequest struct {
	SourceType string `json:"source_type"`
	SourceID   int    `json:"source_id"`
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
}
