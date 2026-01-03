package models

import "time"

type AccountGroup struct {
	ID               int       `json:"id"`
	GroupName        string    `json:"group_name"`
	GroupDescription string    `json:"group_description"`
	Color            string    `json:"color"`
	Position         int       `json:"position"`
	IsArchived       bool      `json:"is_archived"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

type AccountGroupWithAccounts struct {
	AccountGroup
	TotalBalance float64   `json:"total_balance"`
	Accounts     []Account `json:"accounts"`
}

type CreateGroupRequest struct {
	GroupName        string `json:"group_name"`
	GroupDescription string `json:"group_description"`
	Color            string `json:"color"`
}

type UpdateGroupRequest struct {
	GroupName        string `json:"group_name"`
	GroupDescription string `json:"group_description"`
	Color            string `json:"color"`
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

type UpdateAccountPositionsInGroupRequest struct {
	Positions []AccountPositionInGroup `json:"positions"`
}

type AccountPositionInGroup struct {
	ID              int `json:"id"`
	PositionInGroup int `json:"position_in_group"`
}

// ListItem represents either a group or an ungrouped account in the main list
type ListItem struct {
	Type    string                    `json:"type"` // "group" or "account"
	Group   *AccountGroupWithAccounts `json:"group,omitempty"`
	Account *Account                  `json:"account,omitempty"`
}

type GroupedAccountsResponse struct {
	Items        []ListItem `json:"items"`
	TotalBalance float64    `json:"total_balance"`
}
