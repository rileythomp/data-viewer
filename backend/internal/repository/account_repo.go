package repository

import (
	"database/sql"
	"encoding/json"
	"fmt"

	"finance-tracker/internal/models"
	"finance-tracker/internal/validation"
)

// HistoryEntry represents a history record to be inserted
type HistoryEntry struct {
	AccountID   int
	AccountName string
	Balance     float64
}

type AccountRepository struct {
	db *sql.DB
}

// ResolveCalculatedBalances computes the CurrentBalance for all calculated accounts
// by evaluating their formulas. It handles nested dependencies by resolving accounts
// in topological order (non-calculated first, then calculated accounts whose
// dependencies have been resolved).
func ResolveCalculatedBalances(accounts []models.Account) {
	// Build map of account ID -> pointer to account
	accountMap := make(map[int]*models.Account)
	for i := range accounts {
		accountMap[accounts[i].ID] = &accounts[i]
	}

	// Track which accounts have been resolved
	resolved := make(map[int]bool)
	for id, acc := range accountMap {
		if !acc.IsCalculated {
			resolved[id] = true
		}
	}

	// Iteratively resolve calculated accounts
	// Use multiple passes to handle nested dependencies
	maxIterations := len(accounts)
	for iteration := 0; iteration < maxIterations; iteration++ {
		progress := false
		for id, acc := range accountMap {
			if resolved[id] || !acc.IsCalculated {
				continue
			}

			// Check if all dependencies are resolved
			allResolved := true
			for _, item := range acc.Formula {
				if !resolved[item.AccountID] {
					allResolved = false
					break
				}
			}

			if allResolved {
				// Calculate balance from formula
				var total float64
				for _, item := range acc.Formula {
					if dep, ok := accountMap[item.AccountID]; ok {
						total += item.Coefficient * dep.CurrentBalance
					}
				}
				acc.CurrentBalance = total
				resolved[id] = true
				progress = true
			}
		}
		if !progress {
			break
		}
	}
}

func NewAccountRepository(db *sql.DB) *AccountRepository {
	return &AccountRepository{db: db}
}

func (r *AccountRepository) GetAll() ([]models.Account, error) {
	query := `
		SELECT id, account_name, account_info, current_balance, is_archived, position, is_calculated, formula, created_at, updated_at
		FROM account_balances
		WHERE is_archived = false
		ORDER BY position ASC, account_name ASC
	`
	rows, err := r.db.Query(query)
	if err != nil {
		return nil, fmt.Errorf("failed to query accounts: %w", err)
	}
	defer rows.Close()

	var accounts []models.Account
	for rows.Next() {
		var a models.Account
		var formulaJSON []byte
		if err := rows.Scan(&a.ID, &a.AccountName, &a.AccountInfo, &a.CurrentBalance, &a.IsArchived, &a.Position, &a.IsCalculated, &formulaJSON, &a.CreatedAt, &a.UpdatedAt); err != nil {
			return nil, fmt.Errorf("failed to scan account: %w", err)
		}
		if len(formulaJSON) > 0 {
			json.Unmarshal(formulaJSON, &a.Formula)
		}
		accounts = append(accounts, a)
	}

	// Fetch group memberships for all accounts (only groups, not institutions)
	membershipQuery := `
		SELECT m.account_id, m.group_id FROM account_group_memberships m
		JOIN account_groups g ON m.group_id = g.id
		WHERE g.entity_type = 'group'
		ORDER BY m.account_id, m.group_id
	`
	membershipRows, err := r.db.Query(membershipQuery)
	if err != nil {
		return nil, fmt.Errorf("failed to query memberships: %w", err)
	}
	defer membershipRows.Close()

	memberships := make(map[int][]int)
	for membershipRows.Next() {
		var accountID, groupID int
		if err := membershipRows.Scan(&accountID, &groupID); err != nil {
			return nil, fmt.Errorf("failed to scan membership: %w", err)
		}
		memberships[accountID] = append(memberships[accountID], groupID)
	}

	// Fetch institution memberships for all accounts
	institutionQuery := `
		SELECT m.account_id, m.group_id FROM account_group_memberships m
		JOIN account_groups g ON m.group_id = g.id
		WHERE g.entity_type = 'institution'
		ORDER BY m.account_id
	`
	institutionRows, err := r.db.Query(institutionQuery)
	if err != nil {
		return nil, fmt.Errorf("failed to query institution memberships: %w", err)
	}
	defer institutionRows.Close()

	institutionMemberships := make(map[int]int)
	for institutionRows.Next() {
		var accountID, institutionID int
		if err := institutionRows.Scan(&accountID, &institutionID); err != nil {
			return nil, fmt.Errorf("failed to scan institution membership: %w", err)
		}
		institutionMemberships[accountID] = institutionID
	}

	// Assign group IDs and institution ID to accounts
	for i := range accounts {
		if groupIDs, ok := memberships[accounts[i].ID]; ok {
			accounts[i].GroupIDs = groupIDs
		} else {
			accounts[i].GroupIDs = []int{}
		}
		if institutionID, ok := institutionMemberships[accounts[i].ID]; ok {
			accounts[i].InstitutionID = &institutionID
		}
	}

	// Resolve calculated account balances
	ResolveCalculatedBalances(accounts)

	return accounts, nil
}

