package validation

import (
	"fmt"

	"finance-tracker/internal/models"
)

// ValidateFormulaForCycles checks if adding/updating a formula would create a circular dependency.
// accountID: The ID of the account being created/updated (0 for new accounts)
// formula: The proposed formula for this account
// allAccounts: All existing accounts in the system
// Returns an error if a cycle is detected, nil otherwise
func ValidateFormulaForCycles(accountID int, formula []models.FormulaItem, allAccounts []models.Account) error {
	// Build dependency graph: accountID -> list of account IDs it depends on
	graph := make(map[int][]int)
	accountNames := make(map[int]string)

	for _, account := range allAccounts {
		accountNames[account.ID] = account.AccountName
		if account.IsCalculated && len(account.Formula) > 0 {
			deps := make([]int, 0, len(account.Formula))
			for _, item := range account.Formula {
				deps = append(deps, item.AccountID)
			}
			graph[account.ID] = deps
		}
	}

	// Check each account in the proposed formula
	for _, item := range formula {
		// Self-reference check
		if item.AccountID == accountID && accountID != 0 {
			return fmt.Errorf("circular dependency: account cannot reference itself")
		}

		// For new accounts (accountID == 0), we only need to check self-reference
		// which isn't possible since we don't have an ID yet
		if accountID == 0 {
			continue
		}

		// DFS to detect if this dependency can reach back to accountID
		visited := make(map[int]bool)
		path := []int{item.AccountID}

		if canReach(item.AccountID, accountID, graph, visited, &path) {
			// Build the cycle path for error message
			cyclePath := accountNames[accountID] + " -> " + accountNames[item.AccountID]
			for i := 0; i < len(path)-1; i++ {
				cyclePath += " -> " + accountNames[path[i]]
			}
			cyclePath += " -> " + accountNames[accountID]
			return fmt.Errorf("circular dependency detected: %s", cyclePath)
		}
	}

	return nil
}

// canReach uses DFS to determine if 'from' can reach 'target' through the dependency graph
func canReach(from, target int, graph map[int][]int, visited map[int]bool, path *[]int) bool {
	if from == target {
		return true
	}
	if visited[from] {
		return false
	}
	visited[from] = true

	deps := graph[from]
	for _, dep := range deps {
		*path = append(*path, dep)
		if canReach(dep, target, graph, visited, path) {
			return true
		}
		*path = (*path)[:len(*path)-1]
	}

	return false
}
