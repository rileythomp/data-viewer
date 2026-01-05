import { useState, useCallback, useRef, useEffect } from 'react';

const NUM_ROWS = 100;
const NUM_COLS = 26;

// Utility functions
function columnIndexToLetter(index) {
  return String.fromCharCode(65 + index);
}

function letterToColumnIndex(letter) {
  return letter.toUpperCase().charCodeAt(0) - 65;
}

function getCellAddress(col, row) {
  return `${columnIndexToLetter(col)}${row + 1}`;
}

function parseCellAddress(address) {
  const match = address.match(/^([A-Z])(\d+)$/i);
  if (!match) return null;
  return {
    col: letterToColumnIndex(match[1]),
    row: parseInt(match[2], 10) - 1
  };
}

function expandRange(start, end) {
  const startCell = parseCellAddress(start);
  const endCell = parseCellAddress(end);
  if (!startCell || !endCell) return [];

  const cells = [];
  const minCol = Math.min(startCell.col, endCell.col);
  const maxCol = Math.max(startCell.col, endCell.col);
  const minRow = Math.min(startCell.row, endCell.row);
  const maxRow = Math.max(startCell.row, endCell.row);

  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      cells.push(getCellAddress(col, row));
    }
  }
  return cells;
}

function extractCellReferences(formula) {
  if (!formula || !formula.startsWith('=')) return [];
  const refs = new Set();

  // Match range references like A1:B5
  const rangeMatches = formula.match(/([A-Z]\d+):([A-Z]\d+)/gi) || [];
  for (const range of rangeMatches) {
    const [start, end] = range.split(':');
    for (const cell of expandRange(start, end)) {
      refs.add(cell.toUpperCase());
    }
  }

  // Match individual cell references (excluding those already in ranges)
  const cellMatches = formula.match(/[A-Z]\d+/gi) || [];
  for (const cell of cellMatches) {
    refs.add(cell.toUpperCase());
  }

  return Array.from(refs);
}

// Adjusts formula cell references based on row/column offset (for drag-to-fill)
function adjustFormulaReferences(formula, colOffset, rowOffset) {
  if (!formula || !formula.startsWith('=')) return formula;

  // Regex to match cell references with optional $ markers
  // Matches: A1, $A1, A$1, $A$1, including in ranges like A1:B2
  const cellRefPattern = /(\$?)([A-Z])(\$?)(\d+)/gi;

  return formula.replace(cellRefPattern, (match, colDollar, col, rowDollar, row) => {
    const colIndex = letterToColumnIndex(col);
    const rowIndex = parseInt(row, 10) - 1;

    // Apply offsets only to non-absolute references
    const newColIndex = colDollar === '$' ? colIndex : colIndex + colOffset;
    const newRowIndex = rowDollar === '$' ? rowIndex : rowIndex + rowOffset;

    // Bounds checking
    if (newColIndex < 0 || newColIndex >= NUM_COLS ||
      newRowIndex < 0 || newRowIndex >= NUM_ROWS) {
      return '#REF!';
    }

    // Reconstruct the reference preserving $ markers
    return `${colDollar}${columnIndexToLetter(newColIndex)}${rowDollar}${newRowIndex + 1}`;
  });
}

// Determines drag direction based on initial movement
function determineDragDirection(startX, startY, currentX, currentY, threshold = 5) {
  const deltaX = Math.abs(currentX - startX);
  const deltaY = Math.abs(currentY - startY);

  if (deltaX < threshold && deltaY < threshold) {
    return null; // Not enough movement to determine
  }

  return deltaX > deltaY ? 'horizontal' : 'vertical';
}