func (r *AccountRepository) GetByID(id int) (*models.Account, error) {
	query := `
		SELECT id, account_name, account_info, current_balance, is_archived, position, is_calculated, formula, created_at, updated_at
		FROM account_balances
		WHERE id = $1
	`
	var a models.Account
	var formulaJSON []byte
	err := r.db.QueryRow(query, id).Scan(&a.ID, &a.AccountName, &a.AccountInfo, &a.CurrentBalance, &a.IsArchived, &a.Position, &a.IsCalculated, &formulaJSON, &a.CreatedAt, &a.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get account: %w", err)
	}
	if len(formulaJSON) > 0 {
		json.Unmarshal(formulaJSON, &a.Formula)
	}

	// Fetch group memberships for this account (only groups, not institutions)
	membershipQuery := `
		SELECT m.group_id FROM account_group_memberships m
		JOIN account_groups g ON m.group_id = g.id
		WHERE m.account_id = $1 AND g.entity_type = 'group'
		ORDER BY m.group_id
	`
	rows, err := r.db.Query(membershipQuery, id)
	if err != nil {
		return nil, fmt.Errorf("failed to query memberships: %w", err)
	}
	defer rows.Close()

	a.GroupIDs = []int{}
	for rows.Next() {
		var groupID int
		if err := rows.Scan(&groupID); err != nil {
			return nil, fmt.Errorf("failed to scan group ID: %w", err)
		}
		a.GroupIDs = append(a.GroupIDs, groupID)
	}

	// Fetch institution membership for this account
	institutionQuery := `
		SELECT m.group_id FROM account_group_memberships m
		JOIN account_groups g ON m.group_id = g.id
		WHERE m.account_id = $1 AND g.entity_type = 'institution'
		LIMIT 1
	`
	var institutionID int
	err = r.db.QueryRow(institutionQuery, id).Scan(&institutionID)
	if err == nil {
		a.InstitutionID = &institutionID
	} else if err != sql.ErrNoRows {
		return nil, fmt.Errorf("failed to query institution membership: %w", err)
	}

	// If this is a calculated account, resolve its balance using all accounts
	if a.IsCalculated && len(a.Formula) > 0 {
		allAccounts, err := r.GetAll()
		if err != nil {
			return nil, fmt.Errorf("failed to fetch accounts for balance calculation: %w", err)
		}
		// Find our account in the resolved list and copy its balance
		for _, acc := range allAccounts {
			if acc.ID == id {
				a.CurrentBalance = acc.CurrentBalance
				break
			}
		}
	}

	return &a, nil
}

