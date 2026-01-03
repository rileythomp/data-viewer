# Plan: Configurable Total Formula

## Overview
Allow the "Total" value on the main page to be defined by a formula that references both account and group values with coefficients.

## User Requirements
- **Formula type**: Reference-based (coefficients with account/group IDs)
- **Configuration**: Settings modal accessible from main page

## Implementation Steps

### 1. Database Migration
Create `/migrations/007_add_total_formula_settings.sql`:
- New `app_settings` table (key-value with JSONB)
- Store total formula config under key `total_formula`

### 2. Backend Models
Create `/backend/internal/models/settings.go`:
- `TotalFormulaItem` struct: `{ID, Type ("account"|"group"), Coefficient}`
- `TotalFormulaConfig` struct: `{IsEnabled, Formula[]}`

Update `/backend/internal/models/account_group.go`:
- Add `TotalFormulaConfig` to `GroupedAccountsResponse`

### 3. Backend Repository
Create `/backend/internal/repository/settings_repo.go`:
- `GetTotalFormula()` - fetch config from app_settings
- `UpdateTotalFormula()` - persist config

Update `/backend/internal/repository/account_group_repo.go`:
- Modify `GetGroupedList()` to use formula when enabled
- Add `calculateFormulaTotal()` helper that handles both account and group references

### 4. Backend API
Create `/backend/internal/handlers/settings.go`:
- `GET /api/settings/total-formula`
- `PATCH /api/settings/total-formula`

Update `/backend/internal/router/router.go`:
- Register new settings routes

### 5. Frontend API
Update `/frontend/src/services/api.js`:
- Add `settingsApi.getTotalFormula()`
- Add `settingsApi.updateTotalFormula()`

### 6. Frontend Components
Create `/frontend/src/components/TotalFormulaDisplay.jsx`:
- Extend FormulaDisplay pattern to support both accounts AND groups
- Type selector (account/group) + dynamic dropdown
- Display type badges for clarity

Create `/frontend/src/components/SettingsModal.jsx`:
- Toggle for "Use custom Total formula"
- TotalFormulaDisplay in editable mode
- Save/Cancel actions

### 7. Main Page Integration
Update `/frontend/src/components/AccountList.jsx`:
- Add settings icon button next to Total display
- Integrate SettingsModal
- Refresh data on save

### 8. Styling
Update `/frontend/src/App.css`:
- Settings button styles
- Formula type badges (account vs group)

## Key Files to Modify
- `/migrations/007_add_total_formula_settings.sql` (new)
- `/backend/internal/models/settings.go` (new)
- `/backend/internal/models/account_group.go`
- `/backend/internal/repository/settings_repo.go` (new)
- `/backend/internal/repository/account_group_repo.go`
- `/backend/internal/handlers/settings.go` (new)
- `/backend/internal/router/router.go`
- `/frontend/src/services/api.js`
- `/frontend/src/components/TotalFormulaDisplay.jsx` (new)
- `/frontend/src/components/SettingsModal.jsx` (new)
- `/frontend/src/components/AccountList.jsx`
- `/frontend/src/App.css`

## Edge Cases
- Empty formula: fall back to default calculation (sum all)
- Deleted account/group in formula: skip that item
- Archived items: filter from selection dropdown
