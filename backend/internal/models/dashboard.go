package models

import "time"

// DashboardFormulaItem represents an item in a dashboard formula (account, group, or institution)
type DashboardFormulaItem struct {
	ID          int     `json:"id"`
	Type        string  `json:"type"` // "account", "group", or "institution"
	Coefficient float64 `json:"coefficient"`
}

type Dashboard struct {
	ID           int                    `json:"id"`
	Name         string                 `json:"name"`
	Description  string                 `json:"description"`
	Position     int                    `json:"position"`
	IsMain       bool                   `json:"is_main"`
	IsCalculated bool                   `json:"is_calculated"`
	Formula      []DashboardFormulaItem `json:"formula,omitempty"`
	CreatedAt    time.Time              `json:"created_at"`
	UpdatedAt    time.Time              `json:"updated_at"`
}

type DashboardItem struct {
	ID          int       `json:"id"`
	DashboardID int       `json:"dashboard_id"`
	ItemType    string    `json:"item_type"` // "account", "group", or "institution"
	ItemID      int       `json:"item_id"`
	Position    int       `json:"position"`
	CreatedAt   time.Time `json:"created_at"`
}

type DashboardWithItems struct {
	Dashboard
	Items        []ListItem `json:"items"`
	TotalBalance float64    `json:"total_balance"`
}

type CreateDashboardRequest struct {
	Name           string                 `json:"name"`
	Description    string                 `json:"description"`
	AccountIDs     []int                  `json:"account_ids"`
	GroupIDs       []int                  `json:"group_ids"`
	InstitutionIDs []int                  `json:"institution_ids"`
	ChartIDs       []int                  `json:"chart_ids"`
	IsCalculated   bool                   `json:"is_calculated"`
	Formula        []DashboardFormulaItem `json:"formula,omitempty"`
}

type UpdateDashboardRequest struct {
	Name           string                 `json:"name"`
	Description    string                 `json:"description"`
	AccountIDs     []int                  `json:"account_ids"`
	GroupIDs       []int                  `json:"group_ids"`
	InstitutionIDs []int                  `json:"institution_ids"`
	ChartIDs       []int                  `json:"chart_ids"`
	IsCalculated   bool                   `json:"is_calculated"`
	Formula        []DashboardFormulaItem `json:"formula,omitempty"`
}

type DashboardListResponse struct {
	Dashboards []DashboardWithItems `json:"dashboards"`
	Total      int                  `json:"total"`
	Page       int                  `json:"page"`
	PageSize   int                  `json:"page_size"`
}

type DashboardItemPosition struct {
	ItemType string `json:"item_type"` // "account", "group", "institution", or "chart"
	ItemID   int    `json:"item_id"`
	Position int    `json:"position"`
}

type UpdateDashboardItemPositionsRequest struct {
	Positions []DashboardItemPosition `json:"positions"`
}

type DashboardBalanceHistory struct {
	ID                    int       `json:"id"`
	DashboardID           int       `json:"dashboard_id"`
	DashboardNameSnapshot string    `json:"dashboard_name_snapshot"`
	Balance               float64   `json:"balance"`
	RecordedAt            time.Time `json:"recorded_at"`
}
