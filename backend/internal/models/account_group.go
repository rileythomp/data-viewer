package models

import "time"

type FormulaItem struct {
	AccountID   int     `json:"account_id"`
	Coefficient float64 `json:"coefficient"`
}

type AccountGroup struct {
	ID           int           `json:"id"`
	Name         string        `json:"name"`
	Description  string        `json:"description"`
	Color        string        `json:"color"`
	Position     int           `json:"position"`
	IsArchived   bool          `json:"is_archived"`
	IsCalculated bool          `json:"is_calculated"`
	Formula      []FormulaItem `json:"formula,omitempty"`
	EntityType   string        `json:"entity_type"`
	CreatedAt    time.Time     `json:"created_at"`
	UpdatedAt    time.Time     `json:"updated_at"`
}

type AccountGroupWithAccounts struct {
	AccountGroup
	TotalBalance float64          `json:"total_balance"`
	Accounts     []AccountInGroup `json:"accounts"`
}

type CreateGroupRequest struct {
	Name         string        `json:"name"`
	Description  string        `json:"description"`
	Color        string        `json:"color"`
	IsCalculated bool          `json:"is_calculated"`
	Formula      []FormulaItem `json:"formula,omitempty"`
}

type UpdateGroupRequest struct {
	Name         string        `json:"name"`
	Description  string        `json:"description"`
	Color        string        `json:"color"`
	IsCalculated bool          `json:"is_calculated"`
	Formula      []FormulaItem `json:"formula,omitempty"`
}

type UpdateGroupPositionsRequest struct {
	Positions []GroupPosition `json:"positions"`
}

type GroupPosition struct {
	ID       int  `json:"id"`
	Position int  `json:"position"`
	IsGroup  bool `json:"is_group"`
}

type SetAccountGroupRequest struct {
	GroupID         *int `json:"group_id"`
	PositionInGroup *int `json:"position_in_group,omitempty"`
}

// ModifyGroupMembershipRequest handles add/remove/move operations
type ModifyGroupMembershipRequest struct {
	Action          string `json:"action"`                       // "add", "remove", or "move"
	GroupID         int    `json:"group_id"`                     // Target group for add/move
	SourceGroupID   *int   `json:"source_group_id,omitempty"`    // Source group for move
	PositionInGroup *int   `json:"position_in_group,omitempty"`  // Optional position
}

// SetGroupMembershipsRequest sets all group memberships at once
type SetGroupMembershipsRequest struct {
	GroupIDs []int `json:"group_ids"`
}

type UpdateAccountPositionsInGroupRequest struct {
	Positions []AccountPositionInGroup `json:"positions"`
}

type AccountPositionInGroup struct {
	ID              int `json:"id"`
	PositionInGroup int `json:"position_in_group"`
}

// ListItem represents either a group, institution, or an ungrouped account in the main list
type ListItem struct {
	Type        string                    `json:"type"` // "group", "account", or "institution"
	Group       *AccountGroupWithAccounts `json:"group,omitempty"`
	Account     *Account                  `json:"account,omitempty"`
	Institution *AccountGroupWithAccounts `json:"institution,omitempty"`
}

type GroupedAccountsResponse struct {
	Items        []ListItem `json:"items"`
	TotalBalance float64    `json:"total_balance"`
}

// GroupBalanceHistory is an alias for EntityBalanceHistory for backward compatibility
type GroupBalanceHistory = EntityBalanceHistory
