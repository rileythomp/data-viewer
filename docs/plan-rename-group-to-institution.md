# Plan: Rename "Account Group" to "Institution"

## Overview
Replace all references to "Account Group" / "Group" with "Institution" throughout the codebase, including database schema, backend Go code, frontend React components, and UI text.

## Files to Modify

### Database Migration
- **Create:** `migrations/005_rename_groups_to_institutions.sql`

### Backend (Go)
| Action | Old Path | New Path |
|--------|----------|----------|
| Rename | `backend/internal/models/account_group.go` | `backend/internal/models/institution.go` |
| Rename | `backend/internal/handlers/account_groups.go` | `backend/internal/handlers/institutions.go` |
| Rename | `backend/internal/repository/account_group_repo.go` | `backend/internal/repository/institution_repo.go` |
| Modify | `backend/internal/models/account.go` | (update field names) |
| Modify | `backend/internal/handlers/accounts.go` | (update SetGroup → SetInstitution) |
| Modify | `backend/internal/repository/account_repo.go` | (update SQL and methods) |
| Modify | `backend/internal/router/router.go` | (update routes and variable names) |

### Frontend (React/JS)
| Action | Old Path | New Path |
|--------|----------|----------|
| Rename | `frontend/src/components/GroupCard.jsx` | `frontend/src/components/InstitutionCard.jsx` |
| Rename | `frontend/src/components/GroupDetail.jsx` | `frontend/src/components/InstitutionDetail.jsx` |
| Rename | `frontend/src/components/GroupForm.jsx` | `frontend/src/components/InstitutionForm.jsx` |
| Modify | `frontend/src/components/AccountList.jsx` | (extensive updates) |
| Modify | `frontend/src/components/AccountForm.jsx` | (update group dropdown) |
| Modify | `frontend/src/services/api.js` | (update endpoints and field names) |
| Modify | `frontend/src/App.jsx` | (update route and import) |
| Modify | `frontend/src/App.css` | (rename CSS classes) |

---

## Implementation Steps

### Step 1: Create Database Migration
Create `migrations/005_rename_groups_to_institutions.sql` (confirmed: using new migration rather than modifying 004):
```sql
-- Rename table
ALTER TABLE account_groups RENAME TO institutions;

-- Rename columns in institutions table
ALTER TABLE institutions RENAME COLUMN group_name TO institution_name;
ALTER TABLE institutions RENAME COLUMN group_description TO institution_description;

-- Rename columns in account_balances table
ALTER TABLE account_balances RENAME COLUMN group_id TO institution_id;
ALTER TABLE account_balances RENAME COLUMN position_in_group TO position_in_institution;

-- Recreate indexes with new names
DROP INDEX IF EXISTS idx_account_groups_position;
DROP INDEX IF EXISTS idx_account_groups_archived;
DROP INDEX IF EXISTS idx_account_balances_group_id;

CREATE INDEX idx_institutions_position ON institutions(position);
CREATE INDEX idx_institutions_archived ON institutions(is_archived);
CREATE INDEX idx_account_balances_institution_id ON account_balances(institution_id);
```

### Step 2: Update Backend Models
1. Rename `account_group.go` → `institution.go`
2. Update all struct and type names:
   - `AccountGroup` → `Institution`
   - `AccountGroupWithAccounts` → `InstitutionWithAccounts`
   - `CreateGroupRequest` → `CreateInstitutionRequest`
   - `UpdateGroupRequest` → `UpdateInstitutionRequest`
   - `GroupPosition` → `InstitutionPosition`
   - etc.
3. Update JSON tags: `group_*` → `institution_*`
4. Update `account.go`: `GroupID` → `InstitutionID`, `PositionInGroup` → `PositionInInstitution`

### Step 3: Update Backend Repository
1. Rename `account_group_repo.go` → `institution_repo.go`
2. Update type: `AccountGroupRepository` → `InstitutionRepository`
3. Update all SQL queries to use `institutions` table and new column names
4. Update `account_repo.go`: `SetGroup` → `SetInstitution`, update SQL queries

### Step 4: Update Backend Handlers
1. Rename `account_groups.go` → `institutions.go`
2. Update type: `AccountGroupHandler` → `InstitutionHandler`
3. Update `accounts.go`: `SetGroup` → `SetInstitution`

### Step 5: Update Backend Router
Update `router.go`:
- Variable names: `groupRepo` → `institutionRepo`, `groupHandler` → `institutionHandler`
- Routes: `/api/groups/*` → `/api/institutions/*`
- Route: `/api/accounts/{id}/group` → `/api/accounts/{id}/institution`

### Step 6: Update Frontend API Service
Update `api.js`:
- Rename `groupsApi` → `institutionsApi`
- Update all endpoints to `/api/institutions`
- Update field names in request/response bodies

### Step 7: Update Frontend Components
1. Rename component files (GroupCard → InstitutionCard, etc.)
2. Update all internal references, props, and state variables
3. Update UI text (labels, placeholders, messages)
4. Update `AccountList.jsx` (largest file, many references)
5. Update `AccountForm.jsx` (group dropdown)
6. Update `App.jsx` (route and import)

### Step 8: Update CSS
Update `App.css`:
- Rename all `.group-*` classes to `.institution-*`

---

## Key Naming Changes Summary

| Category | Old | New |
|----------|-----|-----|
| DB Table | `account_groups` | `institutions` |
| DB Column | `group_name` | `institution_name` |
| DB Column | `group_description` | `institution_description` |
| DB Column | `group_id` | `institution_id` |
| DB Column | `position_in_group` | `position_in_institution` |
| API Route | `/api/groups` | `/api/institutions` |
| Go Struct | `AccountGroup` | `Institution` |
| React Component | `GroupCard` | `InstitutionCard` |
| JS Object | `groupsApi` | `institutionsApi` |
| CSS Class | `.group-card` | `.institution-card` |
| UI Label | "Group Name" | "Institution Name" |
| UI Text | "Add Group" | "Add Institution" |
