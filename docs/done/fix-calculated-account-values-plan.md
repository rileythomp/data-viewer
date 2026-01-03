# Fix Calculated Account Values Not Updating

## Problem

When a calculated account (e.g., accountB) references another account (e.g., accountA) via a formula, updating accountA's balance does not update accountB's displayed value.

**Root Cause:** The `current_balance` field for calculated accounts is stored in the database and never recalculated. The formula calculation logic exists for **groups** but not for **accounts**.

## Solution

Compute calculated account balances dynamically when fetching data, rather than relying on the stale `current_balance` stored in the database.

**Approach:** Modify the backend to recalculate account balances based on their formulas when returning account data. Since calculated accounts can reference other calculated accounts (nesting), we need to resolve them in dependency order.

## Implementation Steps

### Step 1: Add helper function to resolve all calculated account balances

File: `backend/internal/repository/account_repo.go`

Create a function `ResolveCalculatedBalances` that:
1. Takes a slice of accounts
2. Builds a dependency graph
3. Resolves balances in topological order (non-calculated first, then calculated accounts whose dependencies are resolved)
4. Updates `CurrentBalance` in-place for calculated accounts

```go
func ResolveCalculatedBalances(accounts []models.Account) {
    // Build map of account ID -> pointer to account
    accountMap := make(map[int]*models.Account)
    for i := range accounts {
        accountMap[accounts[i].ID] = &accounts[i]
    }

    // Iteratively resolve calculated accounts
    // Use multiple passes to handle nested dependencies
    resolved := make(map[int]bool)
    for id, acc := range accountMap {
        if !acc.IsCalculated {
            resolved[id] = true
        }
    }

    maxIterations := len(accounts) // Prevent infinite loop
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
                // Calculate balance
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
            break // No more accounts can be resolved
        }
    }
}
```

### Step 2: Update GetAll in account_repo.go

File: `backend/internal/repository/account_repo.go`

After fetching all accounts, call `ResolveCalculatedBalances(accounts)` before returning.

### Step 3: Update GetByID in account_repo.go

File: `backend/internal/repository/account_repo.go`

For a single account with a formula:
1. Fetch all non-archived accounts to resolve dependencies
2. Call `ResolveCalculatedBalances` on the full list
3. Return the requested account with the computed balance

### Step 4: Update GetGroupedList in account_group_repo.go

File: `backend/internal/repository/account_group_repo.go`

1. Before building the response, fetch all accounts
2. Call `ResolveCalculatedBalances` to compute balances
3. Use the computed balances when building ungrouped accounts and when calling `GetWithAccounts`

### Step 5: Update GetWithAccounts in account_group_repo.go

File: `backend/internal/repository/account_group_repo.go`

1. When fetching accounts for a group, also fetch all accounts to resolve formula references
2. Call `ResolveCalculatedBalances` on the full account list
3. Use the computed balances for accounts in this group

## Files to Modify

1. **`backend/internal/repository/account_repo.go`**
   - Add `ResolveCalculatedBalances()` helper function
   - Update `GetAll()` to call the resolver
   - Update `GetByID()` to compute calculated balance

2. **`backend/internal/repository/account_group_repo.go`**
   - Update `GetGroupedList()` to resolve balances before returning
   - Update `GetWithAccounts()` to resolve balances for group accounts

## Testing

After implementation:
1. Create accountA with balance 100
2. Create accountB (calculated) with formula `1 x accountA` → should show 100
3. Update accountA to 234 → accountB should now show 234
4. Create accountC (calculated) with formula `2 x accountB` → should show 468
5. Update accountA to 100 → accountC should show 200, accountB should show 100
