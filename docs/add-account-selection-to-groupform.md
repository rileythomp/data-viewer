# Plan: Add Account Selection to GroupForm

## Overview
Add the ability to select accounts when creating or editing a group via the GroupForm component. Uses a dropdown + add button pattern (matching FormulaDisplay) where users select accounts from a dropdown, click "Add", and accounts appear in a removable list.

## Files to Modify

| File | Changes |
|------|---------|
| [GroupForm.jsx](frontend/src/components/GroupForm.jsx) | Add account selection state, UI, and handlers |
| [AccountList.jsx](frontend/src/components/AccountList.jsx) | Update handlers and pass `allAccounts` prop |
| [GroupDetail.jsx](frontend/src/components/GroupDetail.jsx) | Fetch all accounts and update handlers |
| [index.css](frontend/src/index.css) | Add styles for account selection UI |

## Implementation Steps

### Step 1: Update GroupForm Component

**Add new prop and state** (lines 16-32):
- Add `allAccounts` prop to receive all available accounts
- Add `selectedAccounts` state (initialized from `initialData.accounts` in edit mode)
- Add `selectedAccountId` state for the dropdown

**Add computed value and handlers**:
```javascript
// Filter to show only ungrouped accounts (or accounts in current group during edit)
const availableAccounts = allAccounts.filter(a => {
  if (selectedAccounts.some(sa => sa.id === a.id)) return false;
  if (!a.group_id) return true;
  if (initialData && a.group_id === initialData.id) return true;
  return false;
});

const handleAddAccount = () => { /* add to selectedAccounts */ };
const handleRemoveAccount = (accountId) => { /* remove from selectedAccounts */ };
```

**Add UI section** after color presets (line 105):
- List of selected accounts with remove buttons
- Dropdown + "Add" button to add accounts
- Import `X` icon from lucide-react

**Update handleSubmit** (line 55):
- Pass `accountIds` array to `onSubmit` callback

### Step 2: Update AccountList - handleCreateGroup

Update function signature and implementation (lines 519-523):
```javascript
const handleCreateGroup = async (name, description, color, isCalculated, formula, accountIds = []) => {
  const newGroup = await groupsApi.create(name, description, color, isCalculated, formula);

  // Associate selected accounts with the new group
  for (let i = 0; i < accountIds.length; i++) {
    await accountsApi.setGroup(accountIds[i], newGroup.id, i + 1);
  }

  await fetchData();
  setShowAddGroupForm(false);
};
```

### Step 3: Update AccountList - handleUpdateGroup

Update function signature and implementation (lines 532-536):
```javascript
const handleUpdateGroup = async (name, description, color, isCalculated, formula, accountIds = []) => {
  await groupsApi.update(editingGroup.id, name, description, color, isCalculated, formula);

  const currentAccountIds = (editingGroup.accounts || []).map(a => a.id);
  const accountsToAdd = accountIds.filter(id => !currentAccountIds.includes(id));
  const accountsToRemove = currentAccountIds.filter(id => !accountIds.includes(id));

  for (const accountId of accountsToRemove) {
    await accountsApi.setGroup(accountId, null);
  }
  for (const accountId of accountsToAdd) {
    await accountsApi.setGroup(accountId, editingGroup.id);
  }

  await fetchData();
  setEditingGroup(null);
};
```

### Step 4: Update AccountList - GroupForm Props

Pass `allAccounts` to both GroupForm usages:
- Create mode (line 597-600): Add `allAccounts={allAccounts}`
- Edit mode (line 676-681): Add `allAccounts={allAccounts}`

### Step 5: Update GroupDetail Component

**Add state and fetch all accounts** (around lines 60-89):
- Add `allAccounts` state
- Modify `fetchGroup` to also fetch all accounts via `accountsApi.getAll()`

**Update handleUpdateGroup** (lines 102-106):
- Same logic as AccountList's handleUpdateGroup to handle additions/removals

**Update GroupForm props** (lines 312-317):
- Add `allAccounts={allAccounts}` prop

### Step 6: Add CSS Styles

Add to `frontend/src/index.css`:
```css
.selected-accounts-list { /* flex column list */ }
.selected-account-item { /* flex row with name and remove button */ }
.account-add-row { /* flex row with dropdown and add button */ }
.account-select { /* dropdown styling */ }
```

## Data Flow

**Create Mode:**
1. User fills form and selects accounts → clicks "Create Group"
2. `handleCreateGroup` creates group, gets new ID
3. Calls `setGroup` for each selected account with the new group ID
4. UI refreshes

**Edit Mode:**
1. Form initializes with current group accounts
2. User adds/removes accounts → clicks "Save Changes"
3. `handleUpdateGroup` compares current vs new account lists
4. Removes accounts no longer in list, adds new accounts
5. UI refreshes

## Notes
- No backend changes needed - uses existing `PATCH /api/accounts/:id/group` endpoint
- Sequential API calls are acceptable for typical use cases
- Works independently of the calculated balance feature
