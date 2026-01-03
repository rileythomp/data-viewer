# Balance History Toggle: Table vs Line Graph

## Overview
Add a toggle in the balance history section of the account details page to switch between the existing table view and a new line graph visualization.

## Files to Modify

1. **frontend/package.json** - Add recharts dependency
2. **frontend/src/components/AccountDetail.jsx** - Add toggle state and conditional rendering
3. **frontend/src/App.css** - Add styles for toggle and chart container

## Files to Create

1. **frontend/src/components/BalanceHistoryChart.jsx** - New line chart component

## Implementation Steps

### Step 1: Install Recharts
```bash
cd frontend && npm install recharts
```

### Step 2: Create BalanceHistoryChart Component
Create `frontend/src/components/BalanceHistoryChart.jsx`:
- Accept `history` prop (same data as table)
- Reverse the history array (API returns newest first, chart needs chronological order)
- Use Recharts `LineChart` with `ResponsiveContainer`
- X-axis: dates (formatted)
- Y-axis: balance amounts (formatted as currency)
- Include tooltip showing date and balance on hover
- Match existing color scheme

### Step 3: Update AccountDetail.jsx
- Add state: `const [viewMode, setViewMode] = useState('table')`
- Import the new `BalanceHistoryChart` component
- Add toggle buttons in the "Balance History" section header
- Conditionally render either `BalanceHistoryTable` or `BalanceHistoryChart` based on `viewMode`

### Step 4: Add CSS Styles
- Style the toggle button group (table/chart switcher)
- Add container styles for the chart (matching existing 400px height)
- Ensure responsive behavior

## Component Structure

```jsx
// In AccountDetail.jsx balance history section:
<div className="detail-history">
  <div className="history-header">
    <h2 className="detail-section-title">Balance History</h2>
    <div className="view-toggle">
      <button className={viewMode === 'table' ? 'active' : ''}>Table</button>
      <button className={viewMode === 'chart' ? 'active' : ''}>Chart</button>
    </div>
  </div>
  {viewMode === 'table' ? (
    <BalanceHistoryTable history={history} />
  ) : (
    <BalanceHistoryChart history={history} />
  )}
</div>
```

## Data Transformation
The history data from API:
```json
[
  { "id": 1, "balance": 1500.00, "recorded_at": "2024-01-15T..." },
  { "id": 2, "balance": 1200.00, "recorded_at": "2024-01-10T..." }
]
```
Chart needs chronological order (oldest first), so reverse before rendering.