func (r *AccountRepository) Create(req *models.CreateAccountRequest) (*models.Account, error) {
	tx, err := r.db.Begin()
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// Get max position for new account
	var maxPosition sql.NullInt64
	err = tx.QueryRow("SELECT MAX(position) FROM account_balances WHERE is_archived = false").Scan(&maxPosition)
	if err != nil {
		return nil, fmt.Errorf("failed to get max position: %w", err)
	}
	newPosition := 1
	if maxPosition.Valid {
		newPosition = int(maxPosition.Int64) + 1
	}

	// Marshal formula if calculated
	var formulaJSON interface{}
	if req.IsCalculated && len(req.Formula) > 0 {
		formulaJSON, err = json.Marshal(req.Formula)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal formula: %w", err)
		}
	}

	// Insert the account
	query := `
		INSERT INTO account_balances (account_name, account_info, current_balance, position, is_calculated, formula)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, account_name, account_info, current_balance, is_archived, position, is_calculated, formula, created_at, updated_at
	`
	var a models.Account
	var returnedFormula []byte
	err = tx.QueryRow(query, req.AccountName, req.AccountInfo, req.CurrentBalance, newPosition, req.IsCalculated, formulaJSON).Scan(
		&a.ID, &a.AccountName, &a.AccountInfo, &a.CurrentBalance, &a.IsArchived, &a.Position, &a.IsCalculated, &returnedFormula, &a.CreatedAt, &a.UpdatedAt,
	)
	if len(returnedFormula) > 0 {
		json.Unmarshal(returnedFormula, &a.Formula)
	}
	if err != nil {
		return nil, fmt.Errorf("failed to create account: %w", err)
	}

	// Initialize empty GroupIDs
	a.GroupIDs = []int{}

	// Create initial history record
	historyQuery := `
		INSERT INTO balance_history (account_id, account_name_snapshot, balance)
		VALUES ($1, $2, $3)
	`
	_, err = tx.Exec(historyQuery, a.ID, a.AccountName, a.CurrentBalance)
	if err != nil {
		return nil, fmt.Errorf("failed to create initial history: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}

	return &a, nil
}

func (r *AccountRepository) UpdateName(id int, name string) (*models.Account, error) {
	query := `
		UPDATE account_balances
		SET account_name = $1, updated_at = NOW()
		WHERE id = $2
		RETURNING id, account_name, account_info, current_balance, is_archived, position, is_calculated, formula, created_at, updated_at
	`
	var a models.Account
	var formulaJSON []byte
	err := r.db.QueryRow(query, name, id).Scan(
		&a.ID, &a.AccountName, &a.AccountInfo, &a.CurrentBalance, &a.IsArchived, &a.Position, &a.IsCalculated, &formulaJSON, &a.CreatedAt, &a.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to update account name: %w", err)
	}
	if len(formulaJSON) > 0 {
		json.Unmarshal(formulaJSON, &a.Formula)
	}

	// Fetch group memberships
	a.GroupIDs = []int{}
	rows, err := r.db.Query("SELECT group_id FROM account_group_memberships WHERE account_id = $1 ORDER BY group_id", id)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var gid int
			if rows.Scan(&gid) == nil {
				a.GroupIDs = append(a.GroupIDs, gid)
			}
		}
	}

	return &a, nil
}

