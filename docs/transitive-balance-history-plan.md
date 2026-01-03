# Plan: Transitive Balance History for Calculated Accounts

## Overview

When a base account's balance changes, all transitively dependent calculated accounts should automatically receive new history records with their formula-derived values.

**Example:** If A depends on B, and B depends on C:
- When C's balance changes → B and A both get new history records
- B's record shows `B.formula(C.new_balance)`
- A's record shows `A.formula(B.new_balance)`

## Requirements (Confirmed)

1. History values for calculated accounts are **formula-derived** (computed from dependencies)
2. Calculated accounts **can have manual overrides** - direct balance updates are allowed
3. History records are **stored immediately** when dependencies change

## Files to Modify

| File | Changes |
|------|---------|
| `backend/internal/validation/formula_validation.go` | Add reverse dependency discovery functions |
| `backend/internal/repository/account_repo.go` | Modify `UpdateBalance()` to propagate history |

## Implementation Steps

### Step 1: Add Reverse Dependency Functions

**File:** `backend/internal/validation/formula_validation.go`

Add two new functions:

```go
// BuildReverseDependencyMap returns: accountID -> accounts that depend on it
// If A depends on B, returns B -> [A]
func BuildReverseDependencyMap(allAccounts []models.Account) map[int][]int

// FindTransitiveDependents finds all accounts that transitively depend on accountID
// Returns them in topological order (dependencies resolved before dependents)
func FindTransitiveDependents(accountID int, allAccounts []models.Account) []int
```

**Logic:**
1. `BuildReverseDependencyMap`: Iterate all calculated accounts, for each formula item, add the calculated account to the reverse map entry for that dependency
2. `FindTransitiveDependents`: BFS from accountID using reverse map, then topologically sort the results

### Step 2: Add Helper Functions to Repository

**File:** `backend/internal/repository/account_repo.go`

Add three helper functions:

```go
// Fetch all accounts within an existing transaction
func (r *AccountRepository) getAllAccountsTx(tx *sql.Tx) ([]models.Account, error)

// Calculate balance from formula using provided balance map
func calculateFormulaBalance(formula []models.FormulaItem, balanceMap map[int]float64) float64

// Batch insert history records efficiently
func (r *AccountRepository) insertHistoryRecordsTx(tx *sql.Tx, entries []HistoryEntry) error
```

### Step 3: Modify UpdateBalance()

**File:** `backend/internal/repository/account_repo.go` (lines 294-358)

After the existing history record insertion (line 338), add:

1. Fetch all accounts within the transaction
2. Call `FindTransitiveDependents(id, allAccounts)` to get dependent accounts in order
3. Build a balance map with the updated account's new balance
4. For each dependent (in topological order):
   - Calculate new balance from formula
   - Update the balance map (for subsequent calculations)
   - Add to history entries list
5. Batch insert all history records

**Key:** All operations happen within the same transaction for atomicity.

## Edge Cases Handled

1. **Manual override of calculated account**: When a calculated account is updated directly, its dependents still get propagated history (this is correct - if B depends on Calculated A and A is manually set, B should update)

2. **Archived accounts**: Skip creating history records for archived accounts, but include them in balance calculations (formulas may reference archived accounts)

3. **Empty formulas**: Skip accounts with empty or nil formulas

4. **Missing dependencies**: If a formula references a deleted account, that term contributes 0 to the calculation (already handled by `calculateFormulaBalance`)

## Transaction Flow

```
BEGIN TRANSACTION
  1. Update primary account balance
  2. Insert history record for primary account
  3. Fetch all accounts (for dependency analysis)
  4. Find transitive dependents in topological order
  5. Calculate new balances for each dependent
  6. Batch insert history records for all dependents
COMMIT
```

## Testing Checklist

- [ ] Single dependency: Update A, verify B (which depends on A) gets history
- [ ] Chain dependency: A → B → C, update A, verify B and C both get correct history
- [ ] Diamond dependency: D depends on B and C, both depend on A. Update A, verify correct propagation
- [ ] Manual override: Update calculated account directly, verify its dependents get history
- [ ] No dependents: Update account with no dependents, verify only that account gets history
- [ ] Transaction rollback: Simulate failure, verify no partial history records
