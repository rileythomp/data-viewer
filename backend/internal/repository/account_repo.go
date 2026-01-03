package repository

import (
	"database/sql"
	"fmt"

	"finance-tracker/internal/models"
)

type AccountRepository struct {
	db *sql.DB
}

func NewAccountRepository(db *sql.DB) *AccountRepository {
	return &AccountRepository{db: db}
}

func (r *AccountRepository) GetAll() ([]models.Account, error) {
	query := `
		SELECT id, account_name, account_info, current_balance, is_archived, position, created_at, updated_at
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
		if err := rows.Scan(&a.ID, &a.AccountName, &a.AccountInfo, &a.CurrentBalance, &a.IsArchived, &a.Position, &a.CreatedAt, &a.UpdatedAt); err != nil {
			return nil, fmt.Errorf("failed to scan account: %w", err)
		}
		accounts = append(accounts, a)
	}
	return accounts, nil
}

func (r *AccountRepository) GetByID(id int) (*models.Account, error) {
	query := `
		SELECT id, account_name, account_info, current_balance, is_archived, position, created_at, updated_at
		FROM account_balances
		WHERE id = $1
	`
	var a models.Account
	err := r.db.QueryRow(query, id).Scan(&a.ID, &a.AccountName, &a.AccountInfo, &a.CurrentBalance, &a.IsArchived, &a.Position, &a.CreatedAt, &a.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get account: %w", err)
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

	// Insert the account
	query := `
		INSERT INTO account_balances (account_name, account_info, current_balance, position)
		VALUES ($1, $2, $3, $4)
		RETURNING id, account_name, account_info, current_balance, is_archived, position, created_at, updated_at
	`
	var a models.Account
	err = tx.QueryRow(query, req.AccountName, req.AccountInfo, req.CurrentBalance, newPosition).Scan(
		&a.ID, &a.AccountName, &a.AccountInfo, &a.CurrentBalance, &a.IsArchived, &a.Position, &a.CreatedAt, &a.UpdatedAt,
	)
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
		RETURNING id, account_name, account_info, current_balance, is_archived, position, created_at, updated_at
	`
	var a models.Account
	err := r.db.QueryRow(query, name, id).Scan(
		&a.ID, &a.AccountName, &a.AccountInfo, &a.CurrentBalance, &a.IsArchived, &a.Position, &a.CreatedAt, &a.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to update account name: %w", err)
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
		RETURNING id, account_name, account_info, current_balance, is_archived, position, created_at, updated_at
	`
	var a models.Account
	err = tx.QueryRow(updateQuery, balance, id).Scan(
		&a.ID, &a.AccountName, &a.AccountInfo, &a.CurrentBalance, &a.IsArchived, &a.Position, &a.CreatedAt, &a.UpdatedAt,
	)
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
		RETURNING id, account_name, account_info, current_balance, is_archived, position, created_at, updated_at
	`
	var a models.Account
	err := r.db.QueryRow(query, id).Scan(
		&a.ID, &a.AccountName, &a.AccountInfo, &a.CurrentBalance, &a.IsArchived, &a.Position, &a.CreatedAt, &a.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to archive account: %w", err)
	}
	return &a, nil
}

func (r *AccountRepository) UpdateInfo(id int, info string) (*models.Account, error) {
	query := `
		UPDATE account_balances
		SET account_info = $1, updated_at = NOW()
		WHERE id = $2
		RETURNING id, account_name, account_info, current_balance, is_archived, position, created_at, updated_at
	`
	var a models.Account
	err := r.db.QueryRow(query, info, id).Scan(
		&a.ID, &a.AccountName, &a.AccountInfo, &a.CurrentBalance, &a.IsArchived, &a.Position, &a.CreatedAt, &a.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to update account info: %w", err)
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
