package models

// TotalFormulaItem represents an item in the total formula (either account or group)
type TotalFormulaItem struct {
	ID          int     `json:"id"`
	Type        string  `json:"type"` // "account" or "group"
	Coefficient float64 `json:"coefficient"`
}

// TotalFormulaConfig stores the total formula configuration
type TotalFormulaConfig struct {
	IsEnabled bool               `json:"is_enabled"`
	Formula   []TotalFormulaItem `json:"formula"`
}

// UpdateTotalFormulaRequest is the request body for updating the total formula
type UpdateTotalFormulaRequest struct {
	IsEnabled bool               `json:"is_enabled"`
	Formula   []TotalFormulaItem `json:"formula"`
}
