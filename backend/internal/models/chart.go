package models

import "time"

type Chart struct {
	ID          int       `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	Position    int       `json:"position"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type ChartItem struct {
	ID        int       `json:"id"`
	ChartID   int       `json:"chart_id"`
	ItemType  string    `json:"item_type"` // "account" or "group"
	ItemID    int       `json:"item_id"`
	Position  int       `json:"position"`
	CreatedAt time.Time `json:"created_at"`
}

type PieChartDataItem struct {
	Name   string  `json:"name"`
	Value  float64 `json:"value"`
	Color  string  `json:"color"`
	Type   string  `json:"type"` // "account" or "group"
	ItemID int     `json:"item_id"`
}

type ChartWithItems struct {
	Chart
	// Mode indicator
	DataSource string `json:"data_source"` // "accounts_groups" or "dataset"
	// Accounts/Groups mode data (existing)
	Items        []ListItem         `json:"items,omitempty"`
	TotalBalance float64            `json:"total_balance,omitempty"`
	PieData      []PieChartDataItem `json:"pie_data,omitempty"`
	// Dataset mode data (new)
	DatasetConfig   *ChartDatasetConfig   `json:"dataset_config,omitempty"`
	DatasetName     string                `json:"dataset_name,omitempty"`
	DatasetPieData  *DatasetPieChartData  `json:"dataset_pie_data,omitempty"`
	DatasetLineData *DatasetLineChartData `json:"dataset_line_data,omitempty"`
}

type CreateChartRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	// Mode 1: Accounts + Groups (existing)
	AccountIDs []int `json:"account_ids,omitempty"`
	GroupIDs   []int `json:"group_ids,omitempty"`
	// Mode 2: Dataset configuration (new)
	DatasetConfig *ChartDatasetConfigInput `json:"dataset_config,omitempty"`
}

type UpdateChartRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	// Mode 1: Accounts + Groups (existing)
	AccountIDs []int `json:"account_ids,omitempty"`
	GroupIDs   []int `json:"group_ids,omitempty"`
	// Mode 2: Dataset configuration (new)
	DatasetConfig *ChartDatasetConfigInput `json:"dataset_config,omitempty"`
}

type ChartListResponse struct {
	Charts   []ChartWithItems `json:"charts"`
	Total    int              `json:"total"`
	Page     int              `json:"page"`
	PageSize int              `json:"page_size"`
}

type ChartHistoryEntry struct {
	Date    string  `json:"date"`
	Balance float64 `json:"balance"`
}

type ChartHistorySeries struct {
	ID      int                 `json:"id"`
	Name    string              `json:"name"`
	Color   string              `json:"color"`
	Type    string              `json:"type"` // "account" or "group"
	History []ChartHistoryEntry `json:"history"`
}

type ChartHistoryResponse struct {
	Series []ChartHistorySeries `json:"series"`
}

// ChartDatasetConfig stores configuration for dataset-based charts
type ChartDatasetConfig struct {
	ID                  int       `json:"id"`
	ChartID             int       `json:"chart_id"`
	DatasetID           int       `json:"dataset_id"`
	ChartType           string    `json:"chart_type"` // "line" or "pie"
	XColumn             string    `json:"x_column,omitempty"`
	YColumns            []string  `json:"y_columns,omitempty"`
	AggregationField    string    `json:"aggregation_field,omitempty"`
	AggregationValue    string    `json:"aggregation_value,omitempty"`
	AggregationOperator string    `json:"aggregation_operator,omitempty"` // "SUM" or "COUNT"
	CreatedAt           time.Time `json:"created_at"`
	UpdatedAt           time.Time `json:"updated_at"`
}

// ChartDatasetConfigInput is the input structure for creating/updating dataset config
type ChartDatasetConfigInput struct {
	DatasetID           int      `json:"dataset_id"`
	ChartType           string   `json:"chart_type"` // "line" or "pie"
	XColumn             string   `json:"x_column,omitempty"`
	YColumns            []string `json:"y_columns,omitempty"`
	AggregationField    string   `json:"aggregation_field,omitempty"`
	AggregationValue    string   `json:"aggregation_value,omitempty"`
	AggregationOperator string   `json:"aggregation_operator,omitempty"`
}

// DatasetPieChartData represents data for rendering a dataset pie chart
type DatasetPieChartData struct {
	Items []DatasetPieChartItem `json:"items"`
	Total float64               `json:"total"`
}

type DatasetPieChartItem struct {
	Label string  `json:"label"`
	Value float64 `json:"value"`
	Color string  `json:"color"`
}

// DatasetLineChartData represents data for rendering a dataset line chart
type DatasetLineChartData struct {
	XValues []string                 `json:"x_values"`
	Series  []DatasetLineChartSeries `json:"series"`
}

type DatasetLineChartSeries struct {
	Column string    `json:"column"`
	Color  string    `json:"color"`
	Values []float64 `json:"values"`
}
