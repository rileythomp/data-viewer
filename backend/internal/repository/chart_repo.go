package repository

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"time"

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

// getDatasetTableName retrieves the fully qualified table name for a dataset
func (r *ChartRepository) getDatasetTableName(datasetID int) (string, error) {
	var tableName, datasetName string
	err := r.db.QueryRow("SELECT COALESCE(table_name, ''), name FROM datasets WHERE id = $1", datasetID).Scan(&tableName, &datasetName)
	if err == sql.ErrNoRows {
		return "", fmt.Errorf("dataset not found")
	}
	if err != nil {
		return "", err
	}
	// If table_name is not set (legacy dataset), generate it from the name
	if tableName == "" {
		tableName = sanitizeTableName(datasetName)
	}
	return fmt.Sprintf("dataset_data.%s", tableName), nil
}

// sanitizeTableName converts a dataset name to a valid PostgreSQL table name
func sanitizeTableName(name string) string {
	result := strings.ToLower(name)
	result = strings.ReplaceAll(result, " ", "_")
	result = strings.ReplaceAll(result, "-", "_")
	result = strings.ReplaceAll(result, ".", "_")

	var sb strings.Builder
	for _, c := range result {
		if (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c == '_' {
			sb.WriteRune(c)
		}
	}
	result = sb.String()

	for strings.Contains(result, "__") {
		result = strings.ReplaceAll(result, "__", "_")
	}
	result = strings.Trim(result, "_")

	if result == "" {
		result = "dataset"
	}
	if len(result) > 0 && result[0] >= '0' && result[0] <= '9' {
		result = "ds_" + result
	}
	return result
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
		SELECT id, name, description, position, default_chart_type, created_at, updated_at
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
		if err := rows.Scan(&c.ID, &c.Name, &c.Description, &c.Position, &c.DefaultChartType, &c.CreatedAt, &c.UpdatedAt); err != nil {
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
		SELECT id, name, description, position, default_chart_type, created_at, updated_at
		FROM charts
		WHERE id = $1
	`
	var c models.Chart
	err := r.db.QueryRow(query, id).Scan(&c.ID, &c.Name, &c.Description, &c.Position, &c.DefaultChartType, &c.CreatedAt, &c.UpdatedAt)
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

	// Check if this is a dataset-based chart
	datasetCfg, err := r.getDatasetConfig(id)
	if err != nil {
		return nil, err
	}

	if datasetCfg != nil {
		// Dataset mode
		return r.getDatasetChartData(chart, datasetCfg)
	}

	// Accounts/Groups mode (existing logic)
	return r.getAccountsGroupsChartData(chart)
}

func (r *ChartRepository) getAccountsGroupsChartData(chart *models.Chart) (*models.ChartWithItems, error) {
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
	itemRows, err := r.db.Query(itemsQuery, chart.ID)
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
		DataSource:   "accounts_groups",
		Items:        items,
		TotalBalance: totalBalance,
		PieData:      pieData,
	}, nil
}

// getDatasetConfig fetches dataset configuration for a chart
func (r *ChartRepository) getDatasetConfig(chartID int) (*models.ChartDatasetConfig, error) {
	query := `
		SELECT id, chart_id, dataset_id, chart_type,
		       COALESCE(x_column, ''), COALESCE(y_columns, '[]'),
		       COALESCE(aggregation_field, ''), COALESCE(aggregation_value, ''),
		       COALESCE(aggregation_operator, ''),
		       created_at, updated_at
		FROM chart_dataset_config
		WHERE chart_id = $1
	`
	var cfg models.ChartDatasetConfig
	var yColumnsJSON []byte

	err := r.db.QueryRow(query, chartID).Scan(
		&cfg.ID, &cfg.ChartID, &cfg.DatasetID, &cfg.ChartType,
		&cfg.XColumn, &yColumnsJSON,
		&cfg.AggregationField, &cfg.AggregationValue, &cfg.AggregationOperator,
		&cfg.CreatedAt, &cfg.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get dataset config: %w", err)
	}

	json.Unmarshal(yColumnsJSON, &cfg.YColumns)
	return &cfg, nil
}

// getDatasetChartData returns chart data for dataset-based charts
func (r *ChartRepository) getDatasetChartData(chart *models.Chart, cfg *models.ChartDatasetConfig) (*models.ChartWithItems, error) {
	result := &models.ChartWithItems{
		Chart:         *chart,
		DataSource:    "dataset",
		DatasetConfig: cfg,
	}

	// Get dataset name
	var datasetName string
	err := r.db.QueryRow("SELECT name FROM datasets WHERE id = $1", cfg.DatasetID).Scan(&datasetName)
	if err != nil && err != sql.ErrNoRows {
		return nil, fmt.Errorf("failed to get dataset name: %w", err)
	}
	result.DatasetName = datasetName

	// Compute chart data based on type
	if cfg.ChartType == "pie" {
		pieData, err := r.computeDatasetPieData(cfg)
		if err != nil {
			return nil, err
		}
		result.DatasetPieData = pieData
	} else if cfg.ChartType == "line" {
		lineData, err := r.computeDatasetLineData(cfg)
		if err != nil {
			return nil, err
		}
		result.DatasetLineData = lineData
	}

	return result, nil
}

// computeDatasetPieData runs aggregation query for pie chart
func (r *ChartRepository) computeDatasetPieData(cfg *models.ChartDatasetConfig) (*models.DatasetPieChartData, error) {
	// Get the table name from the dataset
	tableName, err := r.getDatasetTableName(cfg.DatasetID)
	if err != nil {
		return nil, fmt.Errorf("failed to get dataset table name: %w", err)
	}

	// Sanitize column names
	fieldCol := sanitizeColumnName(cfg.AggregationField)
	valueCol := sanitizeColumnName(cfg.AggregationValue)

	var aggFunc string
	if cfg.AggregationOperator == "COUNT" {
		aggFunc = fmt.Sprintf("COUNT(%s)", valueCol)
	} else {
		// Default to SUM, cast to numeric for proper aggregation
		aggFunc = fmt.Sprintf("COALESCE(SUM(CAST(NULLIF(%s, '') AS NUMERIC)), 0)", valueCol)
	}

	query := fmt.Sprintf(`
		SELECT %s as label, %s as value
		FROM %s
		WHERE %s IS NOT NULL AND %s != ''
		GROUP BY %s
		ORDER BY value DESC
	`, fieldCol, aggFunc, tableName, fieldCol, fieldCol, fieldCol)

	rows, err := r.db.Query(query)
	if err != nil {
		return nil, fmt.Errorf("aggregation query failed: %w", err)
	}
	defer rows.Close()

	var items []models.DatasetPieChartItem
	var total float64
	colorIndex := 0

	for rows.Next() {
		var label string
		var value float64
		if err := rows.Scan(&label, &value); err != nil {
			return nil, fmt.Errorf("failed to scan aggregation row: %w", err)
		}
		items = append(items, models.DatasetPieChartItem{
			Label: label,
			Value: value,
			Color: accountColors[colorIndex%len(accountColors)],
		})
		total += value
		colorIndex++
	}

	return &models.DatasetPieChartData{
		Items: items,
		Total: total,
	}, nil
}

// sortXValues returns indices that would sort xValues, trying numeric/date first, then alphabetic
func sortXValues(xValues []string) []int {
	indices := make([]int, len(xValues))
	for i := range indices {
		indices[i] = i
	}

	if len(xValues) == 0 {
		return indices
	}

	// Try to parse all values as numbers
	allNumeric := true
	numericVals := make([]float64, len(xValues))
	for i, v := range xValues {
		n, err := strconv.ParseFloat(v, 64)
		if err != nil {
			allNumeric = false
			break
		}
		numericVals[i] = n
	}

	if allNumeric {
		sort.Slice(indices, func(i, j int) bool {
			return numericVals[indices[i]] < numericVals[indices[j]]
		})
		return indices
	}

	// Try to parse all values as dates (common formats)
	dateFormats := []string{
		"2006-01-02",
		"01/02/2006",
		"02/01/2006",
		"Jan 2006",
		"January 2006",
		"2006-01",
		"01-2006",
		"2006",
	}

	for _, format := range dateFormats {
		allDates := true
		dateVals := make([]time.Time, len(xValues))
		for i, v := range xValues {
			t, err := time.Parse(format, v)
			if err != nil {
				allDates = false
				break
			}
			dateVals[i] = t
		}

		if allDates {
			sort.Slice(indices, func(i, j int) bool {
				return dateVals[indices[i]].Before(dateVals[indices[j]])
			})
			return indices
		}
	}

	// Fallback to alphabetic sort
	sort.Slice(indices, func(i, j int) bool {
		return xValues[indices[i]] < xValues[indices[j]]
	})
	return indices
}

// computeDatasetLineData retrieves data for line chart
func (r *ChartRepository) computeDatasetLineData(cfg *models.ChartDatasetConfig) (*models.DatasetLineChartData, error) {
	// Get the table name from the dataset
	tableName, err := r.getDatasetTableName(cfg.DatasetID)
	if err != nil {
		return nil, fmt.Errorf("failed to get dataset table name: %w", err)
	}

	xCol := sanitizeColumnName(cfg.XColumn)

	// Build column list for query
	selectCols := []string{xCol}
	for _, yCol := range cfg.YColumns {
		selectCols = append(selectCols, sanitizeColumnName(yCol))
	}

	query := fmt.Sprintf(`
		SELECT %s
		FROM %s
	`, strings.Join(selectCols, ", "), tableName)

	rows, err := r.db.Query(query)
	if err != nil {
		return nil, fmt.Errorf("line chart query failed: %w", err)
	}
	defer rows.Close()

	var xValues []string
	seriesData := make([][]float64, len(cfg.YColumns))
	for i := range seriesData {
		seriesData[i] = []float64{}
	}

	for rows.Next() {
		values := make([]interface{}, len(selectCols))
		valuePtrs := make([]interface{}, len(selectCols))
		for i := range values {
			valuePtrs[i] = &values[i]
		}

		if err := rows.Scan(valuePtrs...); err != nil {
			return nil, fmt.Errorf("failed to scan line chart row: %w", err)
		}

		// First column is X value
		switch v := values[0].(type) {
		case []byte:
			xValues = append(xValues, string(v))
		case string:
			xValues = append(xValues, v)
		default:
			xValues = append(xValues, fmt.Sprintf("%v", v))
		}

		// Remaining columns are Y values
		for i := 1; i < len(values); i++ {
			var yVal float64
			switch v := values[i].(type) {
			case []byte:
				yVal, _ = strconv.ParseFloat(string(v), 64)
			case float64:
				yVal = v
			case int64:
				yVal = float64(v)
			case string:
				yVal, _ = strconv.ParseFloat(v, 64)
			}
			seriesData[i-1] = append(seriesData[i-1], yVal)
		}
	}

	// Sort data: try numeric first, then date, then alphabetically
	sortedIndices := sortXValues(xValues)
	sortedXValues := make([]string, len(xValues))
	sortedSeriesData := make([][]float64, len(cfg.YColumns))
	for i := range sortedSeriesData {
		sortedSeriesData[i] = make([]float64, len(xValues))
	}
	for newIdx, oldIdx := range sortedIndices {
		sortedXValues[newIdx] = xValues[oldIdx]
		for seriesIdx := range seriesData {
			sortedSeriesData[seriesIdx][newIdx] = seriesData[seriesIdx][oldIdx]
		}
	}

	// Build series response
	series := make([]models.DatasetLineChartSeries, len(cfg.YColumns))
	for i, col := range cfg.YColumns {
		series[i] = models.DatasetLineChartSeries{
			Column: col,
			Color:  accountColors[i%len(accountColors)],
			Values: sortedSeriesData[i],
		}
	}

	return &models.DatasetLineChartData{
		XColumn: cfg.XColumn,
		XValues: sortedXValues,
		Series:  series,
	}, nil
}

// saveDatasetConfig saves or updates dataset configuration for a chart
func (r *ChartRepository) saveDatasetConfig(tx *sql.Tx, chartID int, cfg *models.ChartDatasetConfigInput) error {
	// Delete any existing chart_items (switching from accounts/groups to dataset)
	_, err := tx.Exec("DELETE FROM chart_items WHERE chart_id = $1", chartID)
	if err != nil {
		return fmt.Errorf("failed to clear chart items: %w", err)
	}

	yColumnsJSON, _ := json.Marshal(cfg.YColumns)

	// Convert empty strings to nil for nullable fields
	var xColumn, aggregationField, aggregationValue, aggregationOperator interface{}
	if cfg.XColumn != "" {
		xColumn = cfg.XColumn
	}
	if cfg.AggregationField != "" {
		aggregationField = cfg.AggregationField
	}
	if cfg.AggregationValue != "" {
		aggregationValue = cfg.AggregationValue
	}
	if cfg.AggregationOperator != "" {
		aggregationOperator = cfg.AggregationOperator
	}

	query := `
		INSERT INTO chart_dataset_config
			(chart_id, dataset_id, chart_type, x_column, y_columns,
			 aggregation_field, aggregation_value, aggregation_operator)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		ON CONFLICT (chart_id) DO UPDATE SET
			dataset_id = EXCLUDED.dataset_id,
			chart_type = EXCLUDED.chart_type,
			x_column = EXCLUDED.x_column,
			y_columns = EXCLUDED.y_columns,
			aggregation_field = EXCLUDED.aggregation_field,
			aggregation_value = EXCLUDED.aggregation_value,
			aggregation_operator = EXCLUDED.aggregation_operator,
			updated_at = NOW()
	`
	_, err = tx.Exec(query, chartID, cfg.DatasetID, cfg.ChartType,
		xColumn, yColumnsJSON,
		aggregationField, aggregationValue, aggregationOperator)
	if err != nil {
		return fmt.Errorf("failed to save dataset config: %w", err)
	}

	return nil
}

// clearDatasetConfig removes dataset configuration when switching to accounts/groups mode
func (r *ChartRepository) clearDatasetConfig(tx *sql.Tx, chartID int) error {
	_, err := tx.Exec("DELETE FROM chart_dataset_config WHERE chart_id = $1", chartID)
	return err
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
		INSERT INTO charts (name, description, position, default_chart_type)
		VALUES ($1, $2, $3, $4)
		RETURNING id, name, description, position, default_chart_type, created_at, updated_at
	`
	defaultChartType := req.DefaultChartType
	if defaultChartType == "" {
		defaultChartType = "pie" // Default to pie for accounts/groups charts
	}
	var c models.Chart
	err = tx.QueryRow(query, req.Name, req.Description, newPos, defaultChartType).Scan(
		&c.ID, &c.Name, &c.Description, &c.Position, &c.DefaultChartType, &c.CreatedAt, &c.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create chart: %w", err)
	}

	// Determine mode and save appropriate config
	if req.DatasetConfig != nil {
		// Dataset mode
		if err := r.saveDatasetConfig(tx, c.ID, req.DatasetConfig); err != nil {
			return nil, fmt.Errorf("failed to save dataset config: %w", err)
		}
	} else {
		// Accounts/Groups mode (existing logic)
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
	// If default_chart_type is provided, update it; otherwise keep existing value
	var query string
	var c models.Chart

	if req.DefaultChartType != "" {
		query = `
			UPDATE charts
			SET name = $1, description = $2, default_chart_type = $3, updated_at = NOW()
			WHERE id = $4
			RETURNING id, name, description, position, default_chart_type, created_at, updated_at
		`
		err = tx.QueryRow(query, req.Name, req.Description, req.DefaultChartType, id).Scan(
			&c.ID, &c.Name, &c.Description, &c.Position, &c.DefaultChartType, &c.CreatedAt, &c.UpdatedAt,
		)
	} else {
		query = `
			UPDATE charts
			SET name = $1, description = $2, updated_at = NOW()
			WHERE id = $3
			RETURNING id, name, description, position, default_chart_type, created_at, updated_at
		`
		err = tx.QueryRow(query, req.Name, req.Description, id).Scan(
			&c.ID, &c.Name, &c.Description, &c.Position, &c.DefaultChartType, &c.CreatedAt, &c.UpdatedAt,
		)
	}
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to update chart: %w", err)
	}

	// Determine mode and save appropriate config
	if req.DatasetConfig != nil {
		// Dataset mode - saves dataset config and clears chart_items
		if err := r.saveDatasetConfig(tx, id, req.DatasetConfig); err != nil {
			return nil, fmt.Errorf("failed to save dataset config: %w", err)
		}
	} else {
		// Accounts/Groups mode - clear any dataset config and update items
		if err := r.clearDatasetConfig(tx, id); err != nil {
			return nil, fmt.Errorf("failed to clear dataset config: %w", err)
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
