# Plan: Add Formula Editing to Account Details Edit Page

## Summary
Enable formula editing for accounts from the account details edit page, matching the existing functionality for account groups.

## Current State
- **Backend**: Fully supports account formulas via `PATCH /api/accounts/{id}/formula`
- **Frontend API**: `accountsApi.updateFormula(id, isCalculated, formula)` already exists
- **FormulaDisplay component**: Already reusable with `editable={true}` prop
- **Gap**: `EditAccountModal.jsx` only edits `name` and `info`, not formula

## Implementation

### Step 1: Modify EditAccountModal.jsx
Add formula editing capability following the same pattern as `GroupForm.jsx`:

1. **Add new props**: Accept `accounts` array prop (needed for formula editing)
2. **Add state variables**:
   - `isCalculated` - initialized from `account.is_calculated`
   - `formulaItems` - initialized from `account.formula` (converted to edit format)
3. **Add "Calculated Balance" toggle** (checkbox with Calculator icon)
4. **Add FormulaDisplay** component when `isCalculated` is true
5. **Update handleSubmit** to return formula data to parent

### Step 2: Modify AccountDetail.jsx
Update the parent component to handle formula updates:

1. **Update handleUpdateAccount** function:
   - Accept `isCalculated` and `formula` parameters
   - Call `accountsApi.updateFormula()` when formula data is provided
2. **Pass allAccounts** to EditAccountModal
3. **Filter accounts** to exclude the current account from formula options (prevent self-reference)

## Files to Modify
1. [EditAccountModal.jsx](frontend/src/components/EditAccountModal.jsx) - Add formula editing UI
2. [AccountDetail.jsx](frontend/src/components/AccountDetail.jsx) - Pass accounts prop and handle formula API call

## Key Code Patterns (from GroupForm.jsx)

### Formula state initialization:
```jsx
const [formulaItems, setFormulaItems] = useState(() => {
  if (initialData?.formula && Array.isArray(initialData.formula)) {
    return initialData.formula.map(item => ({
      accountId: item.account_id,
      accountName: accounts?.find(a => a.id === item.account_id)?.account_name || 'Unknown',
      coefficient: item.coefficient
    }));
  }
  return [];
});
```

### Formula toggle UI:
```jsx
<div className="toggle-row">
  <div className="toggle-label-content">
    <Calculator size={18} className="toggle-icon" />
    <span className="toggle-text">Calculated Balance</span>
  </div>
  <label className="toggle-switch">
    <input type="checkbox" checked={isCalculated} onChange={...} />
    <span className="toggle-slider"></span>
  </label>
</div>
```

### Formula editor:
```jsx
{isCalculated && (
  <FormulaDisplay
    formulaItems={formulaItems}
    accounts={accounts}
    editable={true}
    onChange={setFormulaItems}
  />
)}
```

## Validation
- If `isCalculated` is true, require at least one formula item (same as GroupForm)
- Exclude current account from available formula options to prevent circular references
