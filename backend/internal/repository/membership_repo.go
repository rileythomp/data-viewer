package repository

import (
	"database/sql"
	"fmt"
)

type MembershipRepository struct {
	db *sql.DB
}

func NewMembershipRepository(db *sql.DB) *MembershipRepository {
	return &MembershipRepository{db: db}
}

// GetGroupsForAccount returns all group IDs for an account
func (r *MembershipRepository) GetGroupsForAccount(accountID int) ([]int, error) {
	query := `
		SELECT group_id FROM account_group_memberships
		WHERE account_id = $1
		ORDER BY group_id
	`
	rows, err := r.db.Query(query, accountID)
	if err != nil {
		return nil, fmt.Errorf("failed to query group memberships: %w", err)
	}
	defer rows.Close()

	var groupIDs []int
	for rows.Next() {
		var groupID int
		if err := rows.Scan(&groupID); err != nil {
			return nil, fmt.Errorf("failed to scan group ID: %w", err)
		}
		groupIDs = append(groupIDs, groupID)
	}
	return groupIDs, nil
}

// GetAllMemberships returns a map of account ID -> group IDs for all accounts
func (r *MembershipRepository) GetAllMemberships() (map[int][]int, error) {
	query := `
		SELECT account_id, group_id FROM account_group_memberships
		ORDER BY account_id, group_id
	`
	rows, err := r.db.Query(query)
	if err != nil {
		return nil, fmt.Errorf("failed to query all memberships: %w", err)
	}
	defer rows.Close()

	result := make(map[int][]int)
	for rows.Next() {
		var accountID, groupID int
		if err := rows.Scan(&accountID, &groupID); err != nil {
			return nil, fmt.Errorf("failed to scan membership: %w", err)
		}
		result[accountID] = append(result[accountID], groupID)
	}
	return result, nil
}