func (r *AccountRepository) UpdateBalance(id int, balance float64) (*models.Account, error) {
	tx, err := r.db.Begin()
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// Get current account name for the snapshot
	var accountName string
	err = tx.QueryRow("SELECT account_name FROM account_balances WHERE id = $1", id).Scan(&accountName)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get account name: %w", err)
	}

	// Update the balance
	updateQuery := `
		UPDATE account_balances
		SET current_balance = $1, updated_at = NOW()
		WHERE id = $2
		RETURNING id, account_name, account_info, current_balance, is_archived, position, is_calculated, formula, created_at, updated_at
	`
	var a models.Account
	var formulaJSON []byte
	err = tx.QueryRow(updateQuery, balance, id).Scan(
		&a.ID, &a.AccountName, &a.AccountInfo, &a.CurrentBalance, &a.IsArchived, &a.Position, &a.IsCalculated, &formulaJSON, &a.CreatedAt, &a.UpdatedAt,
	)
	if len(formulaJSON) > 0 {
		json.Unmarshal(formulaJSON, &a.Formula)
	}
	if err != nil {
		return nil, fmt.Errorf("failed to update balance: %w", err)
	}

	// Create history record with the account name snapshot
	historyQuery := `
		INSERT INTO balance_history (account_id, account_name_snapshot, balance)
		VALUES ($1, $2, $3)
	`
	_, err = tx.Exec(historyQuery, id, accountName, balance)
	if err != nil {
		return nil, fmt.Errorf("failed to create history record: %w", err)
	}

	// Propagate history to transitively dependent calculated accounts
	allAccounts, err := r.getAllAccountsTx(tx)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch accounts for dependency propagation: %w", err)
	}

	dependentIDs := validation.FindTransitiveDependents(id, allAccounts)

	// Build account map and balance map (needed for both account and group propagation)
	accountMap := make(map[int]*models.Account)
	balanceMap := make(map[int]float64)
	for i := range allAccounts {
		accountMap[allAccounts[i].ID] = &allAccounts[i]
		balanceMap[allAccounts[i].ID] = allAccounts[i].CurrentBalance
	}
	// Update balance map with the new balance for the updated account
	balanceMap[id] = balance

	if len(dependentIDs) > 0 {
		// Calculate new balances and collect history entries
		var historyEntries []HistoryEntry
		for _, depID := range dependentIDs {
			depAccount := accountMap[depID]
			if depAccount == nil || depAccount.IsArchived {
				// Skip archived accounts (but they're still in balanceMap for formula calculations)
				continue
			}
			if !depAccount.IsCalculated || len(depAccount.Formula) == 0 {
				continue
			}

			// Calculate new balance from formula
			newBalance := calculateFormulaBalance(depAccount.Formula, balanceMap)
			// Update balance map for subsequent calculations
			balanceMap[depID] = newBalance

			historyEntries = append(historyEntries, HistoryEntry{
				AccountID:   depID,
				AccountName: depAccount.AccountName,
				Balance:     newBalance,
			})
		}

		// Batch insert history records
		if err := r.insertHistoryRecordsTx(tx, historyEntries); err != nil {
			return nil, fmt.Errorf("failed to insert dependent history records: %w", err)
		}
	}

	// Propagate history to affected groups
	affectedGroupIDs, err := r.findAffectedGroups(tx, id, dependentIDs)
	if err != nil {
		return nil, fmt.Errorf("failed to find affected groups: %w", err)
	}

	if len(affectedGroupIDs) > 0 {
		if err := r.insertGroupHistoryRecordsTx(tx, affectedGroupIDs, balanceMap); err != nil {
			return nil, fmt.Errorf("failed to insert group history records: %w", err)
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}

	// Fetch group memberships
	a.GroupIDs = []int{}
	rows, err := r.db.Query("SELECT group_id FROM account_group_memberships WHERE account_id = $1 ORDER BY group_id", id)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var gid int
			if rows.Scan(&gid) == nil {
				a.GroupIDs = append(a.GroupIDs, gid)
			}
		}
	}

	return &a, nil
}

func (r *AccountRepository) Archive(id int) (*models.Account, error) {
	query := `
		UPDATE account_balances
		SET is_archived = true, updated_at = NOW()
		WHERE id = $1
		RETURNING id, account_name, account_info, current_balance, is_archived, position, is_calculated, formula, created_at, updated_at
	`
	var a models.Account
	var formulaJSON []byte
	err := r.db.QueryRow(query, id).Scan(
		&a.ID, &a.AccountName, &a.AccountInfo, &a.CurrentBalance, &a.IsArchived, &a.Position, &a.IsCalculated, &formulaJSON, &a.CreatedAt, &a.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to archive account: %w", err)
	}
	if len(formulaJSON) > 0 {
		json.Unmarshal(formulaJSON, &a.Formula)
	}
	a.GroupIDs = []int{}
	return &a, nil
}

func (r *AccountRepository) UpdateInfo(id int, info string) (*models.Account, error) {
	query := `
		UPDATE account_balances
		SET account_info = $1, updated_at = NOW()
		WHERE id = $2
		RETURNING id, account_name, account_info, current_balance, is_archived, position, is_calculated, formula, created_at, updated_at
	`
	var a models.Account
	var formulaJSON []byte
	err := r.db.QueryRow(query, info, id).Scan(
		&a.ID, &a.AccountName, &a.AccountInfo, &a.CurrentBalance, &a.IsArchived, &a.Position, &a.IsCalculated, &formulaJSON, &a.CreatedAt, &a.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to update account info: %w", err)
	}
	if len(formulaJSON) > 0 {
		json.Unmarshal(formulaJSON, &a.Formula)
	}

	// Fetch group memberships
	a.GroupIDs = []int{}
	rows, err := r.db.Query("SELECT group_id FROM account_group_memberships WHERE account_id = $1 ORDER BY group_id", id)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var gid int
			if rows.Scan(&gid) == nil {
				a.GroupIDs = append(a.GroupIDs, gid)
			}
		}
	}

	return &a, nil
}