// Safe arithmetic expression evaluator using shunting-yard algorithm
function tokenize(expr) {
  const tokens = [];
  let i = 0;
  while (i < expr.length) {
    if (/\s/.test(expr[i])) {
      i++;
      continue;
    }
    if (/[\d.]/.test(expr[i])) {
      let num = '';
      while (i < expr.length && /[\d.]/.test(expr[i])) {
        num += expr[i++];
      }
      tokens.push({ type: 'number', value: parseFloat(num) });
    } else if (/[+\-*/]/.test(expr[i])) {
      tokens.push({ type: 'operator', value: expr[i++] });
    } else if (expr[i] === '(') {
      tokens.push({ type: 'lparen', value: expr[i++] });
    } else if (expr[i] === ')') {
      tokens.push({ type: 'rparen', value: expr[i++] });
    } else {
      throw new Error(`Unexpected character: ${expr[i]}`);
    }
  }
  return tokens;
}

function evaluateArithmetic(expr) {
  const tokens = tokenize(expr);
  const precedence = { '+': 1, '-': 1, '*': 2, '/': 2 };
  const outputQueue = [];
  const operatorStack = [];

  for (const token of tokens) {
    if (token.type === 'number') {
      outputQueue.push(token.value);
    } else if (token.type === 'operator') {
      while (
        operatorStack.length > 0 &&
        operatorStack[operatorStack.length - 1].type === 'operator' &&
        precedence[operatorStack[operatorStack.length - 1].value] >= precedence[token.value]
      ) {
        outputQueue.push(operatorStack.pop().value);
      }
      operatorStack.push(token);
    } else if (token.type === 'lparen') {
      operatorStack.push(token);
    } else if (token.type === 'rparen') {
      while (operatorStack.length > 0 && operatorStack[operatorStack.length - 1].type !== 'lparen') {
        outputQueue.push(operatorStack.pop().value);
      }
      if (operatorStack.length === 0) {
        throw new Error('Mismatched parentheses');
      }
      operatorStack.pop();
    }
  }

  while (operatorStack.length > 0) {
    const op = operatorStack.pop();
    if (op.type === 'lparen') {
      throw new Error('Mismatched parentheses');
    }
    outputQueue.push(op.value);
  }

  // Evaluate RPN
  const evalStack = [];
  for (const item of outputQueue) {
    if (typeof item === 'number') {
      evalStack.push(item);
    } else {
      const b = evalStack.pop();
      const a = evalStack.pop();
      if (a === undefined || b === undefined) {
        throw new Error('Invalid expression');
      }
      switch (item) {
        case '+': evalStack.push(a + b); break;
        case '-': evalStack.push(a - b); break;
        case '*': evalStack.push(a * b); break;
        case '/':
          if (b === 0) throw new Error('#DIV/0!');
          evalStack.push(a / b);
          break;
      }
    }
  }

  if (evalStack.length !== 1) {
    throw new Error('Invalid expression');
  }
  return evalStack[0];
}

function parseFormula(formula, getCellValue) {
  if (!formula || formula === '') {
    return { value: '', error: null };
  }

  if (!formula.startsWith('=')) {
    const num = parseFloat(formula);
    if (!isNaN(num) && formula.trim() !== '') {
      return { value: num, error: null };
    }
    return { value: formula, error: null };
  }

  let expression = formula.slice(1);

  try {
    // Handle SUM function
    expression = expression.replace(
      /SUM\(([A-Z]\d+):([A-Z]\d+)\)/gi,
      (match, start, end) => {
        const cells = expandRange(start, end);
        let sum = 0;
        for (const cell of cells) {
          const val = getCellValue(cell.toUpperCase());
          if (typeof val === 'number') sum += val;
          else if (typeof val === 'string' && val !== '') {
            const num = parseFloat(val);
            if (!isNaN(num)) sum += num;
          }
        }
        return sum.toString();
      }
    );

    // Handle AVERAGE function
    expression = expression.replace(
      /AVERAGE\(([A-Z]\d+):([A-Z]\d+)\)/gi,
      (match, start, end) => {
        const cells = expandRange(start, end);
        let sum = 0;
        let count = 0;
        for (const cell of cells) {
          const val = getCellValue(cell.toUpperCase());
          if (typeof val === 'number') {
            sum += val;
            count++;
          } else if (typeof val === 'string' && val !== '') {
            const num = parseFloat(val);
            if (!isNaN(num)) {
              sum += num;
              count++;
            }
          }
        }
        if (count === 0) return '0';
        return (sum / count).toString();
      }
    );

    // Replace cell references with their values
    expression = expression.replace(
      /([A-Z])(\d+)/gi,
      (match, col, row) => {
        const cellAddr = `${col.toUpperCase()}${row}`;
        const val = getCellValue(cellAddr);
        if (typeof val === 'number') return val.toString();
        if (typeof val === 'string' && val !== '') {
          const num = parseFloat(val);
          if (!isNaN(num)) return num.toString();
        }
        return '0';
      }
    );

    const result = evaluateArithmetic(expression);
    return { value: result, error: null };
  } catch (err) {
    return { value: null, error: err.message || '#ERROR!' };
  }
}

