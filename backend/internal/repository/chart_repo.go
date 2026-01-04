package repository

import (
	"database/sql"
	"encoding/json"
	"fmt"

	"finance-tracker/internal/models"
)

// Color palette for accounts (since accounts don't have colors)
var accountColors = []string{
	"#8884d8", "#82ca9d", "#ffc658", "#ff7300", "#00C49F",
	"#FFBB28", "#FF8042", "#0088FE", "#a4de6c", "#d0ed57",
}

type ChartRepository struct {
	db *sql.DB
}

func NewChartRepository(db *sql.DB) *ChartRepository {
	return &ChartRepository{db: db}
}

func (r *ChartRepository) GetAll(page, pageSize int) (*models.ChartListResponse, error) {
	// Get total count
	var total int
	err := r.db.QueryRow("SELECT COUNT(*) FROM charts").Scan(&total)
	if err != nil {
		return nil, fmt.Errorf("failed to count charts: %w", err)
	}

	// Get paginated charts
	offset := (page - 1) * pageSize
	query := `
		SELECT id, name, description, position, created_at, updated_at
		FROM charts
		ORDER BY position ASC, name ASC
		LIMIT $1 OFFSET $2
	`
	rows, err := r.db.Query(query, pageSize, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to query charts: %w", err)
	}
	defer rows.Close()

	var charts []models.ChartWithItems
	for rows.Next() {
		var c models.Chart
		if err := rows.Scan(&c.ID, &c.Name, &c.Description, &c.Position, &c.CreatedAt, &c.UpdatedAt); err != nil {
			return nil, fmt.Errorf("failed to scan chart: %w", err)
		}

		// Get items for this chart
		withItems, err := r.GetWithItems(c.ID)
		if err != nil {
			return nil, fmt.Errorf("failed to get chart items: %w", err)
		}
		charts = append(charts, *withItems)
	}

	return &models.ChartListResponse{
		Charts:   charts,
		Total:    total,
		Page:     page,
		PageSize: pageSize,
	}, nil
}

func (r *ChartRepository) GetByID(id int) (*models.Chart, error) {
	query := `
		SELECT id, name, description, position, created_at, updated_at
		FROM charts
		WHERE id = $1
	`
	var c models.Chart
	err := r.db.QueryRow(query, id).Scan(&c.ID, &c.Name, &c.Description, &c.Position, &c.CreatedAt, &c.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get chart: %w", err)
	}
	return &c, nil
}

