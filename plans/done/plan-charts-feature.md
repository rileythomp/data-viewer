# Charts Feature Implementation Plan

## Overview
Add a charts feature that allows users to create pie charts from selected accounts and groups. The implementation mirrors the existing dashboard feature pattern.

## Files to Create

### Backend
1. **`migrations/011_add_charts.sql`** - Database migration
2. **`backend/internal/models/chart.go`** - Chart models and types
3. **`backend/internal/repository/chart_repo.go`** - Chart repository with CRUD operations
4. **`backend/internal/handlers/charts.go`** - HTTP handlers

### Frontend
5. **`frontend/src/components/ChartList.jsx`** - Paginated list of charts
6. **`frontend/src/components/ChartCreate.jsx`** - Create new chart form
7. **`frontend/src/components/ChartDetail.jsx`** - View/edit chart with pie chart visualization

## Files to Modify

### Backend
8. **`backend/internal/router/router.go`** - Add chart routes

### Frontend
9. **`frontend/src/services/api.js`** - Add `chartsApi` object
10. **`frontend/src/App.jsx`** - Add chart routes
11. **`frontend/src/components/NavBar.jsx`** - Add Charts nav link
12. **`frontend/src/App.css`** - Add chart container styles

---

## Implementation Steps

### Step 1: Database Migration
**File:** `migrations/011_add_charts.sql`

```sql
CREATE TABLE IF NOT EXISTS charts (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT DEFAULT '',
    position INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chart_items (
    id SERIAL PRIMARY KEY,
    chart_id INTEGER NOT NULL REFERENCES charts(id) ON DELETE CASCADE,
    item_type VARCHAR(10) NOT NULL CHECK (item_type IN ('account', 'group')),
    item_id INTEGER NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(chart_id, item_type, item_id)
);

CREATE INDEX IF NOT EXISTS idx_chart_items_chart ON chart_items(chart_id);
```

---

### Step 2: Backend Models
**File:** `backend/internal/models/chart.go`

Define types:
- `Chart` - Base chart entity (id, name, description, position, timestamps)
- `ChartItem` - Join table record (chart_id, item_type, item_id, position)
- `PieChartDataItem` - Pie slice data (name, value, color, type, item_id)
- `ChartWithItems` - Chart with items array, total_balance, and pie_data array
- `CreateChartRequest` / `UpdateChartRequest` - API payloads
- `ChartListResponse` - Paginated response

Key addition: `PieChartDataItem` struct for pre-computed pie chart data:
```go
type PieChartDataItem struct {
    Name   string  `json:"name"`
    Value  float64 `json:"value"`
    Color  string  `json:"color"`
    Type   string  `json:"type"`
    ItemID int     `json:"item_id"`
}
```

---

### Step 3: Backend Repository
**File:** `backend/internal/repository/chart_repo.go`

Methods (mirror `dashboard_repo.go`):
- `GetAll(page, pageSize)` - Paginated list with items and pie data
- `GetByID(id)` - Single chart lookup
- `GetWithItems(id)` - Chart with resolved items and computed pie_data
- `Create(req)` - Transaction-based creation
- `Update(id, req)` - Transaction-based update (replace items)
- `Delete(id)` - Delete with cascade

**Pie Data Computation in `GetWithItems`:**
- For accounts: name = account_name, value = current_balance, color from palette
- For groups: name = group_name, value = total_balance, color = group.color