function hasCircularReference(cellId, cells, visited = new Set(), path = new Set()) {
  if (path.has(cellId)) return true;
  if (visited.has(cellId)) return false;

  visited.add(cellId);
  path.add(cellId);

  const cellData = cells[cellId];
  if (cellData && cellData.rawValue) {
    const refs = extractCellReferences(cellData.rawValue);
    for (const ref of refs) {
      if (hasCircularReference(ref, cells, visited, path)) {
        return true;
      }
    }
  }

  path.delete(cellId);
  return false;
}

function getRecalculationOrder(changedCell, cells) {
  const dependents = new Map();

  // Build reverse dependency map
  for (const [cellId, cellData] of Object.entries(cells)) {
    if (cellData && cellData.rawValue) {
      const refs = extractCellReferences(cellData.rawValue);
      for (const ref of refs) {
        if (!dependents.has(ref)) {
          dependents.set(ref, new Set());
        }
        dependents.get(ref).add(cellId);
      }
    }
  }

  // BFS to find all affected cells
  const affected = new Set();
  const queue = [changedCell];

  while (queue.length > 0) {
    const cell = queue.shift();
    const deps = dependents.get(cell);
    if (deps) {
      for (const dep of deps) {
        if (!affected.has(dep)) {
          affected.add(dep);
          queue.push(dep);
        }
      }
    }
  }

  // Topological sort
  const result = [];
  const visited = new Set();

  function visit(cellId) {
    if (visited.has(cellId)) return;
    visited.add(cellId);

    const cellData = cells[cellId];
    if (cellData && cellData.rawValue) {
      const refs = extractCellReferences(cellData.rawValue);
      for (const ref of refs) {
        if (affected.has(ref)) {
          visit(ref);
        }
      }
    }
    result.push(cellId);
  }

  for (const cellId of affected) {
    visit(cellId);
  }

  return result;
}

