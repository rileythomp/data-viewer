package repository

import (
	"database/sql"
	"encoding/json"
	"fmt"

	"finance-tracker/internal/models"
)

type AccountGroupRepository struct {
	db           *sql.DB
	settingsRepo *SettingsRepository
}

func NewAccountGroupRepository(db *sql.DB) *AccountGroupRepository {
	return &AccountGroupRepository{
		db:           db,
		settingsRepo: NewSettingsRepository(db),
	}
}

func (r *AccountGroupRepository) GetAll() ([]models.AccountGroup, error) {
	query := `
		SELECT id, group_name, group_description, color, position, is_archived, is_calculated, formula, entity_type, created_at, updated_at
		FROM account_groups
		WHERE is_archived = false AND entity_type = 'group'
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
		var formulaJSON []byte
		err := rows.Scan(&g.ID, &g.GroupName, &g.GroupDescription, &g.Color, &g.Position, &g.IsArchived, &g.IsCalculated, &formulaJSON, &g.EntityType, &g.CreatedAt, &g.UpdatedAt)
		if err != nil {
			return nil, err
		}
		if len(formulaJSON) > 0 {
			json.Unmarshal(formulaJSON, &g.Formula)
		}
		groups = append(groups, g)
	}
	return groups, rows.Err()
}

func (r *AccountGroupRepository) GetByID(id int) (*models.AccountGroup, error) {
	query := `
		SELECT id, group_name, group_description, color, position, is_archived, is_calculated, formula, entity_type, created_at, updated_at
		FROM account_groups
		WHERE id = $1
	`
	var g models.AccountGroup
	var formulaJSON []byte
	err := r.db.QueryRow(query, id).Scan(&g.ID, &g.GroupName, &g.GroupDescription, &g.Color, &g.Position, &g.IsArchived, &g.IsCalculated, &formulaJSON, &g.EntityType, &g.CreatedAt, &g.UpdatedAt)
	if err != nil {
		return nil, err
	}
	if len(formulaJSON) > 0 {
		json.Unmarshal(formulaJSON, &g.Formula)
	}
	return &g, nil
}

func (r *AccountGroupRepository) GetWithAccounts(id int) (*models.AccountGroupWithAccounts, error) {
	group, err := r.GetByID(id)
	if err != nil {
		return nil, err
	}

	// Get ALL accounts to resolve formula dependencies
	allAccountsQuery := `
		SELECT id, account_name, account_info, current_balance, is_archived, position, is_calculated, formula, created_at, updated_at
		FROM account_balances
		WHERE is_archived = false
	`
	allRows, err := r.db.Query(allAccountsQuery)
	if err != nil {
		return nil, err
	}
	defer allRows.Close()

	var allAccounts []models.Account
	for allRows.Next() {
		var a models.Account
		var formulaJSON []byte
		err := allRows.Scan(&a.ID, &a.AccountName, &a.AccountInfo, &a.CurrentBalance, &a.IsArchived, &a.Position, &a.IsCalculated, &formulaJSON, &a.CreatedAt, &a.UpdatedAt)
		if err != nil {
			return nil, err
		}
		if len(formulaJSON) > 0 {
			json.Unmarshal(formulaJSON, &a.Formula)
		}
		a.GroupIDs = []int{}
		allAccounts = append(allAccounts, a)
	}
	if err := allRows.Err(); err != nil {
		return nil, err
	}

	// Resolve calculated account balances
	ResolveCalculatedBalances(allAccounts)

	// Build account lookup map
	accountMap := make(map[int]*models.Account)
	for i := range allAccounts {
		accountMap[allAccounts[i].ID] = &allAccounts[i]
	}

	// Get accounts in this group via join table
	membershipQuery := `
		SELECT agm.account_id, agm.position_in_group
		FROM account_group_memberships agm
		JOIN account_balances ab ON agm.account_id = ab.id
		WHERE agm.group_id = $1 AND ab.is_archived = false
		ORDER BY agm.position_in_group ASC
	`
	membershipRows, err := r.db.Query(membershipQuery, id)
	if err != nil {
		return nil, err
	}
	defer membershipRows.Close()

	var accounts []models.AccountInGroup
	for membershipRows.Next() {
		var accountID, positionInGroup int
		if err := membershipRows.Scan(&accountID, &positionInGroup); err != nil {
			return nil, err
		}
		if acc, ok := accountMap[accountID]; ok {
			accounts = append(accounts, models.AccountInGroup{
				Account:         *acc,
				PositionInGroup: positionInGroup,
			})
		}
	}

	// Calculate total balance
	var totalBalance float64
	if group.IsCalculated && len(group.Formula) > 0 {
		// Calculate formula-based balance using resolved account values
		for _, item := range group.Formula {
			if acc, ok := accountMap[item.AccountID]; ok {
				totalBalance += item.Coefficient * acc.CurrentBalance
			}
		}
	} else {
		// Default: sum all account balances in this group
		for _, a := range accounts {
			totalBalance += a.CurrentBalance
		}
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

	var formulaJSON interface{}
	if req.IsCalculated && len(req.Formula) > 0 {
		formulaJSON, err = json.Marshal(req.Formula)
		if err != nil {
			return nil, err
		}
	}

	query := `
		INSERT INTO account_groups (group_name, group_description, color, position, is_calculated, formula, entity_type)
		VALUES ($1, $2, $3, $4, $5, $6, 'group')
		RETURNING id, group_name, group_description, color, position, is_archived, is_calculated, formula, entity_type, created_at, updated_at
	`
	var g models.AccountGroup
	var returnedFormula []byte
	err = tx.QueryRow(query, req.GroupName, req.GroupDescription, color, newPos, req.IsCalculated, formulaJSON).Scan(
		&g.ID, &g.GroupName, &g.GroupDescription, &g.Color, &g.Position, &g.IsArchived, &g.IsCalculated, &returnedFormula, &g.EntityType, &g.CreatedAt, &g.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	if len(returnedFormula) > 0 {
		json.Unmarshal(returnedFormula, &g.Formula)
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return &g, nil
}

func (r *AccountGroupRepository) Update(id int, req *models.UpdateGroupRequest) (*models.AccountGroup, error) {
	var formulaJSON interface{}
	var err error
	if req.IsCalculated && len(req.Formula) > 0 {
		formulaJSON, err = json.Marshal(req.Formula)
		if err != nil {
			return nil, err
		}
	}

	query := `
		UPDATE account_groups
		SET group_name = $1, group_description = $2, color = $3, is_calculated = $4, formula = $5, updated_at = NOW()
		WHERE id = $6
		RETURNING id, group_name, group_description, color, position, is_archived, is_calculated, formula, entity_type, created_at, updated_at
	`
	var g models.AccountGroup
	var returnedFormula []byte
	err = r.db.QueryRow(query, req.GroupName, req.GroupDescription, req.Color, req.IsCalculated, formulaJSON, id).Scan(
		&g.ID, &g.GroupName, &g.GroupDescription, &g.Color, &g.Position, &g.IsArchived, &g.IsCalculated, &returnedFormula, &g.EntityType, &g.CreatedAt, &g.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	if len(returnedFormula) > 0 {
		json.Unmarshal(returnedFormula, &g.Formula)
	}
	return &g, nil
}

func (r *AccountGroupRepository) Archive(id int) (*models.AccountGroup, error) {
	query := `
		UPDATE account_groups
		SET is_archived = true, updated_at = NOW()
		WHERE id = $1
		RETURNING id, group_name, group_description, color, position, is_archived, is_calculated, formula, entity_type, created_at, updated_at
	`
	var g models.AccountGroup
	var formulaJSON []byte
	err := r.db.QueryRow(query, id).Scan(
		&g.ID, &g.GroupName, &g.GroupDescription, &g.Color, &g.Position, &g.IsArchived, &g.IsCalculated, &formulaJSON, &g.EntityType, &g.CreatedAt, &g.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	if len(formulaJSON) > 0 {
		json.Unmarshal(formulaJSON, &g.Formula)
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
		_, err := tx.Exec("UPDATE account_group_memberships SET position_in_group = $1 WHERE account_id = $2 AND group_id = $3", p.PositionInGroup, p.ID, groupID)
		if err != nil {
			return err
		}
	}

	return tx.Commit()
}

func (r *AccountGroupRepository) GetGroupedList() (*models.GroupedAccountsResponse, error) {
	// Get all non-archived groups
	groups, err := r.GetAll()
	if err != nil {
		return nil, err
	}

	// Get ALL non-archived accounts
	allAccountsQuery := `
		SELECT id, account_name, account_info, current_balance, is_archived, position, is_calculated, formula, created_at, updated_at
		FROM account_balances
		WHERE is_archived = false
		ORDER BY position ASC, account_name ASC
	`
	allRows, err := r.db.Query(allAccountsQuery)
	if err != nil {
		return nil, err
	}
	defer allRows.Close()

	var allAccounts []models.Account
	for allRows.Next() {
		var a models.Account
		var formulaJSON []byte
		err := allRows.Scan(&a.ID, &a.AccountName, &a.AccountInfo, &a.CurrentBalance, &a.IsArchived, &a.Position, &a.IsCalculated, &formulaJSON, &a.CreatedAt, &a.UpdatedAt)
		if err != nil {
			return nil, err
		}
		if len(formulaJSON) > 0 {
			json.Unmarshal(formulaJSON, &a.Formula)
		}
		a.GroupIDs = []int{}
		allAccounts = append(allAccounts, a)
	}
	if err := allRows.Err(); err != nil {
		return nil, err
	}

	// Resolve calculated account balances
	ResolveCalculatedBalances(allAccounts)

	// Build account lookup map
	accountMap := make(map[int]*models.Account)
	for i := range allAccounts {
		accountMap[allAccounts[i].ID] = &allAccounts[i]
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

	// Build membership maps
	accountGroups := make(map[int][]int)                           // account_id -> list of group_ids
	groupAccounts := make(map[int][]models.AccountInGroup)         // group_id -> list of accounts with positions

	for membershipRows.Next() {
		var accountID, groupID, positionInGroup int
		if err := membershipRows.Scan(&accountID, &groupID, &positionInGroup); err != nil {
			return nil, err
		}
		accountGroups[accountID] = append(accountGroups[accountID], groupID)
		if acc, ok := accountMap[accountID]; ok {
			groupAccounts[groupID] = append(groupAccounts[groupID], models.AccountInGroup{
				Account:         *acc,
				PositionInGroup: positionInGroup,
			})
		}
	}

	// Update accounts with their group IDs
	for i := range allAccounts {
		if gids, ok := accountGroups[allAccounts[i].ID]; ok {
			allAccounts[i].GroupIDs = gids
			accountMap[allAccounts[i].ID].GroupIDs = gids
		}
	}

	// Identify ungrouped accounts (those with no memberships)
	var ungroupedAccounts []models.Account
	for _, a := range allAccounts {
		if len(a.GroupIDs) == 0 {
			ungroupedAccounts = append(ungroupedAccounts, a)
		}
	}

	// Build groups with their accounts using resolved balances
	groupsWithAccounts := make(map[int]*models.AccountGroupWithAccounts)
	for _, g := range groups {
		accounts := groupAccounts[g.ID]

		// Calculate group total balance
		var totalBalance float64
		if g.IsCalculated && len(g.Formula) > 0 {
			// Formula-based group: calculate from formula
			for _, item := range g.Formula {
				if acc, ok := accountMap[item.AccountID]; ok {
					totalBalance += item.Coefficient * acc.CurrentBalance
				}
			}
		} else {
			// Regular group: sum account balances
			for _, a := range accounts {
				totalBalance += a.CurrentBalance
			}
		}

		groupsWithAccounts[g.ID] = &models.AccountGroupWithAccounts{
			AccountGroup: g,
			TotalBalance: totalBalance,
			Accounts:     accounts,
		}
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

	// Build final list
	var finalItems []models.ListItem
	for _, pi := range items {
		finalItems = append(finalItems, pi.item)
	}

	// Get total formula config
	totalFormulaConfig, err := r.settingsRepo.GetTotalFormula()
	if err != nil {
		return nil, err
	}

	// Calculate total balance
	var totalBalance float64
	if totalFormulaConfig.IsEnabled && len(totalFormulaConfig.Formula) > 0 {
		// Use custom formula
		totalBalance = r.calculateFormulaTotal(totalFormulaConfig.Formula, accountMap, groupsWithAccounts)
	} else {
		// Default: sum all groups and ungrouped accounts
		for _, pi := range items {
			if pi.item.Type == "group" && pi.item.Group != nil {
				totalBalance += pi.item.Group.TotalBalance
			} else if pi.item.Type == "account" && pi.item.Account != nil {
				totalBalance += pi.item.Account.CurrentBalance
			}
		}
	}

	return &models.GroupedAccountsResponse{
		Items:              finalItems,
		TotalBalance:       totalBalance,
		TotalFormulaConfig: totalFormulaConfig,
	}, nil
}

// calculateFormulaTotal calculates the total balance using the custom formula
func (r *AccountGroupRepository) calculateFormulaTotal(
	formula []models.TotalFormulaItem,
	accountMap map[int]*models.Account,
	groupsWithAccounts map[int]*models.AccountGroupWithAccounts,
) float64 {
	var total float64
	for _, item := range formula {
		if item.Type == "account" {
			if acc, ok := accountMap[item.ID]; ok {
				total += item.Coefficient * acc.CurrentBalance
			}
		} else if item.Type == "group" {
			if group, ok := groupsWithAccounts[item.ID]; ok {
				total += item.Coefficient * group.TotalBalance
			}
		}
	}
	return total
}

func (r *AccountGroupRepository) GetAllIncludingArchived() ([]models.AccountGroup, error) {
	query := `
		SELECT id, group_name, group_description, color, position, is_archived, is_calculated, formula, entity_type, created_at, updated_at
		FROM account_groups
		WHERE entity_type = 'group'
		ORDER BY group_name ASC
	`
	rows, err := r.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var groups []models.AccountGroup
	for rows.Next() {
		var g models.AccountGroup
		var formulaJSON []byte
		err := rows.Scan(&g.ID, &g.GroupName, &g.GroupDescription, &g.Color, &g.Position, &g.IsArchived, &g.IsCalculated, &formulaJSON, &g.EntityType, &g.CreatedAt, &g.UpdatedAt)
		if err != nil {
			return nil, err
		}
		if len(formulaJSON) > 0 {
			json.Unmarshal(formulaJSON, &g.Formula)
		}
		groups = append(groups, g)
	}
	return groups, rows.Err()
}

func (r *AccountGroupRepository) Unarchive(id int) (*models.AccountGroup, error) {
	query := `
		UPDATE account_groups
		SET is_archived = false, updated_at = NOW()
		WHERE id = $1
		RETURNING id, group_name, group_description, color, position, is_archived, is_calculated, formula, entity_type, created_at, updated_at
	`
	var g models.AccountGroup
	var formulaJSON []byte
	err := r.db.QueryRow(query, id).Scan(
		&g.ID, &g.GroupName, &g.GroupDescription, &g.Color, &g.Position, &g.IsArchived, &g.IsCalculated, &formulaJSON, &g.EntityType, &g.CreatedAt, &g.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	if len(formulaJSON) > 0 {
		json.Unmarshal(formulaJSON, &g.Formula)
	}
	return &g, nil
}

func (r *AccountGroupRepository) Delete(id int) error {
	tx, err := r.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// Delete from account_group_memberships (accounts become ungrouped)
	_, err = tx.Exec("DELETE FROM account_group_memberships WHERE group_id = $1", id)
	if err != nil {
		return err
	}

	// Delete the group
	result, err := tx.Exec("DELETE FROM account_groups WHERE id = $1", id)
	if err != nil {
		return err
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rowsAffected == 0 {
		return fmt.Errorf("group not found")
	}

	return tx.Commit()
}

func (r *AccountGroupRepository) GetHistory(groupID int) ([]models.GroupBalanceHistory, error) {
	query := `
		SELECT id, group_id, group_name_snapshot, balance, recorded_at
		FROM group_balance_history
		WHERE group_id = $1
		ORDER BY recorded_at DESC
	`
	rows, err := r.db.Query(query, groupID)
	if err != nil {
		return nil, fmt.Errorf("failed to query group history: %w", err)
	}
	defer rows.Close()

	var history []models.GroupBalanceHistory
	for rows.Next() {
		var h models.GroupBalanceHistory
		if err := rows.Scan(&h.ID, &h.GroupID, &h.GroupNameSnapshot, &h.Balance, &h.RecordedAt); err != nil {
			return nil, fmt.Errorf("failed to scan group history: %w", err)
		}
		history = append(history, h)
	}
	return history, nil
}

// Institution methods - institutions are stored in account_groups with entity_type = 'institution'

func (r *AccountGroupRepository) GetAllInstitutions() ([]models.InstitutionWithAccounts, error) {
	query := `
		SELECT id, group_name, group_description, color, position, is_archived, is_calculated, formula, created_at, updated_at
		FROM account_groups
		WHERE is_archived = false AND entity_type = 'institution'
		ORDER BY position ASC, group_name ASC
	`
	rows, err := r.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var institutions []models.Institution
	for rows.Next() {
		var i models.Institution
		var formulaJSON []byte
		err := rows.Scan(&i.ID, &i.Name, &i.Description, &i.Color, &i.Position, &i.IsArchived, &i.IsCalculated, &formulaJSON, &i.CreatedAt, &i.UpdatedAt)
		if err != nil {
			return nil, err
		}
		if len(formulaJSON) > 0 {
			json.Unmarshal(formulaJSON, &i.Formula)
		}
		institutions = append(institutions, i)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	// Get all accounts with full details
	allAccountsQuery := `
		SELECT id, account_name, account_info, current_balance, is_archived, position, is_calculated, formula, created_at, updated_at
		FROM account_balances
		WHERE is_archived = false
	`
	accountRows, err := r.db.Query(allAccountsQuery)
	if err != nil {
		return nil, err
	}
	defer accountRows.Close()

	var allAccounts []models.Account
	for accountRows.Next() {
		var a models.Account
		var formulaJSON []byte
		err := accountRows.Scan(&a.ID, &a.AccountName, &a.AccountInfo, &a.CurrentBalance, &a.IsArchived, &a.Position, &a.IsCalculated, &formulaJSON, &a.CreatedAt, &a.UpdatedAt)
		if err != nil {
			return nil, err
		}
		if len(formulaJSON) > 0 {
			json.Unmarshal(formulaJSON, &a.Formula)
		}
		a.GroupIDs = []int{}
		allAccounts = append(allAccounts, a)
	}
	if err := accountRows.Err(); err != nil {
		return nil, err
	}

	// Resolve calculated account balances
	ResolveCalculatedBalances(allAccounts)

	// Build account lookup map (full account objects)
	accountMap := make(map[int]*models.Account)
	for i := range allAccounts {
		accountMap[allAccounts[i].ID] = &allAccounts[i]
	}

	// Get all institution memberships with position
	membershipQuery := `
		SELECT agm.group_id, agm.account_id, agm.position_in_group
		FROM account_group_memberships agm
		JOIN account_groups ag ON agm.group_id = ag.id
		JOIN account_balances ab ON agm.account_id = ab.id
		WHERE ag.entity_type = 'institution' AND ag.is_archived = false AND ab.is_archived = false
		ORDER BY agm.group_id, agm.position_in_group ASC
	`
	membershipRows, err := r.db.Query(membershipQuery)
	if err != nil {
		return nil, err
	}
	defer membershipRows.Close()

	// Map institution ID -> list of AccountInGroup
	institutionAccounts := make(map[int][]models.AccountInGroup)
	for membershipRows.Next() {
		var groupID, accountID, positionInGroup int
		if err := membershipRows.Scan(&groupID, &accountID, &positionInGroup); err != nil {
			return nil, err
		}
		if acc, ok := accountMap[accountID]; ok {
			institutionAccounts[groupID] = append(institutionAccounts[groupID], models.AccountInGroup{
				Account:         *acc,
				PositionInGroup: positionInGroup,
			})
		}
	}
	if err := membershipRows.Err(); err != nil {
		return nil, err
	}

	// Build result with accounts and total balances
	var result []models.InstitutionWithAccounts
	for _, inst := range institutions {
		var totalBalance float64
		if inst.IsCalculated && len(inst.Formula) > 0 {
			// Use formula to calculate balance
			for _, item := range inst.Formula {
				if acc, ok := accountMap[item.AccountID]; ok {
					totalBalance += acc.CurrentBalance * item.Coefficient
				}
			}
		} else {
			// Sum balances of member accounts
			for _, accInGroup := range institutionAccounts[inst.ID] {
				totalBalance += accInGroup.CurrentBalance
			}
		}

		accounts := institutionAccounts[inst.ID]
		if accounts == nil {
			accounts = []models.AccountInGroup{}
		}

		result = append(result, models.InstitutionWithAccounts{
			Institution:  inst,
			TotalBalance: totalBalance,
			Accounts:     accounts,
		})
	}

	return result, nil
}

func (r *AccountGroupRepository) GetAllInstitutionsIncludingArchived() ([]models.Institution, error) {
	query := `
		SELECT id, group_name, group_description, color, position, is_archived, is_calculated, formula, created_at, updated_at
		FROM account_groups
		WHERE entity_type = 'institution'
		ORDER BY group_name ASC
	`
	rows, err := r.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var institutions []models.Institution
	for rows.Next() {
		var i models.Institution
		var formulaJSON []byte
		err := rows.Scan(&i.ID, &i.Name, &i.Description, &i.Color, &i.Position, &i.IsArchived, &i.IsCalculated, &formulaJSON, &i.CreatedAt, &i.UpdatedAt)
		if err != nil {
			return nil, err
		}
		if len(formulaJSON) > 0 {
			json.Unmarshal(formulaJSON, &i.Formula)
		}
		institutions = append(institutions, i)
	}
	return institutions, rows.Err()
}

func (r *AccountGroupRepository) GetInstitutionByID(id int) (*models.Institution, error) {
	query := `
		SELECT id, group_name, group_description, color, position, is_archived, is_calculated, formula, created_at, updated_at
		FROM account_groups
		WHERE id = $1 AND entity_type = 'institution'
	`
	var i models.Institution
	var formulaJSON []byte
	err := r.db.QueryRow(query, id).Scan(&i.ID, &i.Name, &i.Description, &i.Color, &i.Position, &i.IsArchived, &i.IsCalculated, &formulaJSON, &i.CreatedAt, &i.UpdatedAt)
	if err != nil {
		return nil, err
	}
	if len(formulaJSON) > 0 {
		json.Unmarshal(formulaJSON, &i.Formula)
	}
	return &i, nil
}

func (r *AccountGroupRepository) GetInstitutionWithAccounts(id int) (*models.InstitutionWithAccounts, error) {
	institution, err := r.GetInstitutionByID(id)
	if err != nil {
		return nil, err
	}

	// Get ALL accounts to resolve formula dependencies
	allAccountsQuery := `
		SELECT id, account_name, account_info, current_balance, is_archived, position, is_calculated, formula, created_at, updated_at
		FROM account_balances
		WHERE is_archived = false
	`
	allRows, err := r.db.Query(allAccountsQuery)
	if err != nil {
		return nil, err
	}
	defer allRows.Close()

	var allAccounts []models.Account
	for allRows.Next() {
		var a models.Account
		var formulaJSON []byte
		err := allRows.Scan(&a.ID, &a.AccountName, &a.AccountInfo, &a.CurrentBalance, &a.IsArchived, &a.Position, &a.IsCalculated, &formulaJSON, &a.CreatedAt, &a.UpdatedAt)
		if err != nil {
			return nil, err
		}
		if len(formulaJSON) > 0 {
			json.Unmarshal(formulaJSON, &a.Formula)
		}
		a.GroupIDs = []int{}
		allAccounts = append(allAccounts, a)
	}
	if err := allRows.Err(); err != nil {
		return nil, err
	}

	// Resolve calculated account balances
	ResolveCalculatedBalances(allAccounts)

	// Build account lookup map
	accountMap := make(map[int]*models.Account)
	for i := range allAccounts {
		accountMap[allAccounts[i].ID] = &allAccounts[i]
	}

	// Get accounts in this institution via join table
	membershipQuery := `
		SELECT agm.account_id, agm.position_in_group
		FROM account_group_memberships agm
		JOIN account_balances ab ON agm.account_id = ab.id
		WHERE agm.group_id = $1 AND ab.is_archived = false
		ORDER BY agm.position_in_group ASC
	`
	membershipRows, err := r.db.Query(membershipQuery, id)
	if err != nil {
		return nil, err
	}
	defer membershipRows.Close()

	var accounts []models.AccountInGroup
	for membershipRows.Next() {
		var accountID, positionInGroup int
		if err := membershipRows.Scan(&accountID, &positionInGroup); err != nil {
			return nil, err
		}
		if acc, ok := accountMap[accountID]; ok {
			accounts = append(accounts, models.AccountInGroup{
				Account:         *acc,
				PositionInGroup: positionInGroup,
			})
		}
	}

	// Calculate total balance
	var totalBalance float64
	if institution.IsCalculated && len(institution.Formula) > 0 {
		// Calculate formula-based balance using resolved account values
		for _, item := range institution.Formula {
			if acc, ok := accountMap[item.AccountID]; ok {
				totalBalance += item.Coefficient * acc.CurrentBalance
			}
		}
	} else {
		// Default: sum all account balances in this institution
		for _, a := range accounts {
			totalBalance += a.CurrentBalance
		}
	}

	return &models.InstitutionWithAccounts{
		Institution:  *institution,
		TotalBalance: totalBalance,
		Accounts:     accounts,
	}, nil
}

func (r *AccountGroupRepository) CreateInstitution(req *models.CreateInstitutionRequest) (*models.Institution, error) {
	tx, err := r.db.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	// Get max position for institutions
	var maxPos sql.NullInt64
	err = tx.QueryRow("SELECT MAX(position) FROM account_groups WHERE is_archived = false AND entity_type = 'institution'").Scan(&maxPos)
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

	var formulaJSON interface{}
	if req.IsCalculated && len(req.Formula) > 0 {
		formulaJSON, err = json.Marshal(req.Formula)
		if err != nil {
			return nil, err
		}
	}

	query := `
		INSERT INTO account_groups (group_name, group_description, color, position, is_calculated, formula, entity_type)
		VALUES ($1, $2, $3, $4, $5, $6, 'institution')
		RETURNING id, group_name, group_description, color, position, is_archived, is_calculated, formula, created_at, updated_at
	`
	var i models.Institution
	var returnedFormula []byte
	err = tx.QueryRow(query, req.Name, req.Description, color, newPos, req.IsCalculated, formulaJSON).Scan(
		&i.ID, &i.Name, &i.Description, &i.Color, &i.Position, &i.IsArchived, &i.IsCalculated, &returnedFormula, &i.CreatedAt, &i.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	if len(returnedFormula) > 0 {
		json.Unmarshal(returnedFormula, &i.Formula)
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return &i, nil
}

func (r *AccountGroupRepository) UpdateInstitution(id int, req *models.UpdateInstitutionRequest) (*models.Institution, error) {
	var formulaJSON interface{}
	var err error
	if req.IsCalculated && len(req.Formula) > 0 {
		formulaJSON, err = json.Marshal(req.Formula)
		if err != nil {
			return nil, err
		}
	}

	query := `
		UPDATE account_groups
		SET group_name = $1, group_description = $2, color = $3, is_calculated = $4, formula = $5, updated_at = NOW()
		WHERE id = $6 AND entity_type = 'institution'
		RETURNING id, group_name, group_description, color, position, is_archived, is_calculated, formula, created_at, updated_at
	`
	var i models.Institution
	var returnedFormula []byte
	err = r.db.QueryRow(query, req.Name, req.Description, req.Color, req.IsCalculated, formulaJSON, id).Scan(
		&i.ID, &i.Name, &i.Description, &i.Color, &i.Position, &i.IsArchived, &i.IsCalculated, &returnedFormula, &i.CreatedAt, &i.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	if len(returnedFormula) > 0 {
		json.Unmarshal(returnedFormula, &i.Formula)
	}
	return &i, nil
}

func (r *AccountGroupRepository) ArchiveInstitution(id int) (*models.Institution, error) {
	query := `
		UPDATE account_groups
		SET is_archived = true, updated_at = NOW()
		WHERE id = $1 AND entity_type = 'institution'
		RETURNING id, group_name, group_description, color, position, is_archived, is_calculated, formula, created_at, updated_at
	`
	var i models.Institution
	var formulaJSON []byte
	err := r.db.QueryRow(query, id).Scan(
		&i.ID, &i.Name, &i.Description, &i.Color, &i.Position, &i.IsArchived, &i.IsCalculated, &formulaJSON, &i.CreatedAt, &i.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	if len(formulaJSON) > 0 {
		json.Unmarshal(formulaJSON, &i.Formula)
	}
	return &i, nil
}

func (r *AccountGroupRepository) UnarchiveInstitution(id int) (*models.Institution, error) {
	query := `
		UPDATE account_groups
		SET is_archived = false, updated_at = NOW()
		WHERE id = $1 AND entity_type = 'institution'
		RETURNING id, group_name, group_description, color, position, is_archived, is_calculated, formula, created_at, updated_at
	`
	var i models.Institution
	var formulaJSON []byte
	err := r.db.QueryRow(query, id).Scan(
		&i.ID, &i.Name, &i.Description, &i.Color, &i.Position, &i.IsArchived, &i.IsCalculated, &formulaJSON, &i.CreatedAt, &i.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	if len(formulaJSON) > 0 {
		json.Unmarshal(formulaJSON, &i.Formula)
	}
	return &i, nil
}

func (r *AccountGroupRepository) DeleteInstitution(id int) error {
	tx, err := r.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// Delete from account_group_memberships (accounts become unassigned from institution)
	_, err = tx.Exec("DELETE FROM account_group_memberships WHERE group_id = $1", id)
	if err != nil {
		return err
	}

	// Delete the institution
	result, err := tx.Exec("DELETE FROM account_groups WHERE id = $1 AND entity_type = 'institution'", id)
	if err != nil {
		return err
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rowsAffected == 0 {
		return fmt.Errorf("institution not found")
	}

	return tx.Commit()
}

func (r *AccountGroupRepository) UpdateAccountPositionsInInstitution(institutionID int, positions []models.AccountPositionInGroup) error {
	tx, err := r.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	for _, p := range positions {
		_, err := tx.Exec("UPDATE account_group_memberships SET position_in_group = $1 WHERE account_id = $2 AND group_id = $3", p.PositionInGroup, p.ID, institutionID)
		if err != nil {
			return err
		}
	}

	return tx.Commit()
}

func (r *AccountGroupRepository) GetInstitutionHistory(institutionID int) ([]models.GroupBalanceHistory, error) {
	// Reuse the same history table since institutions are stored in account_groups
	return r.GetHistory(institutionID)
}
