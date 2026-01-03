# Line Chart Support for Charts Feature

## Summary
Add line chart view capability to the existing charts feature. Users can toggle between pie chart and line chart views. Line charts will display the balance history of each selected account/group as separate colored lines.

## Key Decisions
- **View Mode Toggle**: Charts support both pie and line views (toggle, not stored)
- **Multi-line Display**: Each account/group gets its own line with distinct colors
- **Data Source**: Reuse existing balance history endpoints (`/accounts/:id/history`, `/groups/:id/history`)

## Implementation Steps

### 1. Backend: Add balance history endpoint for charts
**File**: `backend/internal/handlers/charts.go`
- Add new endpoint `GET /charts/:id/history` that returns balance history for all items in the chart
- Returns combined history data keyed by account/group with their colors

**File**: `backend/internal/repository/chart_repo.go`
- Add `GetChartHistory(id int)` method that:
  - Fetches chart items (accounts and groups)
  - Retrieves balance history for each item from `balance_history` and `group_balance_history` tables
  - Returns structured data with name, color, and history entries

**File**: `backend/internal/models/chart.go`
- Add `ChartHistoryResponse` struct containing:
  - `series`: array of `{ id, name, color, type, history: [{date, balance}] }`

### 2. Backend: Register the new route
**File**: `backend/internal/router/router.go`
- Add `api.HandleFunc("/charts/{id}/history", chartHandler.GetHistory).Methods("GET")` after existing chart routes

### 3. Frontend: Add API method for chart history
**File**: `frontend/src/services/api.js`
- Add `chartsApi.getHistory(id)` method to fetch chart history data

### 4. Frontend: Create multi-line chart component
**File**: `frontend/src/components/ChartLineView.jsx` (new file)
- Create component using Recharts `LineChart` with multiple `Line` components
- Accept `historyData` prop with series array
- Each series gets its own colored line based on account color or group color
- Include legend showing all series names
- Reuse tooltip styling from existing `BalanceHistoryChart.jsx`

### 5. Frontend: Add view mode toggle to ChartDetail
**File**: `frontend/src/components/ChartDetail.jsx`
- Add `viewMode` state ('pie' | 'line'), default to 'pie'
- Add view toggle buttons (similar to AccountDetail.jsx pattern at line 444-457)
- Fetch chart history when switching to line view (or on mount)
- Conditionally render `PieChart` or `ChartLineView` based on viewMode
- Show "No history data" message if line chart has no data

## Files to Modify
1. `backend/internal/models/chart.go` - Add history response types
2. `backend/internal/repository/chart_repo.go` - Add GetChartHistory method
3. `backend/internal/handlers/charts.go` - Add GetHistory handler
4. `backend/internal/router/router.go` - Register new route
5. `frontend/src/services/api.js` - Add getHistory to chartsApi
6. `frontend/src/components/ChartDetail.jsx` - Add view toggle and line chart rendering
7. `frontend/src/components/ChartLineView.jsx` - New component for multi-line chart

## Data Flow
```
User clicks "Line" toggle
  -> Fetch /charts/:id/history
  -> Backend queries balance_history for each account
  -> Backend queries group_balance_history for each group
  -> Returns { series: [{ name, color, history: [...] }, ...] }
  -> Frontend renders LineChart with one Line per series
```