export default function SpreadsheetPage() {
  const [cells, setCells] = useState({});
  const [selectedCell, setSelectedCell] = useState('A1');
  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef(null);
  const formulaInputRef = useRef(null);
  const containerRef = useRef(null);

  // Range selection state
  const [selectionStart, setSelectionStart] = useState(null); // Anchor cell for range selection
  const [selectionEnd, setSelectionEnd] = useState(null); // End cell for range selection
  const [isSelecting, setIsSelecting] = useState(false); // Currently dragging to select

  // Drag-to-fill state
  const [isDraggingFill, setIsDraggingFill] = useState(false);
  const [fillDragStart, setFillDragStart] = useState(null); // { x, y, cell }
  const [fillDragDirection, setFillDragDirection] = useState(null); // 'horizontal' | 'vertical' | null
  const [fillPreviewCells, setFillPreviewCells] = useState([]); // Array of cell addresses to highlight
  const cellRefs = useRef({}); // Map of cellId -> DOM element ref for position calculations

  const getCellValue = useCallback((cellId) => {
    const cell = cells[cellId];
    if (!cell) return '';
    if (cell.error) return '';
    return cell.computedValue ?? '';
  }, [cells]);

  const recalculateCell = useCallback((cellId, rawValue, currentCells) => {
    const result = parseFormula(rawValue, (ref) => {
      const cell = currentCells[ref];
      if (!cell) return '';
      if (cell.error) return 0;
      return cell.computedValue ?? '';
    });
    return {
      rawValue,
      computedValue: result.value,
      error: result.error
    };
  }, []);

  const updateCell = useCallback((cellId, newRawValue) => {
    setCells(prevCells => {
      // Create temporary cells with new value to check for circular reference
      const tempCells = {
        ...prevCells,
        [cellId]: { rawValue: newRawValue, computedValue: null, error: null }
      };

      if (hasCircularReference(cellId, tempCells)) {
        return {
          ...prevCells,
          [cellId]: {
            rawValue: newRawValue,
            computedValue: null,
            error: '#CIRCULAR!'
          }
        };
      }

      // Recalculate the changed cell
      const newCells = { ...prevCells };
      newCells[cellId] = recalculateCell(cellId, newRawValue, newCells);

      // Recalculate dependent cells
      const toRecalc = getRecalculationOrder(cellId, newCells);
      for (const recalcId of toRecalc) {
        if (recalcId !== cellId && newCells[recalcId]) {
          newCells[recalcId] = recalculateCell(recalcId, newCells[recalcId].rawValue, newCells);
        }
      }

      return newCells;
    });
  }, [recalculateCell]);

  const handleCellClick = useCallback((cellId, e) => {
    if (editingCell && editingCell !== cellId) {
      updateCell(editingCell, editValue);
      setEditingCell(null);
    }

    // Shift+click to extend selection
    if (e?.shiftKey && selectedCell) {
      setSelectionStart(selectedCell);
      setSelectionEnd(cellId);
    } else {
      // Regular click - single cell selection
      setSelectedCell(cellId);
      setSelectionStart(null);
      setSelectionEnd(null);
    }
  }, [editingCell, editValue, updateCell, selectedCell]);

  // Handle mouse down for drag selection
  const handleCellMouseDown = useCallback((cellId, e) => {
    // Don't start selection if shift is held (handled by click)
    if (e.shiftKey) return;

    // Prevent text selection during drag
    e.preventDefault();

    // Maintain focus on container for keyboard events
    containerRef.current?.focus();

    // Commit any pending edit
    if (editingCell && editingCell !== cellId) {
      updateCell(editingCell, editValue);
      setEditingCell(null);
    }

    setSelectedCell(cellId);
    setSelectionStart(cellId);
    setSelectionEnd(cellId);
    setIsSelecting(true);
  }, [editingCell, editValue, updateCell]);

  // Handle mouse enter during drag selection
  const handleCellMouseEnter = useCallback((cellId) => {
    if (isSelecting && selectionStart) {
      setSelectionEnd(cellId);
    }
  }, [isSelecting, selectionStart]);

  // Handle mouse up to finish selection
  useEffect(() => {
    const handleMouseUp = () => {
      if (isSelecting) {
        setIsSelecting(false);
      }
    };

    document.addEventListener('mouseup', handleMouseUp);
    return () => document.removeEventListener('mouseup', handleMouseUp);
  }, [isSelecting]);

  const handleCellDoubleClick = useCallback((cellId) => {
    setEditingCell(cellId);
    const cell = cells[cellId];
    setEditValue(cell?.rawValue ?? '');
  }, [cells]);

  const startEditing = useCallback((cellId, initialValue = '') => {
    setEditingCell(cellId);
    const cell = cells[cellId];
    if (initialValue) {
      setEditValue(initialValue);
    } else {
      setEditValue(cell?.rawValue ?? '');
    }
  }, [cells]);

  const commitEdit = useCallback(() => {
    if (editingCell) {
      updateCell(editingCell, editValue);
      setEditingCell(null);
    }
    // Restore focus to container so keyboard input is captured
    containerRef.current?.focus();
  }, [editingCell, editValue, updateCell]);

  const cancelEdit = useCallback(() => {
    setEditingCell(null);
    setEditValue('');
    // Restore focus to container so keyboard input is captured
    containerRef.current?.focus();
  }, []);

  const moveSelection = useCallback((dCol, dRow) => {
    const current = parseCellAddress(selectedCell);
    if (!current) return;

    const newCol = Math.max(0, Math.min(NUM_COLS - 1, current.col + dCol));
    const newRow = Math.max(0, Math.min(NUM_ROWS - 1, current.row + dRow));
    const newCellId = getCellAddress(newCol, newRow);

    if (editingCell) {
      commitEdit();
    }
    setSelectedCell(newCellId);
    // Clear range selection when moving with arrows
    setSelectionStart(null);
    setSelectionEnd(null);
  }, [selectedCell, editingCell, commitEdit]);

  // Get all cells in the current selection (single cell or range)
  const getSelectedCells = useCallback(() => {
    if (selectionStart && selectionEnd) {
      return expandRange(selectionStart, selectionEnd);
    }
    return [selectedCell];
  }, [selectedCell, selectionStart, selectionEnd]);

  // Check if a cell is within the current selection range
  const isCellInSelection = useCallback((cellId) => {
    if (!selectionStart || !selectionEnd) return false;
    const selectedCells = expandRange(selectionStart, selectionEnd);
    return selectedCells.includes(cellId);
  }, [selectionStart, selectionEnd]);

  // Batch delete multiple cells
  const deleteSelectedCells = useCallback(() => {
    const cellsToDelete = getSelectedCells();
    if (cellsToDelete.length === 1) {
      updateCell(cellsToDelete[0], '');
    } else {
      // Batch update for better performance
      setCells(prevCells => {
        const newCells = { ...prevCells };

        // First, clear all selected cells
        for (const cellId of cellsToDelete) {
          newCells[cellId] = { rawValue: '', computedValue: '', error: null };
        }

        // Collect all cells that need recalculation
        const allAffected = new Set();
        for (const cellId of cellsToDelete) {
          const affected = getRecalculationOrder(cellId, newCells);
          for (const affectedId of affected) {
            if (!cellsToDelete.includes(affectedId)) {
              allAffected.add(affectedId);
            }
          }
        }

        // Recalculate affected cells
        for (const recalcId of allAffected) {
          if (newCells[recalcId] && newCells[recalcId].rawValue) {
            newCells[recalcId] = recalculateCell(recalcId, newCells[recalcId].rawValue, newCells);
          }
        }

        return newCells;
      });
    }
  }, [getSelectedCells, updateCell, recalculateCell]);

  const handleKeyDown = useCallback((e) => {
    if (editingCell) {
      if (e.key === 'Enter') {
        e.preventDefault();
        commitEdit();
        moveSelection(0, 1);
      } else if (e.key === 'Tab') {
        e.preventDefault();
        commitEdit();
        moveSelection(e.shiftKey ? -1 : 1, 0);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancelEdit();
      }
    } else {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        moveSelection(0, -1);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        moveSelection(0, 1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        moveSelection(-1, 0);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        moveSelection(1, 0);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        startEditing(selectedCell);
      } else if (e.key === 'Tab') {
        e.preventDefault();
        moveSelection(e.shiftKey ? -1 : 1, 0);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteSelectedCells();
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        startEditing(selectedCell, e.key);
      }
    }
  }, [editingCell, selectedCell, commitEdit, cancelEdit, moveSelection, startEditing, deleteSelectedCells]);

  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingCell]);

  const handleFormulaBarChange = useCallback((e) => {
    setEditValue(e.target.value);
    if (!editingCell) {
      setEditingCell(selectedCell);
    }
  }, [editingCell, selectedCell]);

  const handleFormulaBarKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitEdit();
      formulaInputRef.current?.blur();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEdit();
      formulaInputRef.current?.blur();
    }
  }, [commitEdit, cancelEdit]);

  const handleFormulaBarFocus = useCallback(() => {
    if (!editingCell) {
      setEditingCell(selectedCell);
      const cell = cells[selectedCell];
      setEditValue(cell?.rawValue ?? '');
    }
  }, [editingCell, selectedCell, cells]);

  const displayValue = useCallback((cellId) => {
    const cell = cells[cellId];
    if (!cell) return '';
    if (cell.error) return cell.error;
    if (cell.computedValue === null || cell.computedValue === undefined) return '';
    if (typeof cell.computedValue === 'number') {
      return Number.isInteger(cell.computedValue)
        ? cell.computedValue.toString()
        : cell.computedValue.toFixed(2);
    }
    return cell.computedValue;
  }, [cells]);

  // Drag-to-fill: Apply fill to target cells
  const applyFill = useCallback((sourceCell, targetCells) => {
    const sourceData = cells[sourceCell];
    if (!sourceData) return;

    const sourceCoords = parseCellAddress(sourceCell);
    if (!sourceCoords) return;

    targetCells.forEach((targetCell) => {
      const targetCoords = parseCellAddress(targetCell);
      if (!targetCoords) return;

      // Calculate offset from source to target
      const colOffset = targetCoords.col - sourceCoords.col;
      const rowOffset = targetCoords.row - sourceCoords.row;

      let newValue;
      if (sourceData.rawValue && sourceData.rawValue.startsWith('=')) {
        // Adjust formula references
        newValue = adjustFormulaReferences(sourceData.rawValue, colOffset, rowOffset);
      } else {
        // Plain value - copy as-is
        newValue = sourceData.rawValue || '';
      }

      updateCell(targetCell, newValue);
    });
  }, [cells, updateCell]);

  // Drag-to-fill: Handle mouse down on fill handle
  const handleFillHandleMouseDown = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent cell selection

    setIsDraggingFill(true);
    setFillDragStart({
      x: e.clientX,
      y: e.clientY,
      cell: selectedCell
    });
    setFillDragDirection(null);
    setFillPreviewCells([]);
  }, [selectedCell]);

  // Drag-to-fill: Document-level mouse tracking
  useEffect(() => {
    if (!isDraggingFill || !fillDragStart) return;

    const handleMouseMove = (e) => {
      const { x: startX, y: startY, cell: sourceCell } = fillDragStart;

      // Determine direction if not yet locked
      let direction = fillDragDirection;
      if (!direction) {
        direction = determineDragDirection(startX, startY, e.clientX, e.clientY);
        if (direction) {
          setFillDragDirection(direction);
        }
      }

      if (!direction) return; // Not enough movement yet

      // Calculate which cell the mouse is over based on cell positions
      const sourceCoords = parseCellAddress(sourceCell);
      if (!sourceCoords) return;

      const fillCells = [];

      // Find the target cell by checking all cell refs
      for (const [cellId, el] of Object.entries(cellRefs.current)) {
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        const isInside = e.clientX >= rect.left && e.clientX <= rect.right &&
          e.clientY >= rect.top && e.clientY <= rect.bottom;

        if (isInside) {
          const targetCoords = parseCellAddress(cellId);
          if (!targetCoords) break;

          if (direction === 'horizontal') {
            // Fill horizontally from source to target column (same row)
            const startCol = Math.min(sourceCoords.col, targetCoords.col);
            const endCol = Math.max(sourceCoords.col, targetCoords.col);
            for (let col = startCol; col <= endCol; col++) {
              const addr = getCellAddress(col, sourceCoords.row);
              if (addr !== sourceCell) {
                fillCells.push(addr);
              }
            }
          } else {
            // Fill vertically from source to target row (same column)
            const startRow = Math.min(sourceCoords.row, targetCoords.row);
            const endRow = Math.max(sourceCoords.row, targetCoords.row);
            for (let row = startRow; row <= endRow; row++) {
              const addr = getCellAddress(sourceCoords.col, row);
              if (addr !== sourceCell) {
                fillCells.push(addr);
              }
            }
          }
          break;
        }
      }

      setFillPreviewCells(fillCells);
    };

    const handleMouseUp = () => {
      // Apply the fill
      if (fillPreviewCells.length > 0 && fillDragStart) {
        applyFill(fillDragStart.cell, fillPreviewCells);
      }

      // Reset state
      setIsDraggingFill(false);
      setFillDragStart(null);
      setFillDragDirection(null);
      setFillPreviewCells([]);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingFill, fillDragStart, fillDragDirection, fillPreviewCells, applyFill]);

  // Focus the container on mount so keyboard input is captured immediately
  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  const columns = Array.from({ length: NUM_COLS }, (_, i) => columnIndexToLetter(i));
  const rows = Array.from({ length: NUM_ROWS }, (_, i) => i + 1);

  return (
    <div ref={containerRef} className="app app-full-width" onKeyDown={handleKeyDown} tabIndex={0}>
      <div className="spreadsheet-formula-bar">
        <span className="spreadsheet-cell-address">{selectedCell}</span>
        <input
          ref={formulaInputRef}
          type="text"
          className="spreadsheet-formula-input"
          value={editingCell ? editValue : (cells[selectedCell]?.rawValue ?? '')}
          onChange={handleFormulaBarChange}
          onKeyDown={handleFormulaBarKeyDown}
          onFocus={handleFormulaBarFocus}
          placeholder="Enter a value or formula"
        />
      </div>

      <div className={`spreadsheet-container${isDraggingFill ? ' is-filling' : ''}${isSelecting ? ' is-selecting' : ''}`}>
        <table className="spreadsheet-grid">
          <thead>
            <tr>
              <th className="spreadsheet-header-cell spreadsheet-corner"></th>
              {columns.map(col => (
                <th key={col} className="spreadsheet-header-cell spreadsheet-col-header">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row}>
                <td className="spreadsheet-header-cell spreadsheet-row-header">{row}</td>
                {columns.map(col => {
                  const cellId = `${col}${row}`;
                  const isSelected = cellId === selectedCell;
                  const isEditing = cellId === editingCell;
                  const isFillPreview = fillPreviewCells.includes(cellId);
                  const isInSelection = isCellInSelection(cellId);
                  const cell = cells[cellId];
                  const hasError = cell?.error;

                  return (
                    <td
                      key={cellId}
                      ref={(el) => { cellRefs.current[cellId] = el; }}
                      className={`spreadsheet-cell${isSelected ? ' spreadsheet-cell-selected' : ''}${isInSelection ? ' spreadsheet-cell-in-selection' : ''}${hasError ? ' spreadsheet-cell-error' : ''}${isEditing ? ' spreadsheet-cell-editing' : ''}${isFillPreview ? ' spreadsheet-cell-fill-preview' : ''}`}
                      onClick={(e) => handleCellClick(cellId, e)}
                      onMouseDown={(e) => handleCellMouseDown(cellId, e)}
                      onMouseEnter={() => handleCellMouseEnter(cellId)}
                      onDoubleClick={() => handleCellDoubleClick(cellId)}
                    >
                      {isEditing ? (
                        <input
                          ref={inputRef}
                          type="text"
                          className="spreadsheet-cell-input"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={commitEdit}
                        />
                      ) : (
                        displayValue(cellId)
                      )}
                      {isSelected && !isEditing && (
                        <div
                          className="spreadsheet-fill-handle"
                          onMouseDown={handleFillHandleMouseDown}
                        />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