func (r *AccountRepository) GetHistory(accountID int) ([]models.BalanceHistory, error) {
	query := `
		SELECT id, account_id, account_name_snapshot, balance, recorded_at
		FROM balance_history
		WHERE account_id = $1
		ORDER BY recorded_at DESC
	`
	rows, err := r.db.Query(query, accountID)
	if err != nil {
		return nil, fmt.Errorf("failed to query history: %w", err)
	}
	defer rows.Close()

	var history []models.BalanceHistory
	for rows.Next() {
		var h models.BalanceHistory
		if err := rows.Scan(&h.ID, &h.AccountID, &h.AccountNameSnapshot, &h.Balance, &h.RecordedAt); err != nil {
			return nil, fmt.Errorf("failed to scan history: %w", err)
		}
		history = append(history, h)
	}
	return history, nil
}

func (r *AccountRepository) UpdatePositions(positions []models.AccountPosition) error {
	tx, err := r.db.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	query := `UPDATE account_balances SET position = $1, updated_at = NOW() WHERE id = $2`

	for _, pos := range positions {
		_, err := tx.Exec(query, pos.Position, pos.ID)
		if err != nil {
			return fmt.Errorf("failed to update position for account %d: %w", pos.ID, err)
		}
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}
	return nil
}

func (r *AccountRepository) UpdateFormula(id int, isCalculated bool, formula []models.FormulaItem) (*models.Account, error) {
	var formulaJSON interface{}
	var err error
	if isCalculated && len(formula) > 0 {
		formulaJSON, err = json.Marshal(formula)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal formula: %w", err)
		}
	}

	query := `
		UPDATE account_balances
		SET is_calculated = $1, formula = $2, updated_at = NOW()
		WHERE id = $3
		RETURNING id, account_name, account_info, current_balance, is_archived, position, is_calculated, formula, created_at, updated_at
	`
	var a models.Account
	var returnedFormula []byte
	err = r.db.QueryRow(query, isCalculated, formulaJSON, id).Scan(
		&a.ID, &a.AccountName, &a.AccountInfo, &a.CurrentBalance, &a.IsArchived, &a.Position, &a.IsCalculated, &returnedFormula, &a.CreatedAt, &a.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to update formula: %w", err)
	}
	if len(returnedFormula) > 0 {
		json.Unmarshal(returnedFormula, &a.Formula)
	}

	// Fetch group memberships
	a.GroupIDs = []int{}
	rows, err := r.db.Query("SELECT group_id FROM account_group_memberships WHERE account_id = $1 ORDER BY group_id", id)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var gid int
			if rows.Scan(&gid) == nil {
				a.GroupIDs = append(a.GroupIDs, gid)
			}
		}
	}

	return &a, nil
}

func (r *AccountRepository) GetAllIncludingArchived() ([]models.Account, error) {
	query := `
		SELECT id, account_name, account_info, current_balance, is_archived, position, is_calculated, formula, created_at, updated_at
		FROM account_balances
		ORDER BY account_name ASC
	`
	rows, err := r.db.Query(query)
	if err != nil {
		return nil, fmt.Errorf("failed to query accounts: %w", err)
	}
	defer rows.Close()

	var accounts []models.Account
	for rows.Next() {
		var a models.Account
		var formulaJSON []byte
		if err := rows.Scan(&a.ID, &a.AccountName, &a.AccountInfo, &a.CurrentBalance, &a.IsArchived, &a.Position, &a.IsCalculated, &formulaJSON, &a.CreatedAt, &a.UpdatedAt); err != nil {
			return nil, fmt.Errorf("failed to scan account: %w", err)
		}
		if len(formulaJSON) > 0 {
			json.Unmarshal(formulaJSON, &a.Formula)
		}
		accounts = append(accounts, a)
	}

	// Fetch group memberships for all accounts (only groups, not institutions)
	membershipQuery := `
		SELECT m.account_id, m.group_id FROM account_group_memberships m
		JOIN account_groups g ON m.group_id = g.id
		WHERE g.entity_type = 'group'
		ORDER BY m.account_id, m.group_id
	`
	membershipRows, err := r.db.Query(membershipQuery)
	if err != nil {
		return nil, fmt.Errorf("failed to query memberships: %w", err)
	}
	defer membershipRows.Close()

	memberships := make(map[int][]int)
	for membershipRows.Next() {
		var accountID, groupID int
		if err := membershipRows.Scan(&accountID, &groupID); err != nil {
			return nil, fmt.Errorf("failed to scan membership: %w", err)
		}
		memberships[accountID] = append(memberships[accountID], groupID)
	}

	// Fetch institution memberships for all accounts
	institutionQuery := `
		SELECT m.account_id, m.group_id FROM account_group_memberships m
		JOIN account_groups g ON m.group_id = g.id
		WHERE g.entity_type = 'institution'
		ORDER BY m.account_id
	`
	institutionRows, err := r.db.Query(institutionQuery)
	if err != nil {
		return nil, fmt.Errorf("failed to query institution memberships: %w", err)
	}
	defer institutionRows.Close()

	institutionMemberships := make(map[int]int)
	for institutionRows.Next() {
		var accountID, institutionID int
		if err := institutionRows.Scan(&accountID, &institutionID); err != nil {
			return nil, fmt.Errorf("failed to scan institution membership: %w", err)
		}
		institutionMemberships[accountID] = institutionID
	}

	// Assign group IDs and institution ID to accounts
	for i := range accounts {
		if groupIDs, ok := memberships[accounts[i].ID]; ok {
			accounts[i].GroupIDs = groupIDs
		} else {
			accounts[i].GroupIDs = []int{}
		}
		if institutionID, ok := institutionMemberships[accounts[i].ID]; ok {
			accounts[i].InstitutionID = &institutionID
		}
	}

	// Resolve calculated account balances
	ResolveCalculatedBalances(accounts)

	return accounts, nil
}

