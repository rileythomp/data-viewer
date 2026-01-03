# Dashboard Feature Implementation Plan

## Overview
Add a dashboard feature allowing users to create custom views with selected accounts and groups.

## User Flow
1. Click dashboard icon in NavBar → `/dashboards` (list page, paginated 20/page)
2. Click existing dashboard → `/dashboards/:id` (detail page)
3. Click "Create Dashboard" → `/dashboards/new` (creation page)
4. Submit creation → redirect to `/dashboards/:id`

## Data Model
- **Global dashboards** (no user concept)
- **Fields**: name (required), description (optional)
- **Relationships**: many-to-many with accounts and groups via junction table

---

## Implementation Steps

### Phase 1: Database Migration

**Create** `migrations/010_add_dashboards.sql`:
```sql
CREATE TABLE IF NOT EXISTS dashboards (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT DEFAULT '',
    position INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dashboard_items (
    id SERIAL PRIMARY KEY,
    dashboard_id INTEGER NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE,
    item_type VARCHAR(10) NOT NULL CHECK (item_type IN ('account', 'group')),
    item_id INTEGER NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(dashboard_id, item_type, item_id)
);

CREATE INDEX IF NOT EXISTS idx_dashboard_items_dashboard ON dashboard_items(dashboard_id);
```

### Phase 2: Backend Models

**Create** `backend/internal/models/dashboard.go`:
- `Dashboard` struct (id, name, description, position, timestamps)
- `DashboardItem` struct (dashboard_id, item_type, item_id, position)
- `DashboardWithItems` struct (embeds Dashboard, adds Items []ListItem, TotalBalance)
- `CreateDashboardRequest` / `UpdateDashboardRequest` (name, description, account_ids, group_ids)
- `DashboardListResponse` (dashboards, total, page, page_size)

### Phase 3: Backend Repository

**Create** `backend/internal/repository/dashboard_repo.go`:

| Method | Description |
|--------|-------------|
| `GetAll(page, pageSize)` | Paginated list with total count |
| `GetByID(id)` | Single dashboard metadata |
| `GetWithItems(id)` | Dashboard with resolved accounts/groups (reuse ListItem type) |
| `Create(req)` | Create dashboard + items in transaction |
| `Update(id, req)` | Update dashboard + replace items |
| `Delete(id)` | Delete dashboard (cascade deletes items) |

**Key pattern**: Reuse `ListItem` type from `account_group.go` for mixed account/group items.

### Phase 4: Backend Handlers & Routes

**Create** `backend/internal/handlers/dashboards.go`:
- `GetAll` - GET `/api/dashboards?page=1&page_size=20`
- `GetByID` - GET `/api/dashboards/{id}`
- `Create` - POST `/api/dashboards`
- `Update` - PATCH `/api/dashboards/{id}`
- `Delete` - DELETE `/api/dashboards/{id}`

**Modify** `backend/internal/router/router.go`:
- Add dashboard repository and handler initialization
- Register 5 dashboard routes

### Phase 5: Frontend API

**Modify** `frontend/src/services/api.js`:
- Add `dashboardsApi` object with: `getAll`, `getById`, `create`, `update`, `delete`

### Phase 6: Frontend Components

**Create** `frontend/src/components/DashboardList.jsx`:
- Header with title + "Create Dashboard" button
- List of dashboard cards (name, description, item count)
- Pagination controls (prev/next, page numbers)
- Click card → navigate to `/dashboards/:id`

**Create** `frontend/src/components/DashboardCreate.jsx`:
- Back button to `/dashboards`
- Form: name input, description textarea
- Account multi-select checkboxes (fetch from API)
- Group multi-select checkboxes (fetch from API)
- Submit → create → redirect to detail page

**Create** `frontend/src/components/DashboardDetail.jsx`:
- Back button to `/dashboards`
- Dashboard name/description display
- Edit/Delete buttons
- Total balance display
- List of items using existing `AccountCard` and `GroupCard` components
- Groups expandable (same as main page)

### Phase 7: Frontend Integration

**Modify** `frontend/src/components/NavBar.jsx`:
- Add `LayoutDashboard` icon from lucide-react
- Add Link to `/dashboards` before Settings icon

**Modify** `frontend/src/App.jsx`:
- Import 3 new dashboard components
- Add routes: `/dashboards`, `/dashboards/new`, `/dashboards/:id`

### Phase 8: Styles

**Modify** `frontend/src/App.css`:
- `.dashboard-card` - clickable card for list items
- `.pagination` - pagination controls
- `.item-selection` - checkbox list container for creation form
- `.item-checkbox` - individual selectable item

---

## Files to Create
- `migrations/010_add_dashboards.sql`
- `backend/internal/models/dashboard.go`
- `backend/internal/repository/dashboard_repo.go`
- `backend/internal/handlers/dashboards.go`
- `frontend/src/components/DashboardList.jsx`
- `frontend/src/components/DashboardCreate.jsx`
- `frontend/src/components/DashboardDetail.jsx`

## Files to Modify
- `backend/internal/router/router.go` - add routes
- `frontend/src/services/api.js` - add dashboardsApi
- `frontend/src/components/NavBar.jsx` - add dashboard icon
- `frontend/src/App.jsx` - add routes and imports
- `frontend/src/App.css` - add dashboard styles

## Key Patterns to Follow
- Use `ListItem` type for mixed account/group items (from `account_group.go:82-87`)
- Transaction pattern for create/update with items
- Pagination with page/page_size query params
- Reuse `AccountCard` and `GroupCard` for display
- Follow existing handler validation patterns
