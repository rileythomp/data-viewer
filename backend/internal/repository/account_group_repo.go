package repository

import (
	"database/sql"

	"finance-tracker/internal/models"
)

type AccountGroupRepository struct {
	db *sql.DB
}

func NewAccountGroupRepository(db *sql.DB) *AccountGroupRepository {
	return &AccountGroupRepository{db: db}
}

func (r *AccountGroupRepository) GetAll() ([]models.AccountGroup, error) {
	query := `
		SELECT id, group_name, group_description, color, position, is_archived, created_at, updated_at
		FROM account_groups
		WHERE is_archived = false
		ORDER BY position ASC, group_name ASC
	`
	rows, err := r.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var groups []models.AccountGroup
	for rows.Next() {
		var g models.AccountGroup
		err := rows.Scan(&g.ID, &g.GroupName, &g.GroupDescription, &g.Color, &g.Position, &g.IsArchived, &g.CreatedAt, &g.UpdatedAt)
		if err != nil {
			return nil, err
		}
		groups = append(groups, g)
	}
	return groups, rows.Err()
}

func (r *AccountGroupRepository) GetByID(id int) (*models.AccountGroup, error) {
	query := `
		SELECT id, group_name, group_description, color, position, is_archived, created_at, updated_at
		FROM account_groups
		WHERE id = $1
	`
	var g models.AccountGroup
	err := r.db.QueryRow(query, id).Scan(&g.ID, &g.GroupName, &g.GroupDescription, &g.Color, &g.Position, &g.IsArchived, &g.CreatedAt, &g.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &g, nil
}

func (r *AccountGroupRepository) GetWithAccounts(id int) (*models.AccountGroupWithAccounts, error) {
	group, err := r.GetByID(id)
	if err != nil {
		return nil, err
	}

	query := `
		SELECT id, account_name, account_info, current_balance, is_archived, position, group_id, position_in_group, created_at, updated_at
		FROM account_balances
		WHERE group_id = $1 AND is_archived = false
		ORDER BY position_in_group ASC, account_name ASC
	`
	rows, err := r.db.Query(query, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var accounts []models.Account
	var totalBalance float64
	for rows.Next() {
		var a models.Account
		var groupID sql.NullInt64
		err := rows.Scan(&a.ID, &a.AccountName, &a.AccountInfo, &a.CurrentBalance, &a.IsArchived, &a.Position, &groupID, &a.PositionInGroup, &a.CreatedAt, &a.UpdatedAt)
		if err != nil {
			return nil, err
		}
		if groupID.Valid {
			gid := int(groupID.Int64)
			a.GroupID = &gid
		}
		totalBalance += a.CurrentBalance
		accounts = append(accounts, a)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return &models.AccountGroupWithAccounts{
		AccountGroup: *group,
		TotalBalance: totalBalance,
		Accounts:     accounts,
	}, nil
}

func (r *AccountGroupRepository) Create(req *models.CreateGroupRequest) (*models.AccountGroup, error) {
	tx, err := r.db.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	// Get max position
	var maxPos sql.NullInt64
	err = tx.QueryRow("SELECT MAX(position) FROM account_groups WHERE is_archived = false").Scan(&maxPos)
	if err != nil {
		return nil, err
	}
	newPos := 1
	if maxPos.Valid {
		newPos = int(maxPos.Int64) + 1
	}

	color := req.Color
	if color == "" {
		color = "#3b82f6"
	}

	query := `
		INSERT INTO account_groups (group_name, group_description, color, position)
		VALUES ($1, $2, $3, $4)
		RETURNING id, group_name, group_description, color, position, is_archived, created_at, updated_at
	`
	var g models.AccountGroup
	err = tx.QueryRow(query, req.GroupName, req.GroupDescription, color, newPos).Scan(
		&g.ID, &g.GroupName, &g.GroupDescription, &g.Color, &g.Position, &g.IsArchived, &g.CreatedAt, &g.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return &g, nil
}

func (r *AccountGroupRepository) Update(id int, req *models.UpdateGroupRequest) (*models.AccountGroup, error) {
	query := `
		UPDATE account_groups
		SET group_name = $1, group_description = $2, color = $3, updated_at = NOW()
		WHERE id = $4
		RETURNING id, group_name, group_description, color, position, is_archived, created_at, updated_at
	`
	var g models.AccountGroup
	err := r.db.QueryRow(query, req.GroupName, req.GroupDescription, req.Color, id).Scan(
		&g.ID, &g.GroupName, &g.GroupDescription, &g.Color, &g.Position, &g.IsArchived, &g.CreatedAt, &g.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &g, nil
}

func (r *AccountGroupRepository) Archive(id int) (*models.AccountGroup, error) {
	query := `
		UPDATE account_groups
		SET is_archived = true, updated_at = NOW()
		WHERE id = $1
		RETURNING id, group_name, group_description, color, position, is_archived, created_at, updated_at
	`
	var g models.AccountGroup
	err := r.db.QueryRow(query, id).Scan(
		&g.ID, &g.GroupName, &g.GroupDescription, &g.Color, &g.Position, &g.IsArchived, &g.CreatedAt, &g.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &g, nil
}

func (r *AccountGroupRepository) UpdatePositions(positions []models.GroupPosition) error {
	tx, err := r.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	for _, p := range positions {
		if p.IsGroup {
			_, err := tx.Exec("UPDATE account_groups SET position = $1, updated_at = NOW() WHERE id = $2", p.Position, p.ID)
			if err != nil {
				return err
			}
		} else {
			_, err := tx.Exec("UPDATE account_balances SET position = $1, updated_at = NOW() WHERE id = $2", p.Position, p.ID)
			if err != nil {
				return err
			}
		}
	}

	return tx.Commit()
}

func (r *AccountGroupRepository) UpdateAccountPositionsInGroup(groupID int, positions []models.AccountPositionInGroup) error {
	tx, err := r.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	for _, p := range positions {
		_, err := tx.Exec("UPDATE account_balances SET position_in_group = $1, updated_at = NOW() WHERE id = $2 AND group_id = $3", p.PositionInGroup, p.ID, groupID)
		if err != nil {
			return err
		}
	}

	return tx.Commit()
}

func (r *AccountGroupRepository) GetGroupedList() (*models.GroupedAccountsResponse, error) {
	// Get all non-archived groups with their accounts
	groups, err := r.GetAll()
	if err != nil {
		return nil, err
	}

	// Get all non-archived, ungrouped accounts
	ungroupedQuery := `
		SELECT id, account_name, account_info, current_balance, is_archived, position, group_id, position_in_group, created_at, updated_at
		FROM account_balances
		WHERE group_id IS NULL AND is_archived = false
		ORDER BY position ASC, account_name ASC
	`
	ungroupedRows, err := r.db.Query(ungroupedQuery)
	if err != nil {
		return nil, err
	}
	defer ungroupedRows.Close()

	var ungroupedAccounts []models.Account
	for ungroupedRows.Next() {
		var a models.Account
		var groupID sql.NullInt64
		err := ungroupedRows.Scan(&a.ID, &a.AccountName, &a.AccountInfo, &a.CurrentBalance, &a.IsArchived, &a.Position, &groupID, &a.PositionInGroup, &a.CreatedAt, &a.UpdatedAt)
		if err != nil {
			return nil, err
		}
		ungroupedAccounts = append(ungroupedAccounts, a)
	}
	if err := ungroupedRows.Err(); err != nil {
		return nil, err
	}

	// Get accounts for each group
	groupsWithAccounts := make(map[int]*models.AccountGroupWithAccounts)
	for _, g := range groups {
		gwa, err := r.GetWithAccounts(g.ID)
		if err != nil {
			return nil, err
		}
		groupsWithAccounts[g.ID] = gwa
	}

	// Build the interleaved list based on position
	type positionedItem struct {
		position int
		item     models.ListItem
	}
	var items []positionedItem

	for _, g := range groups {
		gwa := groupsWithAccounts[g.ID]
		items = append(items, positionedItem{
			position: g.Position,
			item: models.ListItem{
				Type:  "group",
				Group: gwa,
			},
		})
	}

	for _, a := range ungroupedAccounts {
		acct := a
		items = append(items, positionedItem{
			position: a.Position,
			item: models.ListItem{
				Type:    "account",
				Account: &acct,
			},
		})
	}

	// Sort by position
	for i := 0; i < len(items)-1; i++ {
		for j := i + 1; j < len(items); j++ {
			if items[j].position < items[i].position {
				items[i], items[j] = items[j], items[i]
			}
		}
	}

	// Build final list and calculate total
	var finalItems []models.ListItem
	var totalBalance float64
	for _, pi := range items {
		finalItems = append(finalItems, pi.item)
		if pi.item.Type == "group" && pi.item.Group != nil {
			totalBalance += pi.item.Group.TotalBalance
		} else if pi.item.Type == "account" && pi.item.Account != nil {
			totalBalance += pi.item.Account.CurrentBalance
		}
	}

	return &models.GroupedAccountsResponse{
		Items:        finalItems,
		TotalBalance: totalBalance,
	}, nil
}