Account color palette (since accounts don't have colors):
```go
var accountColors = []string{
    "#8884d8", "#82ca9d", "#ffc658", "#ff7300", "#00C49F",
    "#FFBB28", "#FF8042", "#0088FE", "#a4de6c", "#d0ed57",
}
```

---

### Step 4: Backend Handlers
**File:** `backend/internal/handlers/charts.go`

HTTP handlers:
- `GetAll` - GET /api/charts (pagination: page, page_size query params)
- `GetByID` - GET /api/charts/:id
- `Create` - POST /api/charts (validate name required)
- `Update` - PATCH /api/charts/:id
- `Delete` - DELETE /api/charts/:id

---

### Step 5: Backend Routes
**File:** `backend/internal/router/router.go`

Add after dashboard routes:
```go
chartRepo := repository.NewChartRepository(db)
chartHandler := handlers.NewChartHandler(chartRepo)

api.HandleFunc("/charts", chartHandler.GetAll).Methods("GET")
api.HandleFunc("/charts", chartHandler.Create).Methods("POST")
api.HandleFunc("/charts/{id}", chartHandler.GetByID).Methods("GET")
api.HandleFunc("/charts/{id}", chartHandler.Update).Methods("PATCH")
api.HandleFunc("/charts/{id}", chartHandler.Delete).Methods("DELETE")
```

---

### Step 6: Frontend API Service
**File:** `frontend/src/services/api.js`

Add `chartsApi` object with methods:
- `getAll(page, pageSize)` - GET /api/charts
- `getById(id)` - GET /api/charts/:id
- `create(name, description, accountIds, groupIds)` - POST /api/charts
- `update(id, name, description, accountIds, groupIds)` - PATCH /api/charts/:id
- `delete(id)` - DELETE /api/charts/:id

---

### Step 7: ChartList Component
**File:** `frontend/src/components/ChartList.jsx`

Mirror `DashboardList.jsx`:
- Paginated list (pageSize=20)
- Chart cards showing: name, total_balance, description, item count
- "Create Chart" button navigating to /charts/new
- Click card to navigate to /charts/:id
- Pagination controls

---

### Step 8: ChartCreate Component
**File:** `frontend/src/components/ChartCreate.jsx`

Mirror `DashboardCreate.jsx`:
- Form fields: name (required), description
- Fetch all accounts and groups on mount
- Checkbox multi-select for accounts
- Checkbox multi-select for groups (with color dots)
- Submit creates chart and navigates to /charts/:id

---

### Step 9: ChartDetail Component
**File:** `frontend/src/components/ChartDetail.jsx`

Mirror `DashboardDetail.jsx` with pie chart:
- Header with name (editable via InlineEditableText), total balance
- Edit mode toggle (pencil/check icons)
- Delete button with confirmation
- Edit panel: description editing, account/group checkbox selection
- **Pie Chart visualization** using Recharts:
  ```jsx
  <PieChart>
    <Pie data={chart.pie_data} dataKey="value" nameKey="name">
      {chart.pie_data.map((entry, i) => (
        <Cell key={i} fill={entry.color} />
      ))}
    </Pie>
    <Tooltip content={<CustomTooltip />} />
    <Legend />
  </PieChart>
  ```
- Custom tooltip showing name and formatted currency value
- Empty state when no items selected

---

### Step 10: Frontend Routing
**File:** `frontend/src/App.jsx`

Add imports and routes:
```jsx
import ChartList from './components/ChartList'
import ChartCreate from './components/ChartCreate'
import ChartDetail from './components/ChartDetail'

// In Routes:
<Route path="/charts" element={<ChartList />} />
<Route path="/charts/new" element={<ChartCreate />} />
<Route path="/charts/:id" element={<ChartDetail />} />
```

---

### Step 11: Navigation
**File:** `frontend/src/components/NavBar.jsx`

Add PieChart icon and link:
```jsx
import { PieChart } from 'lucide-react';

// In navbar-actions:
<Link to="/charts" className="btn-icon" title="Charts">
  <PieChart size={18} />
</Link>
```

---

### Step 12: CSS Styles
**File:** `frontend/src/App.css`

Add chart container styles:
```css
.chart-container {
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  border: 1px solid var(--color-border);
  margin-top: var(--space-6);
}

.recharts-legend-item-text {
  color: var(--color-text-primary) !important;
}
```

---

## Key Reference Files
- `backend/internal/repository/dashboard_repo.go` - Repository pattern with balance resolution
- `backend/internal/models/dashboard.go` - Model structure
- `frontend/src/components/DashboardDetail.jsx` - Edit mode and inline editing pattern
- `frontend/src/components/DashboardCreate.jsx` - Create form with checkbox selection
- `frontend/src/components/DashboardList.jsx` - Paginated list pattern
- `frontend/src/components/BalanceHistoryChart.jsx` - Recharts usage and CSS theming
