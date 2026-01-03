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

// BuildReverseDependencyMap returns a map of accountID -> accounts that depend on it.
// If account A depends on account B, the map will contain B -> [A].
func BuildReverseDependencyMap(allAccounts []models.Account) map[int][]int {
	reverseMap := make(map[int][]int)

	for _, account := range allAccounts {
		if account.IsCalculated && len(account.Formula) > 0 {
			for _, item := range account.Formula {
				reverseMap[item.AccountID] = append(reverseMap[item.AccountID], account.ID)
			}
		}
	}

	return reverseMap
}

// FindTransitiveDependents finds all accounts that transitively depend on accountID.
// Returns them in topological order (dependencies resolved before dependents).
func FindTransitiveDependents(accountID int, allAccounts []models.Account) []int {
	reverseMap := BuildReverseDependencyMap(allAccounts)

	// BFS to find all transitive dependents
	visited := make(map[int]bool)
	var dependents []int
	queue := []int{accountID}

	for len(queue) > 0 {
		current := queue[0]
		queue = queue[1:]

		for _, depID := range reverseMap[current] {
			if !visited[depID] {
				visited[depID] = true
				dependents = append(dependents, depID)
				queue = append(queue, depID)
			}
		}
	}

	if len(dependents) == 0 {
		return nil
	}

	// Build dependency graph for topological sort
	// We need: accountID -> list of account IDs it depends on
	graph := make(map[int][]int)
	accountSet := make(map[int]bool)
	for _, id := range dependents {
		accountSet[id] = true
	}

	for _, account := range allAccounts {
		if accountSet[account.ID] && account.IsCalculated && len(account.Formula) > 0 {
			for _, item := range account.Formula {
				graph[account.ID] = append(graph[account.ID], item.AccountID)
			}
		}
	}

	// Topological sort using Kahn's algorithm
	// Calculate in-degrees (only counting edges within our dependent set)
	inDegree := make(map[int]int)
	for _, id := range dependents {
		inDegree[id] = 0
	}
	for _, id := range dependents {
		for _, dep := range graph[id] {
			if accountSet[dep] {
				inDegree[id]++
			}
		}
	}

	// Start with nodes that have no dependencies within the set
	var sortQueue []int
	for _, id := range dependents {
		if inDegree[id] == 0 {
			sortQueue = append(sortQueue, id)
		}
	}

	var sorted []int
	for len(sortQueue) > 0 {
		current := sortQueue[0]
		sortQueue = sortQueue[1:]
		sorted = append(sorted, current)

		// Reduce in-degree for nodes that depend on current
		for _, depID := range reverseMap[current] {
			if accountSet[depID] {
				inDegree[depID]--
				if inDegree[depID] == 0 {
					sortQueue = append(sortQueue, depID)
				}
			}
		}
	}

	return sorted
}