func (r *AccountRepository) Unarchive(id int) (*models.Account, error) {
	query := `
		UPDATE account_balances
		SET is_archived = false, updated_at = NOW()
		WHERE id = $1
		RETURNING id, account_name, account_info, current_balance, is_archived, position, is_calculated, formula, created_at, updated_at
	`
	var a models.Account
	var formulaJSON []byte
	err := r.db.QueryRow(query, id).Scan(
		&a.ID, &a.AccountName, &a.AccountInfo, &a.CurrentBalance, &a.IsArchived, &a.Position, &a.IsCalculated, &formulaJSON, &a.CreatedAt, &a.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to unarchive account: %w", err)
	}
	if len(formulaJSON) > 0 {
		json.Unmarshal(formulaJSON, &a.Formula)
	}
	a.GroupIDs = []int{}
	return &a, nil
}

func (r *AccountRepository) Delete(id int) error {
	tx, err := r.db.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// Delete from account_group_memberships
	_, err = tx.Exec("DELETE FROM account_group_memberships WHERE account_id = $1", id)
	if err != nil {
		return fmt.Errorf("failed to delete memberships: %w", err)
	}

	// Delete from balance_history
	_, err = tx.Exec("DELETE FROM balance_history WHERE account_id = $1", id)
	if err != nil {
		return fmt.Errorf("failed to delete history: %w", err)
	}

	// Delete the account
	result, err := tx.Exec("DELETE FROM account_balances WHERE id = $1", id)
	if err != nil {
		return fmt.Errorf("failed to delete account: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}
	if rowsAffected == 0 {
		return fmt.Errorf("account not found")
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}

// getAllAccountsTx fetches all accounts within an existing transaction
func (r *AccountRepository) getAllAccountsTx(tx *sql.Tx) ([]models.Account, error) {
	query := `
		SELECT id, account_name, account_info, current_balance, is_archived, position, is_calculated, formula, created_at, updated_at
		FROM account_balances
		ORDER BY account_name ASC
	`
	rows, err := tx.Query(query)
	if err != nil {
		return nil, fmt.Errorf("failed to query accounts: %w", err)
	}
	defer rows.Close()

	var accounts []models.Account
	for rows.Next() {
		var a models.Account
		var formulaJSON []byte
		if err := rows.Scan(&a.ID, &a.AccountName, &a.AccountInfo, &a.CurrentBalance, &a.IsArchived, &a.Position, &a.IsCalculated, &formulaJSON, &a.CreatedAt, &a.UpdatedAt); err != nil {
			return nil, fmt.Errorf("failed to scan account: %w", err)
		}
		if len(formulaJSON) > 0 {
			json.Unmarshal(formulaJSON, &a.Formula)
		}
		accounts = append(accounts, a)
	}

	return accounts, nil
}

// calculateFormulaBalance calculates the balance from a formula using provided balance map
func calculateFormulaBalance(formula []models.FormulaItem, balanceMap map[int]float64) float64 {
	var total float64
	for _, item := range formula {
		if balance, ok := balanceMap[item.AccountID]; ok {
			total += item.Coefficient * balance
		}
		// If account not found in map, it contributes 0 (handles deleted accounts)
	}
	return total
}

// insertHistoryRecordsTx batch inserts history records efficiently
func (r *AccountRepository) insertHistoryRecordsTx(tx *sql.Tx, entries []HistoryEntry) error {
	if len(entries) == 0 {
		return nil
	}

	query := `
		INSERT INTO balance_history (account_id, account_name_snapshot, balance)
		VALUES ($1, $2, $3)
	`
	stmt, err := tx.Prepare(query)
	if err != nil {
		return fmt.Errorf("failed to prepare history insert: %w", err)
	}
	defer stmt.Close()

	for _, entry := range entries {
		_, err = stmt.Exec(entry.AccountID, entry.AccountName, entry.Balance)
		if err != nil {
			return fmt.Errorf("failed to insert history for account %d: %w", entry.AccountID, err)
		}
	}

	return nil
}

// findAffectedGroups returns all group IDs affected by an account balance change
func (r *AccountRepository) findAffectedGroups(tx *sql.Tx, accountID int, dependentAccountIDs []int) ([]int, error) {
	// Collect all account IDs that changed (original + dependents)
	changedAccountIDs := append([]int{accountID}, dependentAccountIDs...)

	groupIDSet := make(map[int]bool)

	// Find groups where these accounts are members
	for _, accID := range changedAccountIDs {
		rows, err := tx.Query(`
			SELECT group_id FROM account_group_memberships WHERE account_id = $1
		`, accID)
		if err != nil {
			return nil, err
		}
		for rows.Next() {
			var groupID int
			if err := rows.Scan(&groupID); err != nil {
				rows.Close()
				return nil, err
			}
			groupIDSet[groupID] = true
		}
		rows.Close()
	}

	// Find calculated groups whose formula references any of these accounts
	rows, err := tx.Query(`
		SELECT id, formula FROM account_groups
		WHERE is_calculated = true AND formula IS NOT NULL AND is_archived = false
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var groupID int
		var formulaJSON []byte
		if err := rows.Scan(&groupID, &formulaJSON); err != nil {
			return nil, err
		}

		var formula []models.FormulaItem
		if err := json.Unmarshal(formulaJSON, &formula); err != nil {
			continue
		}

		for _, item := range formula {
			for _, accID := range changedAccountIDs {
				if item.AccountID == accID {
					groupIDSet[groupID] = true
					break
				}
			}
		}
	}

	// Convert set to slice
	var groupIDs []int
	for id := range groupIDSet {
		groupIDs = append(groupIDs, id)
	}
	return groupIDs, nil
}

// insertGroupHistoryRecordsTx inserts history records for multiple groups
func (r *AccountRepository) insertGroupHistoryRecordsTx(tx *sql.Tx, groupIDs []int, balanceMap map[int]float64) error {
	for _, groupID := range groupIDs {
		// Get group info
		var groupName string
		var isCalculated bool
		var formulaJSON []byte

		err := tx.QueryRow(`
			SELECT group_name, is_calculated, formula
			FROM account_groups WHERE id = $1 AND is_archived = false
		`, groupID).Scan(&groupName, &isCalculated, &formulaJSON)
		if err == sql.ErrNoRows {
			continue // Skip archived groups
		}
		if err != nil {
			return err
		}

		// Calculate group balance
		var totalBalance float64
		if isCalculated && len(formulaJSON) > 0 {
			var formula []models.FormulaItem
			json.Unmarshal(formulaJSON, &formula)
			for _, item := range formula {
				if balance, ok := balanceMap[item.AccountID]; ok {
					totalBalance += item.Coefficient * balance
				}
			}
		} else {
			// Sum of member account balances
			memberRows, err := tx.Query(`
				SELECT account_id FROM account_group_memberships WHERE group_id = $1
			`, groupID)
			if err != nil {
				return err
			}
			for memberRows.Next() {
				var accountID int
				if err := memberRows.Scan(&accountID); err != nil {
					memberRows.Close()
					return err
				}
				if balance, ok := balanceMap[accountID]; ok {
					totalBalance += balance
				}
			}
			memberRows.Close()
		}

		// Insert history record
		_, err = tx.Exec(`
			INSERT INTO group_balance_history (group_id, group_name_snapshot, balance)
			VALUES ($1, $2, $3)
		`, groupID, groupName, totalBalance)
		if err != nil {
			return err
		}
	}
	return nil
}
