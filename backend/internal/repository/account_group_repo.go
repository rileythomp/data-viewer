package repository

import (
	"database/sql"
	"encoding/json"
	"fmt"

	"finance-tracker/internal/models"
)

type AccountGroupRepository struct {
	db *sql.DB
}

func NewAccountGroupRepository(db *sql.DB) *AccountGroupRepository {
	return &AccountGroupRepository{
		db: db,
	}
}

func (r *AccountGroupRepository) GetAll() ([]models.AccountGroup, error) {
	return r.GetAllByType("group")
}

func (r *AccountGroupRepository) GetAllByType(entityType string) ([]models.AccountGroup, error) {
	query := `
		SELECT id, name, description, color, position, is_archived, is_calculated, formula, entity_type, created_at, updated_at
		FROM account_groups
		WHERE is_archived = false AND entity_type = $1
		ORDER BY position ASC, name ASC
	`
	rows, err := r.db.Query(query, entityType)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var groups []models.AccountGroup
	for rows.Next() {
		var g models.AccountGroup
		var formulaJSON []byte
		err := rows.Scan(&g.ID, &g.Name, &g.Description, &g.Color, &g.Position, &g.IsArchived, &g.IsCalculated, &formulaJSON, &g.EntityType, &g.CreatedAt, &g.UpdatedAt)
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
		SELECT id, name, description, color, position, is_archived, is_calculated, formula, entity_type, created_at, updated_at
		FROM account_groups
		WHERE id = $1
	`
	var g models.AccountGroup
	var formulaJSON []byte
	err := r.db.QueryRow(query, id).Scan(&g.ID, &g.Name, &g.Description, &g.Color, &g.Position, &g.IsArchived, &g.IsCalculated, &formulaJSON, &g.EntityType, &g.CreatedAt, &g.UpdatedAt)
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
		INSERT INTO account_groups (name, description, color, position, is_calculated, formula, entity_type)
		VALUES ($1, $2, $3, $4, $5, $6, 'group')
		RETURNING id, name, description, color, position, is_archived, is_calculated, formula, entity_type, created_at, updated_at
	`
	var g models.AccountGroup
	var returnedFormula []byte
	err = tx.QueryRow(query, req.Name, req.Description, color, newPos, req.IsCalculated, formulaJSON).Scan(
		&g.ID, &g.Name, &g.Description, &g.Color, &g.Position, &g.IsArchived, &g.IsCalculated, &returnedFormula, &g.EntityType, &g.CreatedAt, &g.UpdatedAt,
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
		SET name = $1, description = $2, color = $3, is_calculated = $4, formula = $5, updated_at = NOW()
		WHERE id = $6
		RETURNING id, name, description, color, position, is_archived, is_calculated, formula, entity_type, created_at, updated_at
	`
	var g models.AccountGroup
	var returnedFormula []byte
	err = r.db.QueryRow(query, req.Name, req.Description, req.Color, req.IsCalculated, formulaJSON, id).Scan(
		&g.ID, &g.Name, &g.Description, &g.Color, &g.Position, &g.IsArchived, &g.IsCalculated, &returnedFormula, &g.EntityType, &g.CreatedAt, &g.UpdatedAt,
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
		RETURNING id, name, description, color, position, is_archived, is_calculated, formula, entity_type, created_at, updated_at
	`
	var g models.AccountGroup
	var formulaJSON []byte
	err := r.db.QueryRow(query, id).Scan(
		&g.ID, &g.Name, &g.Description, &g.Color, &g.Position, &g.IsArchived, &g.IsCalculated, &formulaJSON, &g.EntityType, &g.CreatedAt, &g.UpdatedAt,
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

func (r *AccountGroupRepository) GetAllIncludingArchived() ([]models.AccountGroup, error) {
	return r.GetAllIncludingArchivedByType("group")
}

func (r *AccountGroupRepository) GetAllIncludingArchivedByType(entityType string) ([]models.AccountGroup, error) {
	query := `
		SELECT id, name, description, color, position, is_archived, is_calculated, formula, entity_type, created_at, updated_at
		FROM account_groups
		WHERE entity_type = $1
		ORDER BY name ASC
	`
	rows, err := r.db.Query(query, entityType)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var groups []models.AccountGroup
	for rows.Next() {
		var g models.AccountGroup
		var formulaJSON []byte
		err := rows.Scan(&g.ID, &g.Name, &g.Description, &g.Color, &g.Position, &g.IsArchived, &g.IsCalculated, &formulaJSON, &g.EntityType, &g.CreatedAt, &g.UpdatedAt)
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
		RETURNING id, name, description, color, position, is_archived, is_calculated, formula, entity_type, created_at, updated_at
	`
	var g models.AccountGroup
	var formulaJSON []byte
	err := r.db.QueryRow(query, id).Scan(
		&g.ID, &g.Name, &g.Description, &g.Color, &g.Position, &g.IsArchived, &g.IsCalculated, &formulaJSON, &g.EntityType, &g.CreatedAt, &g.UpdatedAt,
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
	// Get the entity type from the group to query the correct history
	group, err := r.GetByID(groupID)
	if err != nil {
		return nil, fmt.Errorf("failed to get group: %w", err)
	}

	query := `
		SELECT id, entity_type, entity_id, entity_name_snapshot, balance, recorded_at
		FROM entity_balance_history
		WHERE entity_type = $1 AND entity_id = $2
		ORDER BY recorded_at DESC
	`
	rows, err := r.db.Query(query, group.EntityType, groupID)
	if err != nil {
		return nil, fmt.Errorf("failed to query history: %w", err)
	}
	defer rows.Close()

	var history []models.GroupBalanceHistory
	for rows.Next() {
		var h models.GroupBalanceHistory
		if err := rows.Scan(&h.ID, &h.EntityType, &h.EntityID, &h.EntityNameSnapshot, &h.Balance, &h.RecordedAt); err != nil {
			return nil, fmt.Errorf("failed to scan history: %w", err)
		}
		history = append(history, h)
	}
	return history, nil
}

// GetAllWithAccountsByType returns all groups/institutions of a given entity type with their accounts
func (r *AccountGroupRepository) GetAllWithAccountsByType(entityType string) ([]models.AccountGroupWithAccounts, error) {
	groups, err := r.GetAllByType(entityType)
	if err != nil {
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

	// Build account lookup map
	accountMap := make(map[int]*models.Account)
	for i := range allAccounts {
		accountMap[allAccounts[i].ID] = &allAccounts[i]
	}

	// Get all memberships with position for this entity type
	membershipQuery := `
		SELECT agm.group_id, agm.account_id, agm.position_in_group
		FROM account_group_memberships agm
		JOIN account_groups ag ON agm.group_id = ag.id
		JOIN account_balances ab ON agm.account_id = ab.id
		WHERE ag.entity_type = $1 AND ag.is_archived = false AND ab.is_archived = false
		ORDER BY agm.group_id, agm.position_in_group ASC
	`
	membershipRows, err := r.db.Query(membershipQuery, entityType)
	if err != nil {
		return nil, err
	}
	defer membershipRows.Close()

	// Map group ID -> list of AccountInGroup
	groupAccounts := make(map[int][]models.AccountInGroup)
	for membershipRows.Next() {
		var groupID, accountID, positionInGroup int
		if err := membershipRows.Scan(&groupID, &accountID, &positionInGroup); err != nil {
			return nil, err
		}
		if acc, ok := accountMap[accountID]; ok {
			groupAccounts[groupID] = append(groupAccounts[groupID], models.AccountInGroup{
				Account:         *acc,
				PositionInGroup: positionInGroup,
			})
		}
	}
	if err := membershipRows.Err(); err != nil {
		return nil, err
	}

	// Build result with accounts and total balances
	var result []models.AccountGroupWithAccounts
	for _, group := range groups {
		var totalBalance float64
		if group.IsCalculated && len(group.Formula) > 0 {
			// Use formula to calculate balance
			for _, item := range group.Formula {
				if acc, ok := accountMap[item.AccountID]; ok {
					totalBalance += acc.CurrentBalance * item.Coefficient
				}
			}
		} else {
			// Sum balances of member accounts
			for _, accInGroup := range groupAccounts[group.ID] {
				totalBalance += accInGroup.CurrentBalance
			}
		}

		accounts := groupAccounts[group.ID]
		if accounts == nil {
			accounts = []models.AccountInGroup{}
		}

		result = append(result, models.AccountGroupWithAccounts{
			AccountGroup: group,
			TotalBalance: totalBalance,
			Accounts:     accounts,
		})
	}

	return result, nil
}

// GetAllInstitutions returns all institutions with their accounts (wrapper for backward compatibility)
func (r *AccountGroupRepository) GetAllInstitutions() ([]models.AccountGroupWithAccounts, error) {
	return r.GetAllWithAccountsByType("institution")
}

// GetAllInstitutionsIncludingArchived returns all institutions including archived ones
func (r *AccountGroupRepository) GetAllInstitutionsIncludingArchived() ([]models.AccountGroup, error) {
	return r.GetAllIncludingArchivedByType("institution")
}

// GetInstitutionByID returns an institution by ID (wrapper using GetByID)
func (r *AccountGroupRepository) GetInstitutionByID(id int) (*models.AccountGroup, error) {
	group, err := r.GetByID(id)
	if err != nil {
		return nil, err
	}
	if group.EntityType != "institution" {
		return nil, fmt.Errorf("entity is not an institution")
	}
	return group, nil
}

// GetInstitutionWithAccounts returns an institution with its accounts (wrapper using GetWithAccounts)
func (r *AccountGroupRepository) GetInstitutionWithAccounts(id int) (*models.AccountGroupWithAccounts, error) {
	return r.GetWithAccounts(id)
}

// CreateByType creates a new group or institution based on entity type
func (r *AccountGroupRepository) CreateByType(req *models.CreateGroupRequest, entityType string) (*models.AccountGroup, error) {
	tx, err := r.db.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	// Get max position for this entity type
	var maxPos sql.NullInt64
	err = tx.QueryRow("SELECT MAX(position) FROM account_groups WHERE is_archived = false AND entity_type = $1", entityType).Scan(&maxPos)
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
		INSERT INTO account_groups (name, description, color, position, is_calculated, formula, entity_type)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, name, description, color, position, is_archived, is_calculated, formula, entity_type, created_at, updated_at
	`
	var g models.AccountGroup
	var returnedFormula []byte
	err = tx.QueryRow(query, req.Name, req.Description, color, newPos, req.IsCalculated, formulaJSON, entityType).Scan(
		&g.ID, &g.Name, &g.Description, &g.Color, &g.Position, &g.IsArchived, &g.IsCalculated, &returnedFormula, &g.EntityType, &g.CreatedAt, &g.UpdatedAt,
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

// CreateInstitution creates a new institution (wrapper for backward compatibility)
func (r *AccountGroupRepository) CreateInstitution(req *models.CreateGroupRequest) (*models.AccountGroup, error) {
	return r.CreateByType(req, "institution")
}

// UpdateInstitution updates an institution (uses the same Update method)
func (r *AccountGroupRepository) UpdateInstitution(id int, req *models.UpdateGroupRequest) (*models.AccountGroup, error) {
	return r.Update(id, req)
}

// ArchiveInstitution archives an institution (uses the same Archive method)
func (r *AccountGroupRepository) ArchiveInstitution(id int) (*models.AccountGroup, error) {
	return r.Archive(id)
}

// UnarchiveInstitution unarchives an institution (uses the same Unarchive method)
func (r *AccountGroupRepository) UnarchiveInstitution(id int) (*models.AccountGroup, error) {
	return r.Unarchive(id)
}

// DeleteInstitution deletes an institution (uses the same Delete method)
func (r *AccountGroupRepository) DeleteInstitution(id int) error {
	return r.Delete(id)
}

// UpdateAccountPositionsInInstitution updates account positions in an institution
// (uses the same UpdateAccountPositionsInGroup method)
func (r *AccountGroupRepository) UpdateAccountPositionsInInstitution(institutionID int, positions []models.AccountPositionInGroup) error {
	return r.UpdateAccountPositionsInGroup(institutionID, positions)
}

// GetInstitutionHistory returns the balance history for an institution (uses GetHistory)
func (r *AccountGroupRepository) GetInstitutionHistory(institutionID int) ([]models.GroupBalanceHistory, error) {
	return r.GetHistory(institutionID)
}
