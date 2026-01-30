package repository

import (
	"database/sql"
	"encoding/json"
	"fmt"

	"finance-tracker/internal/models"
)

type DashboardRepository struct {
	db *sql.DB
}

func NewDashboardRepository(db *sql.DB) *DashboardRepository {
	return &DashboardRepository{
		db: db,
	}
}

func (r *DashboardRepository) GetAll(page, pageSize int) (*models.DashboardListResponse, error) {
	// Get total count
	var total int
	err := r.db.QueryRow("SELECT COUNT(*) FROM dashboards").Scan(&total)
	if err != nil {
		return nil, fmt.Errorf("failed to count dashboards: %w", err)
	}

	// Get paginated dashboards
	offset := (page - 1) * pageSize
	query := `
		SELECT id, name, description, position, is_main, is_calculated, formula, created_at, updated_at
		FROM dashboards
		ORDER BY position ASC, name ASC
		LIMIT $1 OFFSET $2
	`
	rows, err := r.db.Query(query, pageSize, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to query dashboards: %w", err)
	}
	defer rows.Close()

	var dashboards []models.DashboardWithItems
	for rows.Next() {
		var d models.Dashboard
		var formulaJSON []byte
		if err := rows.Scan(&d.ID, &d.Name, &d.Description, &d.Position, &d.IsMain, &d.IsCalculated, &formulaJSON, &d.CreatedAt, &d.UpdatedAt); err != nil {
			return nil, fmt.Errorf("failed to scan dashboard: %w", err)
		}
		if len(formulaJSON) > 0 {
			json.Unmarshal(formulaJSON, &d.Formula)
		}

		// Get items for this dashboard
		withItems, err := r.GetWithItems(d.ID)
		if err != nil {
			return nil, fmt.Errorf("failed to get dashboard items: %w", err)
		}
		dashboards = append(dashboards, *withItems)
	}

	return &models.DashboardListResponse{
		Dashboards: dashboards,
		Total:      total,
		Page:       page,
		PageSize:   pageSize,
	}, nil
}

func (r *DashboardRepository) GetByID(id int) (*models.Dashboard, error) {
	query := `
		SELECT id, name, description, position, is_main, is_calculated, formula, created_at, updated_at
		FROM dashboards
		WHERE id = $1
	`
	var d models.Dashboard
	var formulaJSON []byte
	err := r.db.QueryRow(query, id).Scan(&d.ID, &d.Name, &d.Description, &d.Position, &d.IsMain, &d.IsCalculated, &formulaJSON, &d.CreatedAt, &d.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get dashboard: %w", err)
	}
	if len(formulaJSON) > 0 {
		json.Unmarshal(formulaJSON, &d.Formula)
	}
	return &d, nil
}

