package repository

import (
	"database/sql"
	"encoding/json"
	"fmt"

	"finance-tracker/internal/models"
)

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
		SELECT id, account_name, account_info, current_balance, is_archived, position, group_id, position_in_group, is_calculated, formula, created_at, updated_at
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
		var groupID sql.NullInt64
		var formulaJSON []byte
		if err := rows.Scan(&a.ID, &a.AccountName, &a.AccountInfo, &a.CurrentBalance, &a.IsArchived, &a.Position, &groupID, &a.PositionInGroup, &a.IsCalculated, &formulaJSON, &a.CreatedAt, &a.UpdatedAt); err != nil {
			return nil, fmt.Errorf("failed to scan account: %w", err)
		}
		if groupID.Valid {
			gid := int(groupID.Int64)
			a.GroupID = &gid
		}
		if len(formulaJSON) > 0 {
			json.Unmarshal(formulaJSON, &a.Formula)
		}
		accounts = append(accounts, a)
	}

	// Resolve calculated account balances
	ResolveCalculatedBalances(accounts)

	return accounts, nil
}

func (r *AccountRepository) GetByID(id int) (*models.Account, error) {
	query := `
		SELECT id, account_name, account_info, current_balance, is_archived, position, group_id, position_in_group, is_calculated, formula, created_at, updated_at
		FROM account_balances
		WHERE id = $1
	`
	var a models.Account
	var groupID sql.NullInt64
	var formulaJSON []byte
	err := r.db.QueryRow(query, id).Scan(&a.ID, &a.AccountName, &a.AccountInfo, &a.CurrentBalance, &a.IsArchived, &a.Position, &groupID, &a.PositionInGroup, &a.IsCalculated, &formulaJSON, &a.CreatedAt, &a.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get account: %w", err)
	}
	if groupID.Valid {
		gid := int(groupID.Int64)
		a.GroupID = &gid
	}
	if len(formulaJSON) > 0 {
		json.Unmarshal(formulaJSON, &a.Formula)
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
		RETURNING id, account_name, account_info, current_balance, is_archived, position, group_id, position_in_group, is_calculated, formula, created_at, updated_at
	`
	var a models.Account
	var groupID sql.NullInt64
	var returnedFormula []byte
	err = tx.QueryRow(query, req.AccountName, req.AccountInfo, req.CurrentBalance, newPosition, req.IsCalculated, formulaJSON).Scan(
		&a.ID, &a.AccountName, &a.AccountInfo, &a.CurrentBalance, &a.IsArchived, &a.Position, &groupID, &a.PositionInGroup, &a.IsCalculated, &returnedFormula, &a.CreatedAt, &a.UpdatedAt,
	)
	if groupID.Valid {
		gid := int(groupID.Int64)
		a.GroupID = &gid
	}
	if len(returnedFormula) > 0 {
		json.Unmarshal(returnedFormula, &a.Formula)
	}
	if err != nil {
		return nil, fmt.Errorf("failed to create account: %w", err)
	}

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
		RETURNING id, account_name, account_info, current_balance, is_archived, position, group_id, position_in_group, is_calculated, formula, created_at, updated_at
	`
	var a models.Account
	var groupID sql.NullInt64
	var formulaJSON []byte
	err := r.db.QueryRow(query, name, id).Scan(
		&a.ID, &a.AccountName, &a.AccountInfo, &a.CurrentBalance, &a.IsArchived, &a.Position, &groupID, &a.PositionInGroup, &a.IsCalculated, &formulaJSON, &a.CreatedAt, &a.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to update account name: %w", err)
	}
	if groupID.Valid {
		gid := int(groupID.Int64)
		a.GroupID = &gid
	}
	if len(formulaJSON) > 0 {
		json.Unmarshal(formulaJSON, &a.Formula)
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
		RETURNING id, account_name, account_info, current_balance, is_archived, position, group_id, position_in_group, is_calculated, formula, created_at, updated_at
	`
	var a models.Account
	var groupID sql.NullInt64
	var formulaJSON []byte
	err = tx.QueryRow(updateQuery, balance, id).Scan(
		&a.ID, &a.AccountName, &a.AccountInfo, &a.CurrentBalance, &a.IsArchived, &a.Position, &groupID, &a.PositionInGroup, &a.IsCalculated, &formulaJSON, &a.CreatedAt, &a.UpdatedAt,
	)
	if groupID.Valid {
		gid := int(groupID.Int64)
		a.GroupID = &gid
	}
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

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}

	return &a, nil
}

func (r *AccountRepository) Archive(id int) (*models.Account, error) {
	query := `
		UPDATE account_balances
		SET is_archived = true, updated_at = NOW()
		WHERE id = $1
		RETURNING id, account_name, account_info, current_balance, is_archived, position, group_id, position_in_group, is_calculated, formula, created_at, updated_at
	`
	var a models.Account
	var groupID sql.NullInt64
	var formulaJSON []byte
	err := r.db.QueryRow(query, id).Scan(
		&a.ID, &a.AccountName, &a.AccountInfo, &a.CurrentBalance, &a.IsArchived, &a.Position, &groupID, &a.PositionInGroup, &a.IsCalculated, &formulaJSON, &a.CreatedAt, &a.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to archive account: %w", err)
	}
	if groupID.Valid {
		gid := int(groupID.Int64)
		a.GroupID = &gid
	}
	if len(formulaJSON) > 0 {
		json.Unmarshal(formulaJSON, &a.Formula)
	}
	return &a, nil
}

func (r *AccountRepository) UpdateInfo(id int, info string) (*models.Account, error) {
	query := `
		UPDATE account_balances
		SET account_info = $1, updated_at = NOW()
		WHERE id = $2
		RETURNING id, account_name, account_info, current_balance, is_archived, position, group_id, position_in_group, is_calculated, formula, created_at, updated_at
	`
	var a models.Account
	var groupID sql.NullInt64
	var formulaJSON []byte
	err := r.db.QueryRow(query, info, id).Scan(
		&a.ID, &a.AccountName, &a.AccountInfo, &a.CurrentBalance, &a.IsArchived, &a.Position, &groupID, &a.PositionInGroup, &a.IsCalculated, &formulaJSON, &a.CreatedAt, &a.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to update account info: %w", err)
	}
	if groupID.Valid {
		gid := int(groupID.Int64)
		a.GroupID = &gid
	}
	if len(formulaJSON) > 0 {
		json.Unmarshal(formulaJSON, &a.Formula)
	}
	return &a, nil
}

func (r *AccountRepository) SetGroup(id int, groupID *int, positionInGroup *int) (*models.Account, error) {
	var a models.Account
	var gid sql.NullInt64
	var formulaJSON []byte

	if groupID == nil {
		query := `
			UPDATE account_balances
			SET group_id = NULL, position_in_group = 0, updated_at = NOW()
			WHERE id = $1
			RETURNING id, account_name, account_info, current_balance, is_archived, position, group_id, position_in_group, is_calculated, formula, created_at, updated_at
		`
		err := r.db.QueryRow(query, id).Scan(
			&a.ID, &a.AccountName, &a.AccountInfo, &a.CurrentBalance, &a.IsArchived, &a.Position, &gid, &a.PositionInGroup, &a.IsCalculated, &formulaJSON, &a.CreatedAt, &a.UpdatedAt,
		)
		if err == sql.ErrNoRows {
			return nil, nil
		}
		if err != nil {
			return nil, fmt.Errorf("failed to remove account from group: %w", err)
		}
	} else {
		tx, err := r.db.Begin()
		if err != nil {
			return nil, fmt.Errorf("failed to begin transaction: %w", err)
		}
		defer tx.Rollback()

		var newPos int
		if positionInGroup != nil {
			// Use the specified position and shift existing accounts
			newPos = *positionInGroup

			// Shift accounts at or after the target position down by 1
			_, err = tx.Exec(`
				UPDATE account_balances
				SET position_in_group = position_in_group + 1, updated_at = NOW()
				WHERE group_id = $1 AND position_in_group >= $2 AND id != $3
			`, *groupID, newPos, id)
			if err != nil {
				return nil, fmt.Errorf("failed to shift account positions: %w", err)
			}
		} else {
			// Default to end of list
			var maxPos sql.NullInt64
			err := tx.QueryRow("SELECT MAX(position_in_group) FROM account_balances WHERE group_id = $1", *groupID).Scan(&maxPos)
			if err != nil {
				return nil, fmt.Errorf("failed to get max position in group: %w", err)
			}
			newPos = 1
			if maxPos.Valid {
				newPos = int(maxPos.Int64) + 1
			}
		}

		query := `
			UPDATE account_balances
			SET group_id = $1, position_in_group = $2, updated_at = NOW()
			WHERE id = $3
			RETURNING id, account_name, account_info, current_balance, is_archived, position, group_id, position_in_group, is_calculated, formula, created_at, updated_at
		`
		err = tx.QueryRow(query, *groupID, newPos, id).Scan(
			&a.ID, &a.AccountName, &a.AccountInfo, &a.CurrentBalance, &a.IsArchived, &a.Position, &gid, &a.PositionInGroup, &a.IsCalculated, &formulaJSON, &a.CreatedAt, &a.UpdatedAt,
		)
		if err == sql.ErrNoRows {
			return nil, nil
		}
		if err != nil {
			return nil, fmt.Errorf("failed to set account group: %w", err)
		}

		if err := tx.Commit(); err != nil {
			return nil, fmt.Errorf("failed to commit transaction: %w", err)
		}
	}

	if gid.Valid {
		g := int(gid.Int64)
		a.GroupID = &g
	}
	if len(formulaJSON) > 0 {
		json.Unmarshal(formulaJSON, &a.Formula)
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
		RETURNING id, account_name, account_info, current_balance, is_archived, position, group_id, position_in_group, is_calculated, formula, created_at, updated_at
	`
	var a models.Account
	var groupID sql.NullInt64
	var returnedFormula []byte
	err = r.db.QueryRow(query, isCalculated, formulaJSON, id).Scan(
		&a.ID, &a.AccountName, &a.AccountInfo, &a.CurrentBalance, &a.IsArchived, &a.Position, &groupID, &a.PositionInGroup, &a.IsCalculated, &returnedFormula, &a.CreatedAt, &a.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to update formula: %w", err)
	}
	if groupID.Valid {
		gid := int(groupID.Int64)
		a.GroupID = &gid
	}
	if len(returnedFormula) > 0 {
		json.Unmarshal(returnedFormula, &a.Formula)
	}
	return &a, nil
}
