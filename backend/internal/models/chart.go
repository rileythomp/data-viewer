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
	Items        []ListItem         `json:"items"`
	TotalBalance float64            `json:"total_balance"`
	PieData      []PieChartDataItem `json:"pie_data"`
}

type CreateChartRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	AccountIDs  []int  `json:"account_ids"`
	GroupIDs    []int  `json:"group_ids"`
}

type UpdateChartRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	AccountIDs  []int  `json:"account_ids"`
	GroupIDs    []int  `json:"group_ids"`
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