func (r *DashboardRepository) GetWithItems(id int) (*models.DashboardWithItems, error) {
	dashboard, err := r.GetByID(id)
	if err != nil {
		return nil, err
	}
	if dashboard == nil {
		return nil, nil
	}

	// Get ALL non-archived accounts for balance resolution
	allAccountsQuery := `
		SELECT id, account_name, account_info, current_balance, is_archived, position, is_calculated, formula, created_at, updated_at
		FROM account_balances
		WHERE is_archived = false
	`
	allRows, err := r.db.Query(allAccountsQuery)
	if err != nil {
		return nil, fmt.Errorf("failed to query accounts: %w", err)
	}
	defer allRows.Close()

	var allAccounts []models.Account
	for allRows.Next() {
		var a models.Account
		var formulaJSON []byte
		err := allRows.Scan(&a.ID, &a.AccountName, &a.AccountInfo, &a.CurrentBalance, &a.IsArchived, &a.Position, &a.IsCalculated, &formulaJSON, &a.CreatedAt, &a.UpdatedAt)
		if err != nil {
			return nil, fmt.Errorf("failed to scan account: %w", err)
		}
		if len(formulaJSON) > 0 {
			json.Unmarshal(formulaJSON, &a.Formula)
		}
		a.GroupIDs = []int{}
		allAccounts = append(allAccounts, a)
	}

	// Resolve calculated account balances
	ResolveCalculatedBalances(allAccounts)

	// Build account lookup map
	accountMap := make(map[int]*models.Account)
	for i := range allAccounts {
		accountMap[allAccounts[i].ID] = &allAccounts[i]
	}

	// Get all groups with their accounts
	groupsMap, err := r.getGroupsWithAccounts(accountMap)
	if err != nil {
		return nil, fmt.Errorf("failed to get groups: %w", err)
	}

	// Get all institutions with their accounts
	institutionsMap, err := r.getInstitutionsWithAccounts(accountMap)
	if err != nil {
		return nil, fmt.Errorf("failed to get institutions: %w", err)
	}

	// Get dashboard items
	itemsQuery := `
		SELECT id, dashboard_id, item_type, item_id, position
		FROM dashboard_items
		WHERE dashboard_id = $1
		ORDER BY position ASC
	`
	itemRows, err := r.db.Query(itemsQuery, id)
	if err != nil {
		return nil, fmt.Errorf("failed to query dashboard items: %w", err)
	}
	defer itemRows.Close()

	var items []models.ListItem
	var totalBalance float64

	for itemRows.Next() {
		var di models.DashboardItem
		if err := itemRows.Scan(&di.ID, &di.DashboardID, &di.ItemType, &di.ItemID, &di.Position); err != nil {
			return nil, fmt.Errorf("failed to scan dashboard item: %w", err)
		}

		if di.ItemType == "account" {
			if acc, ok := accountMap[di.ItemID]; ok {
				items = append(items, models.ListItem{
					Type:    "account",
					Account: acc,
				})
				totalBalance += acc.CurrentBalance
			}
		} else if di.ItemType == "group" {
			if group, ok := groupsMap[di.ItemID]; ok {
				items = append(items, models.ListItem{
					Type:  "group",
					Group: group,
				})
				totalBalance += group.TotalBalance
			}
		} else if di.ItemType == "institution" {
			if institution, ok := institutionsMap[di.ItemID]; ok {
				items = append(items, models.ListItem{
					Type:        "institution",
					Institution: institution,
				})
				totalBalance += institution.TotalBalance
			}
		}
	}

	// If dashboard has a custom formula, calculate total balance from formula instead
	if dashboard.IsCalculated && len(dashboard.Formula) > 0 {
		totalBalance = 0
		for _, item := range dashboard.Formula {
			switch item.Type {
			case "account":
				if acc, ok := accountMap[item.ID]; ok {
					totalBalance += item.Coefficient * acc.CurrentBalance
				}
			case "group":
				if group, ok := groupsMap[item.ID]; ok {
					totalBalance += item.Coefficient * group.TotalBalance
				}
			case "institution":
				if institution, ok := institutionsMap[item.ID]; ok {
					totalBalance += item.Coefficient * institution.TotalBalance
				}
			}
		}
	}

	return &models.DashboardWithItems{
		Dashboard:    *dashboard,
		Items:        items,
		TotalBalance: totalBalance,
	}, nil
}

