# Plan: Dropdown Selection for Chart Accounts/Groups

Replace checkbox lists with multi-select dropdown components for selecting accounts and groups on the chart creation and edit pages, improving UX for users with many accounts/groups.

## Current Implementation

- **State**: `selectedAccounts` and `selectedGroups` arrays store selected IDs
- **UI**: Checkbox list in `.item-selection` container with 300px max-height scroll
- **Files**: `ChartCreate.jsx`, `ChartDetail.jsx` (also `DashboardCreate.jsx`, `DashboardDetail.jsx`)
- **Backend**: No changes needed - already accepts `account_ids` and `group_ids` arrays

## Steps

### 1. Create MultiSelectDropdown Component

Create a reusable `MultiSelectDropdown` component in `frontend/src/components/MultiSelectDropdown.jsx`:

- Props: `items`, `selectedIds`, `onChange`, `placeholder`, `labelKey`, `renderOption` (for custom rendering like group color dots)
- Features:
  - Dropdown trigger showing selected count or placeholder
  - Searchable options list
  - Selected items displayed as removable "chips"
  - Click outside to close

### 2. Add Component Styles

Create `frontend/src/components/MultiSelectDropdown.css`:

- Dropdown trigger button styling
- Floating options list with max-height scroll
- Search input styling
- Selected chips with remove button
- Option hover/selected states
- Group color dot support

### 3. Update ChartCreate.jsx

Replace the checkbox `.item-selection` sections (~lines 280-330) with `MultiSelectDropdown`:

```jsx
// Before (checkboxes)
<div className="item-selection">
  {accounts.map((account) => (
    <label key={account.id} className="item-checkbox">
      <input type="checkbox" ... />
      <span>{account.account_name}</span>
    </label>
  ))}
</div>

// After (dropdown)
<MultiSelectDropdown
  items={accounts}
  selectedIds={selectedAccounts}
  onChange={setSelectedAccounts}
  placeholder="Select accounts..."
  labelKey="account_name"
/>
```

### 4. Update ChartDetail.jsx

Replace edit-mode checkbox lists with `MultiSelectDropdown` components, maintaining the same selection state pattern used for inline editing.

### 5. (Optional) Update Dashboard Components

Apply the same pattern to `DashboardCreate.jsx` and `DashboardDetail.jsx` for consistency.

## Design Decisions

| Decision | Recommendation | Rationale |
|----------|---------------|-----------|
| Third-party vs custom | Custom component | Keeps dependencies minimal, matches codebase style |
| Separate vs combined dropdowns | Separate (accounts/groups) | Maintains current mental model, clearer labeling |
| Show group colors | Yes, in dropdown options and chips | Preserves existing visual indicator |

## Files to Create/Modify

- [ ] `frontend/src/components/MultiSelectDropdown.jsx` (new)
- [ ] `frontend/src/components/MultiSelectDropdown.css` (new)
- [ ] `frontend/src/components/ChartCreate.jsx` (modify)
- [ ] `frontend/src/components/ChartDetail.jsx` (modify)
- [ ] `frontend/src/components/DashboardCreate.jsx` (optional)
- [ ] `frontend/src/components/DashboardDetail.jsx` (optional)
