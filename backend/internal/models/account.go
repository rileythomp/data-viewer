package models

import "time"

type Account struct {
	ID             int           `json:"id"`
	AccountName    string        `json:"account_name"`
	AccountInfo    string        `json:"account_info"`
	CurrentBalance float64       `json:"current_balance"`
	IsArchived     bool          `json:"is_archived"`
	Position       int           `json:"position"`
	GroupIDs       []int         `json:"group_ids"`
	InstitutionID  *int          `json:"institution_id"`
	IsCalculated   bool          `json:"is_calculated"`
	Formula        []FormulaItem `json:"formula,omitempty"`
	CreatedAt      time.Time     `json:"created_at"`
	UpdatedAt      time.Time     `json:"updated_at"`
}

// AccountInGroup represents an account within a specific group context
type AccountInGroup struct {
	Account
	PositionInGroup int `json:"position_in_group"`
}

type BalanceHistory struct {
	ID                  int       `json:"id"`
	AccountID           int       `json:"account_id"`
	AccountNameSnapshot string    `json:"account_name_snapshot"`
	Balance             float64   `json:"balance"`
	RecordedAt          time.Time `json:"recorded_at"`
}

type CreateAccountRequest struct {
	AccountName    string        `json:"account_name"`
	AccountInfo    string        `json:"account_info"`
	CurrentBalance float64       `json:"current_balance"`
	IsCalculated   bool          `json:"is_calculated"`
	Formula        []FormulaItem `json:"formula,omitempty"`
}

type UpdateNameRequest struct {
	AccountName string `json:"account_name"`
}

type UpdateBalanceRequest struct {
	Balance float64 `json:"balance"`
}

type UpdateInfoRequest struct {
	AccountInfo string `json:"account_info"`
}

type UpdateFormulaRequest struct {
	IsCalculated bool          `json:"is_calculated"`
	Formula      []FormulaItem `json:"formula,omitempty"`
}

type UpdatePositionsRequest struct {
	Positions []AccountPosition `json:"positions"`
}

type AccountPosition struct {
	ID       int `json:"id"`
	Position int `json:"position"`
}

type SetInstitutionRequest struct {
	InstitutionID *int `json:"institution_id"`
}