func (r *ChartRepository) GetWithItems(id int) (*models.ChartWithItems, error) {
	chart, err := r.GetByID(id)
	if err != nil {
		return nil, err
	}
	if chart == nil {
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

	// Get chart items
	itemsQuery := `
		SELECT id, chart_id, item_type, item_id, position
		FROM chart_items
		WHERE chart_id = $1
		ORDER BY position ASC
	`
	itemRows, err := r.db.Query(itemsQuery, id)
	if err != nil {
		return nil, fmt.Errorf("failed to query chart items: %w", err)
	}
	defer itemRows.Close()

	var items []models.ListItem
	var pieData []models.PieChartDataItem
	var totalBalance float64
	colorIndex := 0

	for itemRows.Next() {
		var ci models.ChartItem
		if err := itemRows.Scan(&ci.ID, &ci.ChartID, &ci.ItemType, &ci.ItemID, &ci.Position); err != nil {
			return nil, fmt.Errorf("failed to scan chart item: %w", err)
		}

		if ci.ItemType == "account" {
			if acc, ok := accountMap[ci.ItemID]; ok {
				items = append(items, models.ListItem{
					Type:    "account",
					Account: acc,
				})
				totalBalance += acc.CurrentBalance

				// Add to pie data
				pieData = append(pieData, models.PieChartDataItem{
					Name:   acc.AccountName,
					Value:  acc.CurrentBalance,
					Color:  accountColors[colorIndex%len(accountColors)],
					Type:   "account",
					ItemID: acc.ID,
				})
				colorIndex++
			}
		} else if ci.ItemType == "group" {
			if group, ok := groupsMap[ci.ItemID]; ok {
				items = append(items, models.ListItem{
					Type:  "group",
					Group: group,
				})
				totalBalance += group.TotalBalance

				// Add to pie data - use group's color
				pieData = append(pieData, models.PieChartDataItem{
					Name:   group.GroupName,
					Value:  group.TotalBalance,
					Color:  group.Color,
					Type:   "group",
					ItemID: group.ID,
				})
			}
		}
	}

	return &models.ChartWithItems{
		Chart:        *chart,
		Items:        items,
		TotalBalance: totalBalance,
		PieData:      pieData,
	}, nil
}

func (r *ChartRepository) getGroupsWithAccounts(accountMap map[int]*models.Account) (map[int]*models.AccountGroupWithAccounts, error) {
	// Get all non-archived groups
	groupsQuery := `
		SELECT id, group_name, group_description, color, position, is_archived, is_calculated, formula, created_at, updated_at
		FROM account_groups
		WHERE is_archived = false
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

func (r *ChartRepository) Create(req *models.CreateChartRequest) (*models.ChartWithItems, error) {
	tx, err := r.db.Begin()
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// Get max position
	var maxPos sql.NullInt64
	err = tx.QueryRow("SELECT MAX(position) FROM charts").Scan(&maxPos)
	if err != nil {
		return nil, fmt.Errorf("failed to get max position: %w", err)
	}
	newPos := 1
	if maxPos.Valid {
		newPos = int(maxPos.Int64) + 1
	}

	// Insert chart
	query := `
		INSERT INTO charts (name, description, position)
		VALUES ($1, $2, $3)
		RETURNING id, name, description, position, created_at, updated_at
	`
	var c models.Chart
	err = tx.QueryRow(query, req.Name, req.Description, newPos).Scan(
		&c.ID, &c.Name, &c.Description, &c.Position, &c.CreatedAt, &c.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create chart: %w", err)
	}

	// Insert items
	position := 0
	for _, accountID := range req.AccountIDs {
		position++
		_, err = tx.Exec(
			"INSERT INTO chart_items (chart_id, item_type, item_id, position) VALUES ($1, $2, $3, $4)",
			c.ID, "account", accountID, position,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to add account to chart: %w", err)
		}
	}
	for _, groupID := range req.GroupIDs {
		position++
		_, err = tx.Exec(
			"INSERT INTO chart_items (chart_id, item_type, item_id, position) VALUES ($1, $2, $3, $4)",
			c.ID, "group", groupID, position,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to add group to chart: %w", err)
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}

	return r.GetWithItems(c.ID)
}

func (r *ChartRepository) Update(id int, req *models.UpdateChartRequest) (*models.ChartWithItems, error) {
	tx, err := r.db.Begin()
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// Update chart metadata
	query := `
		UPDATE charts
		SET name = $1, description = $2, updated_at = NOW()
		WHERE id = $3
		RETURNING id, name, description, position, created_at, updated_at
	`
	var c models.Chart
	err = tx.QueryRow(query, req.Name, req.Description, id).Scan(
		&c.ID, &c.Name, &c.Description, &c.Position, &c.CreatedAt, &c.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to update chart: %w", err)
	}

	// Delete existing items
	_, err = tx.Exec("DELETE FROM chart_items WHERE chart_id = $1", id)
	if err != nil {
		return nil, fmt.Errorf("failed to delete chart items: %w", err)
	}

	// Insert new items
	position := 0
	for _, accountID := range req.AccountIDs {
		position++
		_, err = tx.Exec(
			"INSERT INTO chart_items (chart_id, item_type, item_id, position) VALUES ($1, $2, $3, $4)",
			id, "account", accountID, position,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to add account to chart: %w", err)
		}
	}
	for _, groupID := range req.GroupIDs {
		position++
		_, err = tx.Exec(
			"INSERT INTO chart_items (chart_id, item_type, item_id, position) VALUES ($1, $2, $3, $4)",
			id, "group", groupID, position,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to add group to chart: %w", err)
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}

	return r.GetWithItems(id)
}

func (r *ChartRepository) Delete(id int) error {
	result, err := r.db.Exec("DELETE FROM charts WHERE id = $1", id)
	if err != nil {
		return fmt.Errorf("failed to delete chart: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}
	if rowsAffected == 0 {
		return fmt.Errorf("chart not found")
	}

	return nil
}

func (r *ChartRepository) GetChartHistory(id int) (*models.ChartHistoryResponse, error) {
	// Get chart items
	itemsQuery := `
		SELECT item_type, item_id, position
		FROM chart_items
		WHERE chart_id = $1
		ORDER BY position ASC
	`
	itemRows, err := r.db.Query(itemsQuery, id)
	if err != nil {
		return nil, fmt.Errorf("failed to query chart items: %w", err)
	}
	defer itemRows.Close()

	var series []models.ChartHistorySeries
	colorIndex := 0

	for itemRows.Next() {
		var itemType string
		var itemID, position int
		if err := itemRows.Scan(&itemType, &itemID, &position); err != nil {
			return nil, fmt.Errorf("failed to scan chart item: %w", err)
		}

		if itemType == "account" {
			// Get account info
			var name string
			err := r.db.QueryRow("SELECT account_name FROM account_balances WHERE id = $1", itemID).Scan(&name)
			if err != nil {
				continue // Skip if account not found
			}

			// Get account history
			historyQuery := `
				SELECT recorded_at, balance
				FROM balance_history
				WHERE account_id = $1
				ORDER BY recorded_at ASC
			`
			historyRows, err := r.db.Query(historyQuery, itemID)
			if err != nil {
				return nil, fmt.Errorf("failed to query account history: %w", err)
			}

			var history []models.ChartHistoryEntry
			for historyRows.Next() {
				var recordedAt string
				var balance float64
				if err := historyRows.Scan(&recordedAt, &balance); err != nil {
					historyRows.Close()
					return nil, fmt.Errorf("failed to scan history: %w", err)
				}
				history = append(history, models.ChartHistoryEntry{
					Date:    recordedAt,
					Balance: balance,
				})
			}
			historyRows.Close()

			series = append(series, models.ChartHistorySeries{
				ID:      itemID,
				Name:    name,
				Color:   accountColors[colorIndex%len(accountColors)],
				Type:    "account",
				History: history,
			})
			colorIndex++
		} else if itemType == "group" {
			// Get group info
			var name, color string
			err := r.db.QueryRow("SELECT group_name, color FROM account_groups WHERE id = $1", itemID).Scan(&name, &color)
			if err != nil {
				continue // Skip if group not found
			}

			// Get group history
			historyQuery := `
				SELECT recorded_at, balance
				FROM group_balance_history
				WHERE group_id = $1
				ORDER BY recorded_at ASC
			`
			historyRows, err := r.db.Query(historyQuery, itemID)
			if err != nil {
				return nil, fmt.Errorf("failed to query group history: %w", err)
			}

			var history []models.ChartHistoryEntry
			for historyRows.Next() {
				var recordedAt string
				var balance float64
				if err := historyRows.Scan(&recordedAt, &balance); err != nil {
					historyRows.Close()
					return nil, fmt.Errorf("failed to scan history: %w", err)
				}
				history = append(history, models.ChartHistoryEntry{
					Date:    recordedAt,
					Balance: balance,
				})
			}
			historyRows.Close()

			series = append(series, models.ChartHistorySeries{
				ID:      itemID,
				Name:    name,
				Color:   color,
				Type:    "group",
				History: history,
			})
		}
	}

	return &models.ChartHistoryResponse{
		Series: series,
	}, nil
}