func (r *DashboardRepository) getGroupsWithAccounts(accountMap map[int]*models.Account) (map[int]*models.AccountGroupWithAccounts, error) {
	// Get all non-archived groups (excluding institutions)
	groupsQuery := `
		SELECT id, group_name, group_description, color, position, is_archived, is_calculated, formula, created_at, updated_at
		FROM account_groups
		WHERE is_archived = false AND entity_type = 'group'
	`
	groupRows, err := r.db.Query(groupsQuery)
	if err != nil {
		return nil, err
	}
	defer groupRows.Close()

	var groups []models.AccountGroup
	for groupRows.Next() {
		var g models.AccountGroup
		var formulaJSON []byte
		err := groupRows.Scan(&g.ID, &g.GroupName, &g.GroupDescription, &g.Color, &g.Position, &g.IsArchived, &g.IsCalculated, &formulaJSON, &g.CreatedAt, &g.UpdatedAt)
		if err != nil {
			return nil, err
		}
		if len(formulaJSON) > 0 {
			json.Unmarshal(formulaJSON, &g.Formula)
		}
		groups = append(groups, g)
	}

	// Get all memberships
	membershipQuery := `
		SELECT account_id, group_id, position_in_group
		FROM account_group_memberships
		ORDER BY group_id, position_in_group
	`
	membershipRows, err := r.db.Query(membershipQuery)
	if err != nil {
		return nil, err
	}
	defer membershipRows.Close()

	groupAccounts := make(map[int][]models.AccountInGroup)
	for membershipRows.Next() {
		var accountID, groupID, positionInGroup int
		if err := membershipRows.Scan(&accountID, &groupID, &positionInGroup); err != nil {
			return nil, err
		}
		if acc, ok := accountMap[accountID]; ok {
			groupAccounts[groupID] = append(groupAccounts[groupID], models.AccountInGroup{
				Account:         *acc,
				PositionInGroup: positionInGroup,
			})
		}
	}

	// Build groups with accounts and calculate balances
	result := make(map[int]*models.AccountGroupWithAccounts)
	for _, g := range groups {
		accounts := groupAccounts[g.ID]

		var totalBalance float64
		if g.IsCalculated && len(g.Formula) > 0 {
			for _, item := range g.Formula {
				if acc, ok := accountMap[item.AccountID]; ok {
					totalBalance += item.Coefficient * acc.CurrentBalance
				}
			}
		} else {
			for _, a := range accounts {
				totalBalance += a.CurrentBalance
			}
		}

		result[g.ID] = &models.AccountGroupWithAccounts{
			AccountGroup: g,
			TotalBalance: totalBalance,
			Accounts:     accounts,
		}
	}

	return result, nil
}

func (r *DashboardRepository) getInstitutionsWithAccounts(accountMap map[int]*models.Account) (map[int]*models.InstitutionWithAccounts, error) {
	// Get all non-archived institutions
	institutionsQuery := `
		SELECT id, group_name, group_description, color, position, is_archived, is_calculated, formula, created_at, updated_at
		FROM account_groups
		WHERE is_archived = false AND entity_type = 'institution'
	`
	institutionRows, err := r.db.Query(institutionsQuery)
	if err != nil {
		return nil, err
	}
	defer institutionRows.Close()

	var institutions []models.Institution
	for institutionRows.Next() {
		var i models.Institution
		var formulaJSON []byte
		err := institutionRows.Scan(&i.ID, &i.Name, &i.Description, &i.Color, &i.Position, &i.IsArchived, &i.IsCalculated, &formulaJSON, &i.CreatedAt, &i.UpdatedAt)
		if err != nil {
			return nil, err
		}
		if len(formulaJSON) > 0 {
			json.Unmarshal(formulaJSON, &i.Formula)
		}
		institutions = append(institutions, i)
	}

	// Get all institution memberships
	membershipQuery := `
		SELECT agm.account_id, agm.group_id, agm.position_in_group
		FROM account_group_memberships agm
		JOIN account_groups ag ON agm.group_id = ag.id
		WHERE ag.entity_type = 'institution'
		ORDER BY agm.group_id, agm.position_in_group
	`
	membershipRows, err := r.db.Query(membershipQuery)
	if err != nil {
		return nil, err
	}
	defer membershipRows.Close()

	institutionAccounts := make(map[int][]models.AccountInGroup)
	for membershipRows.Next() {
		var accountID, institutionID, positionInGroup int
		if err := membershipRows.Scan(&accountID, &institutionID, &positionInGroup); err != nil {
			return nil, err
		}
		if acc, ok := accountMap[accountID]; ok {
			institutionAccounts[institutionID] = append(institutionAccounts[institutionID], models.AccountInGroup{
				Account:         *acc,
				PositionInGroup: positionInGroup,
			})
		}
	}

	// Build institutions with accounts and calculate balances
	result := make(map[int]*models.InstitutionWithAccounts)
	for _, inst := range institutions {
		accounts := institutionAccounts[inst.ID]

		var totalBalance float64
		if inst.IsCalculated && len(inst.Formula) > 0 {
			for _, item := range inst.Formula {
				if acc, ok := accountMap[item.AccountID]; ok {
					totalBalance += item.Coefficient * acc.CurrentBalance
				}
			}
		} else {
			for _, a := range accounts {
				totalBalance += a.CurrentBalance
			}
		}

		result[inst.ID] = &models.InstitutionWithAccounts{
			Institution:  inst,
			TotalBalance: totalBalance,
			Accounts:     accounts,
		}
	}

	return result, nil
}