// AddToGroup adds an account to a group at an optional position
func (r *MembershipRepository) AddToGroup(accountID, groupID int, position *int) error {
	tx, err := r.db.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	var newPos int
	if position != nil {
		newPos = *position
		// Shift accounts at or after the target position down by 1
		_, err = tx.Exec(`
			UPDATE account_group_memberships
			SET position_in_group = position_in_group + 1
			WHERE group_id = $1 AND position_in_group >= $2 AND account_id != $3
		`, groupID, newPos, accountID)
		if err != nil {
			return fmt.Errorf("failed to shift positions: %w", err)
		}
	} else {
		// Default to end of list
		var maxPos sql.NullInt64
		err := tx.QueryRow("SELECT MAX(position_in_group) FROM account_group_memberships WHERE group_id = $1", groupID).Scan(&maxPos)
		if err != nil {
			return fmt.Errorf("failed to get max position: %w", err)
		}
		newPos = 1
		if maxPos.Valid {
			newPos = int(maxPos.Int64) + 1
		}
	}

	// Insert the membership (use ON CONFLICT to handle duplicates gracefully)
	_, err = tx.Exec(`
		INSERT INTO account_group_memberships (account_id, group_id, position_in_group)
		VALUES ($1, $2, $3)
		ON CONFLICT (account_id, group_id) DO UPDATE SET position_in_group = $3
	`, accountID, groupID, newPos)
	if err != nil {
		return fmt.Errorf("failed to add membership: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}
	return nil
}

// RemoveFromGroup removes an account from a specific group
func (r *MembershipRepository) RemoveFromGroup(accountID, groupID int) error {
	_, err := r.db.Exec(`
		DELETE FROM account_group_memberships
		WHERE account_id = $1 AND group_id = $2
	`, accountID, groupID)
	if err != nil {
		return fmt.Errorf("failed to remove membership: %w", err)
	}
	return nil
}

// MoveGroup handles drag operation: remove from source, add to destination
func (r *MembershipRepository) MoveGroup(accountID int, sourceGroupID *int, destGroupID int, position *int) error {
	tx, err := r.db.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// Remove from source group if specified
	if sourceGroupID != nil {
		_, err = tx.Exec(`
			DELETE FROM account_group_memberships
			WHERE account_id = $1 AND group_id = $2
		`, accountID, *sourceGroupID)
		if err != nil {
			return fmt.Errorf("failed to remove from source group: %w", err)
		}
	}

	// Add to destination group
	var newPos int
	if position != nil {
		newPos = *position
		// Shift accounts at or after the target position
		_, err = tx.Exec(`
			UPDATE account_group_memberships
			SET position_in_group = position_in_group + 1
			WHERE group_id = $1 AND position_in_group >= $2 AND account_id != $3
		`, destGroupID, newPos, accountID)
		if err != nil {
			return fmt.Errorf("failed to shift positions: %w", err)
		}
	} else {
		var maxPos sql.NullInt64
		err := tx.QueryRow("SELECT MAX(position_in_group) FROM account_group_memberships WHERE group_id = $1", destGroupID).Scan(&maxPos)
		if err != nil {
			return fmt.Errorf("failed to get max position: %w", err)
		}
		newPos = 1
		if maxPos.Valid {
			newPos = int(maxPos.Int64) + 1
		}
	}

	_, err = tx.Exec(`
		INSERT INTO account_group_memberships (account_id, group_id, position_in_group)
		VALUES ($1, $2, $3)
		ON CONFLICT (account_id, group_id) DO UPDATE SET position_in_group = $3
	`, accountID, destGroupID, newPos)
	if err != nil {
		return fmt.Errorf("failed to add to destination group: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}
	return nil
}

// SetGroupMemberships replaces all group memberships for an account
func (r *MembershipRepository) SetGroupMemberships(accountID int, groupIDs []int) error {
	tx, err := r.db.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// Delete all existing memberships
	_, err = tx.Exec("DELETE FROM account_group_memberships WHERE account_id = $1", accountID)
	if err != nil {
		return fmt.Errorf("failed to delete existing memberships: %w", err)
	}

	// Add new memberships
	for _, groupID := range groupIDs {
		// Get max position for this group
		var maxPos sql.NullInt64
		err := tx.QueryRow("SELECT MAX(position_in_group) FROM account_group_memberships WHERE group_id = $1", groupID).Scan(&maxPos)
		if err != nil {
			return fmt.Errorf("failed to get max position: %w", err)
		}
		newPos := 1
		if maxPos.Valid {
			newPos = int(maxPos.Int64) + 1
		}

		_, err = tx.Exec(`
			INSERT INTO account_group_memberships (account_id, group_id, position_in_group)
			VALUES ($1, $2, $3)
		`, accountID, groupID, newPos)
		if err != nil {
			return fmt.Errorf("failed to add membership to group %d: %w", groupID, err)
		}
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}
	return nil
}

// UpdatePositionInGroup updates an account's position within a specific group
func (r *MembershipRepository) UpdatePositionInGroup(accountID, groupID, position int) error {
	_, err := r.db.Exec(`
		UPDATE account_group_memberships
		SET position_in_group = $1
		WHERE account_id = $2 AND group_id = $3
	`, position, accountID, groupID)
	if err != nil {
		return fmt.Errorf("failed to update position: %w", err)
	}
	return nil
}

// UpdatePositionsInGroup updates multiple account positions within a group
func (r *MembershipRepository) UpdatePositionsInGroup(groupID int, positions []struct{ AccountID, Position int }) error {
	tx, err := r.db.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	for _, pos := range positions {
		_, err := tx.Exec(`
			UPDATE account_group_memberships
			SET position_in_group = $1
			WHERE account_id = $2 AND group_id = $3
		`, pos.Position, pos.AccountID, groupID)
		if err != nil {
			return fmt.Errorf("failed to update position for account %d: %w", pos.AccountID, err)
		}
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}
	return nil
}
