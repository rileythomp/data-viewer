# Plan: Settings Page with Accounts & Groups Management

## Summary

Add a settings page accessible via a gear icon in the nav bar. The settings page has two views (Accounts and Account Groups) showing alphabetically sorted lists including archived items. Users can drill down to existing detail pages and archive/unarchive or permanently delete items.

## Key Behavior Decisions

- **Access**: Gear icon beside theme toggle in NavBar
- **Views**: Tab navigation between "Accounts" and "Groups"
- **Sorting**: Alphabetical by name
- **Archived items**: Displayed with reduced opacity and "Archived" badge
- **Drill down**: Clicking item navigates to existing AccountDetail/GroupDetail pages
- **Delete confirmation**: Requires typing exact name to confirm (safety measure)

---

## Phase 1: Backend Repository Changes

**File**: `backend/internal/repository/account_repo.go`

Add three new methods:
- `GetAllIncludingArchived()` - Returns all accounts (no `WHERE is_archived = false`)
- `Unarchive(id)` - Sets `is_archived = false`, returns updated account
- `Delete(id)` - Transaction: deletes memberships, history, then account

**File**: `backend/internal/repository/account_group_repo.go`

Add three new methods:
- `GetAllIncludingArchived()` - Returns all groups
- `Unarchive(id)` - Sets `is_archived = false`, returns updated group
- `Delete(id)` - Transaction: deletes memberships, then group

---

## Phase 2: Backend Handler Changes

**File**: `backend/internal/handlers/accounts.go`

Add handlers:
- `GetAllIncludingArchived(w, r)` - Returns all accounts including archived
- `Unarchive(w, r)` - Restores archived account
- `Delete(w, r)` - Permanently removes account and related data

**File**: `backend/internal/handlers/account_groups.go`

Add handlers:
- `GetAllIncludingArchived(w, r)` - Returns all groups including archived
- `Unarchive(w, r)` - Restores archived group
- `Delete(w, r)` - Permanently removes group (accounts become ungrouped)

---

## Phase 3: Backend Router Changes

**File**: `backend/internal/router/router.go`

Add new routes (order matters - `/all` before `/{id}`):

```go
// Account routes - add before existing /{id} routes
api.HandleFunc("/accounts/all", accountHandler.GetAllIncludingArchived).Methods("GET")
api.HandleFunc("/accounts/{id}/unarchive", accountHandler.Unarchive).Methods("PATCH")
api.HandleFunc("/accounts/{id}", accountHandler.Delete).Methods("DELETE")

// Group routes - add before existing /{id} routes
api.HandleFunc("/groups/all", groupHandler.GetAllIncludingArchived).Methods("GET")
api.HandleFunc("/groups/{id}/unarchive", groupHandler.Unarchive).Methods("PATCH")
api.HandleFunc("/groups/{id}", groupHandler.Delete).Methods("DELETE")
```

---

## Phase 4: Frontend API Changes

**File**: `frontend/src/services/api.js`

Add to `accountsApi`:
```javascript
getAllIncludingArchived: async () => { /* GET /api/accounts/all */ },
unarchive: async (id) => { /* PATCH /api/accounts/{id}/unarchive */ },
delete: async (id) => { /* DELETE /api/accounts/{id} */ },
```

Add to `groupsApi`:
```javascript
getAllIncludingArchived: async () => { /* GET /api/groups/all */ },
unarchive: async (id) => { /* PATCH /api/groups/{id}/unarchive */ },
delete: async (id) => { /* DELETE /api/groups/{id} */ },
```

---

## Phase 5: Frontend Component Changes

**New file**: `frontend/src/components/DeleteConfirmModal.jsx`

Modal for hard delete confirmation:
- Warning text about permanent deletion
- Input field requiring exact name match
- Submit button disabled until name matches
- Props: `itemName`, `itemType`, `isOpen`, `onConfirm`, `onCancel`

**New file**: `frontend/src/components/SettingsPage.jsx`

Main settings page:
- Tab navigation: "Accounts" | "Groups"
- Fetches all items including archived
- Sorts alphabetically by name
- List items with: clickable name, archived badge, archive/unarchive button, delete button
- Archived items styled with `opacity: 0.6`

**File**: `frontend/src/components/NavBar.jsx`

Update structure:
```jsx
<nav className="navbar">
  <Link to="/" className="navbar-brand">Finance Tracker</Link>
  <div className="navbar-actions">
    <Link to="/settings" className="btn-icon" title="Settings">
      <Settings size={18} />
    </Link>
    <ThemeToggle />
  </div>
</nav>
```

**File**: `frontend/src/App.jsx`

Add route:
```jsx
import SettingsPage from './components/SettingsPage';
// In Routes:
<Route path="/settings" element={<SettingsPage />} />
```

---

## Phase 6: CSS Changes

**File**: `frontend/src/App.css`

Add styles for:
- `.navbar-actions` - flex container for icons
- `.settings-tabs`, `.settings-tab`, `.settings-tab.active` - tab navigation
- `.settings-list-item`, `.settings-list-item-archived` - list items
- `.archived-badge` - small "ARCHIVED" label
- `.delete-warning`, `.delete-confirm-input` - modal styles
- `.btn-danger` - red delete button

---

## Implementation Order

1. Backend repositories (GetAllIncludingArchived, Unarchive, Delete)
2. Backend handlers (3 handlers each for accounts and groups)
3. Backend router (6 new routes)
4. Frontend API service (6 new methods)
5. Frontend DeleteConfirmModal component
6. Frontend SettingsPage component
7. Frontend NavBar update (gear icon)
8. Frontend App.jsx route
9. CSS styles

---

## Critical Files

| Layer | File | Changes |
|-------|------|---------|
| Repo | `backend/internal/repository/account_repo.go` | Add GetAllIncludingArchived, Unarchive, Delete |
| Repo | `backend/internal/repository/account_group_repo.go` | Add GetAllIncludingArchived, Unarchive, Delete |
| Handler | `backend/internal/handlers/accounts.go` | Add 3 handlers |
| Handler | `backend/internal/handlers/account_groups.go` | Add 3 handlers |
| Router | `backend/internal/router/router.go` | Add 6 routes |
| API | `frontend/src/services/api.js` | Add 6 methods |
| UI | `frontend/src/components/DeleteConfirmModal.jsx` | New file |
| UI | `frontend/src/components/SettingsPage.jsx` | New file |
| UI | `frontend/src/components/NavBar.jsx` | Add settings icon |
| UI | `frontend/src/App.jsx` | Add /settings route |
| CSS | `frontend/src/App.css` | Settings page styles |

---

## Data Integrity Notes

- **Deleting an account**: Removes from `account_group_memberships`, `balance_history`, then `account_balances`
- **Deleting a group**: Removes from `account_group_memberships` only (accounts become ungrouped), then `account_groups`
- **Calculated references**: Accounts/groups with formulas referencing deleted items may break (acceptable for now)
