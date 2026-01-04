# Plan: Multi-Cell Delete via Delete/Backspace Key

## Overview
Implement a feature allowing users to select a range of cells in the spreadsheet and clear all their values by pressing Delete or Backspace. Currently, only single-cell selection exists, so this requires adding range selection first.

## Steps

1. **Add range selection state** in `SpreadsheetPage.jsx`: Introduce `selectionStart`, `selectionEnd`, and a computed `selectedCells` array to track multi-cell selections alongside the existing `selectedCell`.

2. **Implement mouse-based range selection**: Add `onMouseDown` to start selection, `onMouseMove` to extend it while dragging, and `onMouseUp` to finalize. Also support Shift+Click to select from anchor cell to clicked cell.

3. **Update cell rendering with selection highlighting**: Add logic in the cell rendering loop to apply a `.spreadsheet-cell-in-selection` CSS class for all cells within the selected range.

4. **Add selection styles** in `SpreadsheetPage.css`: Create styles for `.spreadsheet-cell-in-selection` with a distinct background color (e.g., light blue overlay).

5. **Modify Delete/Backspace handler**: Update the existing keyboard handler to iterate over all `selectedCells` and call `updateCell(cellId, '')` for each, clearing the entire selection.

6. **Add helper function `getSelectedCellIds`**: Create a utility that expands the range from `selectionStart` to `selectionEnd` into an array of cell addresses (similar to existing `expandCellRange`).

## Further Considerations

1. **Performance on large selections**: Batch cell updates into a single `setCells` call rather than calling `updateCell` per cell for better performance and single re-render.

2. **Undo support**: Clearing multiple cells could be undoable with an undo stack - out of scope for this feature.

3. **Non-contiguous selection (Ctrl+Click)**: Users could select multiple separate cells/ranges - deferred to keep scope minimal.