func (r *DashboardRepository) Create(req *models.CreateDashboardRequest) (*models.DashboardWithItems, error) {
	tx, err := r.db.Begin()
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// Get max position
	var maxPos sql.NullInt64
	err = tx.QueryRow("SELECT MAX(position) FROM dashboards").Scan(&maxPos)
	if err != nil {
		return nil, fmt.Errorf("failed to get max position: %w", err)
	}
	newPos := 1
	if maxPos.Valid {
		newPos = int(maxPos.Int64) + 1
	}

	// Insert dashboard
	var formulaJSON []byte
	if req.IsCalculated && len(req.Formula) > 0 {
		formulaJSON, _ = json.Marshal(req.Formula)
	}

	query := `
		INSERT INTO dashboards (name, description, position, is_calculated, formula)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, name, description, position, is_calculated, created_at, updated_at
	`
	var d models.Dashboard
	err = tx.QueryRow(query, req.Name, req.Description, newPos, req.IsCalculated, formulaJSON).Scan(
		&d.ID, &d.Name, &d.Description, &d.Position, &d.IsCalculated, &d.CreatedAt, &d.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create dashboard: %w", err)
	}

	// Insert items
	position := 0
	for _, accountID := range req.AccountIDs {
		position++
		_, err = tx.Exec(
			"INSERT INTO dashboard_items (dashboard_id, item_type, item_id, position) VALUES ($1, $2, $3, $4)",
			d.ID, "account", accountID, position,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to add account to dashboard: %w", err)
		}
	}
	for _, groupID := range req.GroupIDs {
		position++
		_, err = tx.Exec(
			"INSERT INTO dashboard_items (dashboard_id, item_type, item_id, position) VALUES ($1, $2, $3, $4)",
			d.ID, "group", groupID, position,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to add group to dashboard: %w", err)
		}
	}
	for _, institutionID := range req.InstitutionIDs {
		position++
		_, err = tx.Exec(
			"INSERT INTO dashboard_items (dashboard_id, item_type, item_id, position) VALUES ($1, $2, $3, $4)",
			d.ID, "institution", institutionID, position,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to add institution to dashboard: %w", err)
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}

	return r.GetWithItems(d.ID)
}

func (r *DashboardRepository) Update(id int, req *models.UpdateDashboardRequest) (*models.DashboardWithItems, error) {
	tx, err := r.db.Begin()
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// Prepare formula JSON
	var formulaJSON []byte
	if req.IsCalculated && len(req.Formula) > 0 {
		formulaJSON, _ = json.Marshal(req.Formula)
	}

	// Update dashboard metadata
	query := `
		UPDATE dashboards
		SET name = $1, description = $2, is_calculated = $3, formula = $4, updated_at = NOW()
		WHERE id = $5
		RETURNING id, name, description, position, is_calculated, created_at, updated_at
	`
	var d models.Dashboard
	err = tx.QueryRow(query, req.Name, req.Description, req.IsCalculated, formulaJSON, id).Scan(
		&d.ID, &d.Name, &d.Description, &d.Position, &d.IsCalculated, &d.CreatedAt, &d.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to update dashboard: %w", err)
	}

	// Delete existing items
	_, err = tx.Exec("DELETE FROM dashboard_items WHERE dashboard_id = $1", id)
	if err != nil {
		return nil, fmt.Errorf("failed to delete dashboard items: %w", err)
	}

	// Insert new items
	position := 0
	for _, accountID := range req.AccountIDs {
		position++
		_, err = tx.Exec(
			"INSERT INTO dashboard_items (dashboard_id, item_type, item_id, position) VALUES ($1, $2, $3, $4)",
			id, "account", accountID, position,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to add account to dashboard: %w", err)
		}
	}
	for _, groupID := range req.GroupIDs {
		position++
		_, err = tx.Exec(
			"INSERT INTO dashboard_items (dashboard_id, item_type, item_id, position) VALUES ($1, $2, $3, $4)",
			id, "group", groupID, position,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to add group to dashboard: %w", err)
		}
	}
	for _, institutionID := range req.InstitutionIDs {
		position++
		_, err = tx.Exec(
			"INSERT INTO dashboard_items (dashboard_id, item_type, item_id, position) VALUES ($1, $2, $3, $4)",
			id, "institution", institutionID, position,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to add institution to dashboard: %w", err)
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}

	return r.GetWithItems(id)
}

func (r *DashboardRepository) Delete(id int) error {
	result, err := r.db.Exec("DELETE FROM dashboards WHERE id = $1", id)
	if err != nil {
		return fmt.Errorf("failed to delete dashboard: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}
	if rowsAffected == 0 {
		return fmt.Errorf("dashboard not found")
	}

	return nil
}

func (r *DashboardRepository) SetMain(id int, isMain bool) error {
	tx, err := r.db.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	if isMain {
		// First, unset any existing main dashboard
		_, err = tx.Exec("UPDATE dashboards SET is_main = FALSE WHERE is_main = TRUE")
		if err != nil {
			return fmt.Errorf("failed to unset existing main dashboard: %w", err)
		}
	}

	// Set the new main dashboard status
	result, err := tx.Exec("UPDATE dashboards SET is_main = $1, updated_at = NOW() WHERE id = $2", isMain, id)
	if err != nil {
		return fmt.Errorf("failed to set main dashboard: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}
	if rowsAffected == 0 {
		return fmt.Errorf("dashboard not found")
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}

func (r *DashboardRepository) GetMain() (*models.DashboardWithItems, error) {
	query := `
		SELECT id, name, description, position, is_main, is_calculated, formula, created_at, updated_at
		FROM dashboards
		WHERE is_main = TRUE
	`
	var d models.Dashboard
	var formulaJSON []byte
	err := r.db.QueryRow(query).Scan(&d.ID, &d.Name, &d.Description, &d.Position, &d.IsMain, &d.IsCalculated, &formulaJSON, &d.CreatedAt, &d.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get main dashboard: %w", err)
	}
	if len(formulaJSON) > 0 {
		json.Unmarshal(formulaJSON, &d.Formula)
	}

	return r.GetWithItems(d.ID)
}

func (r *DashboardRepository) GetHistory(dashboardID int) ([]models.DashboardBalanceHistory, error) {
	query := `
		SELECT id, entity_type, entity_id, entity_name_snapshot, balance, recorded_at
		FROM entity_balance_history
		WHERE entity_type = 'dashboard' AND entity_id = $1
		ORDER BY recorded_at DESC
	`
	rows, err := r.db.Query(query, dashboardID)
	if err != nil {
		return nil, fmt.Errorf("failed to query dashboard history: %w", err)
	}
	defer rows.Close()

	var history []models.DashboardBalanceHistory
	for rows.Next() {
		var h models.DashboardBalanceHistory
		if err := rows.Scan(&h.ID, &h.EntityType, &h.EntityID, &h.EntityNameSnapshot, &h.Balance, &h.RecordedAt); err != nil {
			return nil, fmt.Errorf("failed to scan dashboard history: %w", err)
		}
		history = append(history, h)
	}
	return history, nil
}

func (r *DashboardRepository) UpdateItemPositions(dashboardID int, positions []models.DashboardItemPosition) error {
	tx, err := r.db.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// Verify dashboard exists
	var exists bool
	err = tx.QueryRow("SELECT EXISTS(SELECT 1 FROM dashboards WHERE id = $1)", dashboardID).Scan(&exists)
	if err != nil {
		return fmt.Errorf("failed to check dashboard existence: %w", err)
	}
	if !exists {
		return fmt.Errorf("dashboard not found")
	}

	// Update each item's position
	for _, pos := range positions {
		result, err := tx.Exec(
			"UPDATE dashboard_items SET position = $1 WHERE dashboard_id = $2 AND item_type = $3 AND item_id = $4",
			pos.Position, dashboardID, pos.ItemType, pos.ItemID,
		)
		if err != nil {
			return fmt.Errorf("failed to update item position: %w", err)
		}

		rowsAffected, err := result.RowsAffected()
		if err != nil {
			return fmt.Errorf("failed to get rows affected: %w", err)
		}
		if rowsAffected == 0 {
			return fmt.Errorf("item not found: type=%s, id=%d", pos.ItemType, pos.ItemID)
		}
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}
