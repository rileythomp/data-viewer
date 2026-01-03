# Plan: Allow Accounts in Multiple Account Groups

## Summary

Replace the current one-to-many relationship (account has single `group_id`) with a many-to-many relationship using a join table. Accounts will appear in each group they belong to, and balances count toward each group's total.

## Key Behavior Decisions

- **Display**: Account appears under each group it belongs to (duplicated visually)
- **Totals**: Account balance counts in each group AND in overall total (can count multiple times)
- **Drag behavior**: Dragging from groupB to groupC removes from groupB, adds to groupC, keeps other memberships (e.g., groupA)
- **No primary group**: All group memberships are equal

---

## Phase 1: Database Migration

**New file**: `migrations/007_multi_group_memberships.sql`

```sql
CREATE TABLE account_group_memberships (
    id SERIAL PRIMARY KEY,
    account_id INTEGER NOT NULL REFERENCES account_balances(id) ON DELETE CASCADE,
    group_id INTEGER NOT NULL REFERENCES account_groups(id) ON DELETE CASCADE,
    position_in_group INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(account_id, group_id)
);

CREATE INDEX idx_memberships_account ON account_group_memberships(account_id);
CREATE INDEX idx_memberships_group ON account_group_memberships(group_id);

-- Migrate existing data
INSERT INTO account_group_memberships (account_id, group_id, position_in_group)
SELECT id, group_id, position_in_group FROM account_balances WHERE group_id IS NOT NULL;
```

---

## Phase 2: Backend Model Changes

**File**: `backend/internal/models/account.go`
- Remove `GroupID *int` and `PositionInGroup int` fields
- Add `GroupIDs []int` field

**File**: `backend/internal/models/account_group.go`
- Add `AccountInGroup` struct (Account + PositionInGroup for group context)
- Change `AccountGroupWithAccounts.Accounts` to `[]AccountInGroup`

---

## Phase 3: Backend Repository Changes

**New file**: `backend/internal/repository/membership_repo.go`
- `GetGroupsForAccount(accountID)` - returns all group IDs
- `AddToGroup(accountID, groupID, position)` - add membership
- `RemoveFromGroup(accountID, groupID)` - remove membership
- `MoveGroup(accountID, sourceGroupID, destGroupID, position)` - drag operation

**File**: `backend/internal/repository/account_repo.go`
- Update `GetAll()` and `GetByID()` to query join table for `GroupIDs`
- Remove `SetGroup()` function

**File**: `backend/internal/repository/account_group_repo.go`
- Update `GetWithAccounts()` to query via join table
- Update `GetGroupedList()`:
  - Account is "ungrouped" only if it has NO memberships
  - Same account can appear in multiple groups

---

## Phase 4: Backend API Changes

**File**: `backend/internal/handlers/accounts.go`

Replace `SetGroup` endpoint with:
- `PATCH /api/accounts/{id}/membership` - handles add/remove/move actions
- `PUT /api/accounts/{id}/groups` - sets all memberships at once (for multi-select UI)

**File**: `backend/internal/router/router.go`
- Update routes

---

## Phase 5: Frontend API Changes

**File**: `frontend/src/services/api.js`

Add new methods:
```javascript
modifyGroupMembership(id, action, groupId, sourceGroupId, position)
// action: "add" | "remove" | "move"

setGroupMemberships(id, groupIds)  // For multi-select UI
```

---

## Phase 6: Frontend Component Changes

**File**: `frontend/src/components/AccountList.jsx`
- Update `handleDragEnd` to use "move" action with sourceGroupId
- Track source group (already has `dragSourceGroupId`)

**File**: `frontend/src/components/GroupCard.jsx`
- Use composite key `${group.id}-${account.id}` for accounts (same account can appear in multiple groups)

**File**: `frontend/src/components/AccountDetail.jsx`
- Change single-select dropdown to multi-select checkboxes
- Call `setGroupMemberships()` on change

**File**: `frontend/src/components/GroupDetail.jsx`
- Update remove confirmation: "Remove from this group? It will remain in other groups."
- Call `modifyGroupMembership(id, 'remove', groupId)`

---

## Implementation Order

1. Database migration (create join table, migrate data)
2. Backend models (update structs)
3. Backend repositories (new membership repo, update queries)
4. Backend handlers (new endpoints)
5. Frontend API service (new methods)
6. Frontend components (AccountDetail multi-select, AccountList drag, GroupCard keys)

---

## Critical Files

| Layer | File | Changes |
|-------|------|---------|
| DB | `migrations/007_multi_group_memberships.sql` | New join table |
| Model | `backend/internal/models/account.go` | GroupIDs array |
| Repo | `backend/internal/repository/membership_repo.go` | New file |
| Repo | `backend/internal/repository/account_repo.go` | Query join table |
| Repo | `backend/internal/repository/account_group_repo.go` | GetGroupedList, GetWithAccounts |
| Handler | `backend/internal/handlers/accounts.go` | New endpoints |
| API | `frontend/src/services/api.js` | New methods |
| UI | `frontend/src/components/AccountDetail.jsx` | Multi-select groups |
| UI | `frontend/src/components/AccountList.jsx` | Drag move logic |
| UI | `frontend/src/components/GroupCard.jsx` | Composite keys |
| UI | `frontend/src/components/GroupDetail.jsx` | Remove from group |
