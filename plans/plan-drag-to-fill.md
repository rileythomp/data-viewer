# Plan: Drag-to-Fill Functionality for Spreadsheet

## Overview
Implement Excel/Google Sheets-style drag-to-fill functionality. Users can drag the corner of a selected cell horizontally or vertically to copy values and adjust formulas to adjacent cells.

## Key Design Decision
**Use native mouse events** (mousedown/mousemove/mouseup) instead of @dnd-kit because:
- Drag-to-fill requires axis-locking behavior (horizontal OR vertical)
- The source cell stays in place (not a drag-and-drop operation)
- Need precise hit detection on small 8x8px fill handle
- Simpler setup with no wrapper components needed

## Files to Modify
1. **[SpreadsheetPage.jsx](frontend/src/components/SpreadsheetPage.jsx)** - Core logic and UI
2. **[App.css](frontend/src/App.css)** - Fill handle and preview styles

---

## Implementation Steps

### Step 1: Add Utility Functions (SpreadsheetPage.jsx ~line 67)

**1.1 `adjustFormulaReferences(formula, colOffset, rowOffset)`**
- Core formula transformation function
- Parses cell references including `$` markers for absolute refs
- Pattern: `/(\$?)([A-Z])(\$?)(\d+)/gi`
- Only adjusts non-absolute parts (no `$` prefix)
- Returns `#REF!` for out-of-bounds references

```javascript
function adjustFormulaReferences(formula, colOffset, rowOffset) {
  if (!formula || !formula.startsWith('=')) return formula;

  const cellRefPattern = /(\$?)([A-Z])(\$?)(\d+)/gi;

  return formula.replace(cellRefPattern, (match, colDollar, col, rowDollar, row) => {
    const colIndex = letterToColumnIndex(col);
    const rowIndex = parseInt(row, 10) - 1;

    const newColIndex = colDollar === '$' ? colIndex : colIndex + colOffset;
    const newRowIndex = rowDollar === '$' ? rowIndex : rowIndex + rowOffset;

    if (newColIndex < 0 || newColIndex >= NUM_COLS ||
        newRowIndex < 0 || newRowIndex >= NUM_ROWS) {
      return '#REF!';
    }

    return `${colDollar}${columnIndexToLetter(newColIndex)}${rowDollar}${newRowIndex + 1}`;
  });
}
```

**1.2 `determineDragDirection(startX, startY, currentX, currentY)`**
- Returns `'horizontal'` or `'vertical'` based on initial movement
- Threshold of ~5px before direction locks

### Step 2: Add State Variables (SpreadsheetPage.jsx ~line 334)

```javascript
const [isDraggingFill, setIsDraggingFill] = useState(false);
const [fillDragStart, setFillDragStart] = useState(null); // { x, y, cell }
const [fillDragDirection, setFillDragDirection] = useState(null);
const [fillPreviewCells, setFillPreviewCells] = useState([]);
const cellRefs = useRef({});
```

### Step 3: Add Event Handlers (SpreadsheetPage.jsx ~line 520)

**3.1 `handleFillHandleMouseDown`**
- Capture starting position and source cell
- Prevent propagation (avoid cell selection)

**3.2 `useEffect` for document-level mouse tracking**
- On mousemove: determine direction, calculate fill range, update preview
- On mouseup: apply fill to all preview cells, reset state
- Clean up listeners on unmount

**3.3 `applyFill(sourceCell, targetCells, direction)`**
- For each target cell:
  - Calculate offset from source
  - If formula: call `adjustFormulaReferences()`
  - If plain value: copy as-is
  - Call existing `updateCell()` to apply

### Step 4: Modify Cell Rendering (SpreadsheetPage.jsx lines 566-594)

- Add `ref` to each `<td>` for position calculations
- Add `spreadsheet-cell-fill-preview` class when cell is in preview
- Add fill handle element to selected cell (when not editing):

```jsx
{isSelected && !isEditing && (
  <div
    className="spreadsheet-fill-handle"
    onMouseDown={handleFillHandleMouseDown}
  />
)}
```

### Step 5: Add CSS (App.css after line 3234)

```css
/* Fill Handle */
.spreadsheet-fill-handle {
  position: absolute;
  bottom: -4px;
  right: -4px;
  width: 8px;
  height: 8px;
  background-color: var(--color-primary);
  border: 1px solid var(--color-surface);
  cursor: crosshair;
  z-index: 10;
}

.spreadsheet-fill-handle:hover {
  transform: scale(1.2);
}

.spreadsheet-cell-selected {
  position: relative; /* Enable absolute positioning for handle */
}

.spreadsheet-cell-fill-preview {
  background-color: var(--color-primary-light) !important;
  outline: 1px dashed var(--color-primary);
}

.spreadsheet-container.is-filling {
  cursor: crosshair;
}

.spreadsheet-container.is-filling .spreadsheet-cell {
  user-select: none;
}
```

---

## Reference Type Behavior

| Reference | When dragged down | When dragged right |
|-----------|------------------|-------------------|
| `A1` | `A2` | `B1` |
| `$A1` | `$A1` (col fixed) → `$A2` | `$A1` (col fixed) |
| `A$1` | `A$1` (row fixed) | `B$1` (row fixed) |
| `$A$1` | `$A$1` (both fixed) | `$A$1` (both fixed) |

---

## Test Cases

1. Plain text: "Hello" → copies to all target cells
2. Number: `42` → copies to all target cells
3. Relative formula: `=A1+B1` down → `=A2+B2`
4. Column absolute: `=$A1` down → `=$A2`
5. Row absolute: `=A$1` down → `=A$1`
6. Fully absolute: `=$A$1` down → `=$A$1`
7. SUM range: `=SUM(A1:C1)` down → `=SUM(A2:C2)`
8. Horizontal drag: `=A2` right → `=B2`
9. Out of bounds: Reference to row 0 → `#REF!`
