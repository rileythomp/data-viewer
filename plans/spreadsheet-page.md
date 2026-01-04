# Spreadsheet Page Implementation Plan

## Overview
Add a new client-side spreadsheet page accessible from the top navigation bar. The spreadsheet will have a fixed 26x100 grid (columns A-Z, rows 1-100) with cell editing and formula support.

## Requirements Summary
- **Persistence**: Client-side only (no backend)
- **Grid size**: Fixed 26 columns (A-Z) x 100 rows
- **Formulas**: Basic arithmetic (+, -, *, /), cell references (=A1+B2), and range functions (SUM, AVERAGE)

---

## Files to Modify

| File | Change |
|------|--------|
| [App.jsx](frontend/src/App.jsx) | Add import and route for SpreadsheetPage |
| [NavBar.jsx](frontend/src/components/NavBar.jsx) | Add spreadsheet nav link with `Table2` icon |
| [App.css](frontend/src/App.css) | Add spreadsheet-specific styles |

## Files to Create

| File | Purpose |
|------|---------|
| `frontend/src/components/SpreadsheetPage.jsx` | Main spreadsheet component with all logic |

---

## Implementation Steps

### Step 1: Add Navigation and Routing
1. In [NavBar.jsx](frontend/src/components/NavBar.jsx):
   - Import `Table2` from lucide-react
   - Add link after Datasets: `<Link to="/spreadsheet" className="btn-icon" title="Spreadsheet"><Table2 size={18} /></Link>`

2. In [App.jsx](frontend/src/App.jsx):
   - Import SpreadsheetPage component
   - Add route: `<Route path="/spreadsheet" element={<SpreadsheetPage />} />`

### Step 2: Create SpreadsheetPage Component Structure
Create `SpreadsheetPage.jsx` with:
- Page header following existing pattern
- Formula bar showing selected cell address and formula/value
- Grid table with column headers (A-Z) and row headers (1-100)

**State structure:**
```javascript
const [cells, setCells] = useState({});           // { "A1": { rawValue, computedValue, error } }
const [selectedCell, setSelectedCell] = useState(null);  // e.g., "A1"
const [editingCell, setEditingCell] = useState(null);    // Cell being edited
const [editValue, setEditValue] = useState("");          // Current input value
```

### Step 3: Implement Cell Selection and Editing
- Click to select cell (visual outline)
- Double-click or start typing to enter edit mode
- Enter to confirm, Escape to cancel, Tab to move right
- Arrow keys for navigation

### Step 4: Implement Formula Engine

**4a. Value parsing:**
- Detect formulas (starts with `=`)
- Store both rawValue and computedValue

**4b. Cell reference resolution:**
- Extract references with regex: `/[A-Z]\d+/gi`
- Replace with cell values

**4c. Range functions:**
- Parse `SUM(A1:A5)` and `AVERAGE(A1:B10)`
- Expand range to cell list, compute result

**4d. Arithmetic evaluation:**
- Use safe expression parser (not eval)
- Support +, -, *, / with parentheses
- Handle order of operations

### Step 5: Dependency Management and Recalculation
- Track which cells depend on which others
- When a cell changes, recalculate all dependent cells
- Detect circular references before committing formula

### Step 6: Add CSS Styles
Add to [App.css](frontend/src/App.css):
- `.spreadsheet-container` - scrollable wrapper
- `.spreadsheet-grid` - table with fixed layout
- `.spreadsheet-header-cell` - sticky column/row headers
- `.spreadsheet-cell` - data cells with hover/selected states
- `.spreadsheet-cell-input` - inline editing input
- `.spreadsheet-formula-bar` - top formula bar

---

## Key Utility Functions

| Function | Purpose |
|----------|---------|
| `columnIndexToLetter(i)` | 0 → "A", 25 → "Z" |
| `parseCellAddress(addr)` | "A1" → {col: 0, row: 0} |
| `expandRange(start, end)` | "A1:A3" → ["A1", "A2", "A3"] |
| `extractCellReferences(formula)` | Get all cell refs from formula |
| `parseFormula(formula, getCellValue)` | Evaluate formula string |
| `hasCircularReference(cell, deps)` | Detect cycles |

---

## Component Layout

```
SpreadsheetPage
├── Header (.header)
│   └── Title: "Spreadsheet"
├── Formula Bar (.spreadsheet-formula-bar)
│   ├── Cell Address display (e.g., "A1")
│   └── Formula/Value input
└── Grid Container (.spreadsheet-container)
    └── Table (.spreadsheet-grid)
        ├── Column Headers (A-Z)
        ├── Row Headers (1-100)
        └── Data Cells
```

---

## Error Handling
- Invalid formulas: Show error in cell, display message in formula bar
- Circular references: Prevent save, show error
- Division by zero: Display #DIV/0! error
- Missing cell references: Treat as 0
