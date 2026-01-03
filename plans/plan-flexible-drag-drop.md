# Flexible Drag-and-Drop Reordering (Trello-like)

## Overview
Enhance the existing drag-and-drop system to allow more flexible reordering of both accounts and groups in a Trello-like manner.

## Requirements
1. **Flat hierarchy** - Accounts and groups can be freely mixed at the top level
2. **Both behaviors** - Accounts inside groups can be reordered, AND groups can be dragged as units
3. **Keep cross-group transfers** - Preserve ability to drag accounts between groups

## Current State Analysis
The backend already supports all required operations - no backend changes needed:
- `UpdatePositions` handles mixed group/account positioning
- `UpdateAccountPositionsInGroup` handles within-group ordering
- `ModifyGroupMembership` handles cross-group transfers

The frontend needs enhancements for better group dragging UX.

---

## Implementation Plan

### Phase 1: Add DragOverlay Support for Groups

**File:** [AccountList.jsx](frontend/src/components/AccountList.jsx)

1. Update `handleDragStart` (around line 231) to detect group drags:
   ```javascript
   // Add after line 262, before the closing brace
   } else if (parsed.type === 'group') {
     const groupItem = listData.items.find(
       (item) => item.type === 'group' && item.group.id === parsed.groupId
     );
     if (groupItem) {
       setActiveItem({ type: 'group', data: groupItem.group });
     }
   }
   ```

2. Update `DragOverlay` (around line 884) to render group preview:
   ```javascript
   {activeItem?.type === 'group' && (
     <div className="drag-overlay drag-overlay-group">
       <GroupCardPreview group={activeItem.data} />
     </div>
   )}
   ```

3. Import `GroupCardPreview` from GroupCard.jsx

---

### Phase 2: Add Dedicated Drag Handle for Groups

**File:** [AccountList.jsx](frontend/src/components/AccountList.jsx)

Modify `SortableItem` component (lines 32-55) to pass drag listeners separately for groups:

```javascript
function SortableItem({ item, children }) {
  const id = item.type === 'group' ? `group-${item.group.id}` : `account-${item.account.id}`;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1,
    zIndex: isDragging ? 1000 : 'auto',
  };

  // For groups, pass listeners to child for dedicated drag handle
  if (item.type === 'group') {
    return (
      <div ref={setNodeRef} style={style} {...attributes}>
        {React.cloneElement(children, { dragHandleProps: listeners })}
      </div>
    );
  }

  // For accounts, apply listeners to wrapper (current behavior)
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  );
}
```

---

### Phase 3: Update GroupCard Component

**File:** [GroupCard.jsx](frontend/src/components/GroupCard.jsx)

1. Add `GripVertical` import from lucide-react

2. Add `dragHandleProps` to component props (line 46-53)

3. Add drag handle in the header (after line 97):
   ```javascript
   <div className="group-drag-handle" {...dragHandleProps}>
     <GripVertical size={18} />
   </div>
   ```

4. Export new `GroupCardPreview` component:
   ```javascript
   export function GroupCardPreview({ group }) {
     const formatCurrency = (amount) => {
       return new Intl.NumberFormat('en-US', {
         style: 'currency',
         currency: 'USD',
       }).format(amount);
     };

     return (
       <div className="group-card group-card-preview">
         <div className="group-color-indicator" style={{ backgroundColor: group.color }} />
         <div className="group-card-header">
           <div className="group-header-left">
             <h3 className="group-name">{group.group_name}</h3>
             <span className="group-account-count">
               ({group.accounts?.length || 0} accounts)
             </span>
           </div>
           <div className="group-header-right">
             <span className="group-total">{formatCurrency(group.total_balance)}</span>
           </div>
         </div>
       </div>
     );
   }
   ```

---

### Phase 4: Add CSS Styles

**File:** [App.css](frontend/src/App.css)

Add after line 1370:

```css
/* Group drag handle */
.group-drag-handle {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-2);
  margin-right: var(--space-2);
  color: var(--color-text-muted);
  cursor: grab;
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
}

.group-drag-handle:hover {
  background-color: var(--color-surface-hover);
  color: var(--color-text-secondary);
}

.group-drag-handle:active {
  cursor: grabbing;
}

/* Group drag overlay */
.drag-overlay-group .group-card {
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
  border: 2px solid var(--color-primary);
  background: var(--color-surface);
}

.group-card-preview {
  pointer-events: none;
}
```

---

## Files to Modify

| File | Changes |
|------|---------|
| [AccountList.jsx](frontend/src/components/AccountList.jsx) | Update `handleDragStart`, modify `SortableItem`, update `DragOverlay` |
| [GroupCard.jsx](frontend/src/components/GroupCard.jsx) | Add drag handle, accept `dragHandleProps`, export `GroupCardPreview` |
| [App.css](frontend/src/App.css) | Add styles for drag handle and group overlay |

---

## Testing Checklist

- [ ] Drag a group via the handle - should reorder in main list
- [ ] Click on group header (not handle) - should expand/collapse
- [ ] Click on group name - should navigate to detail page
- [ ] Drag an account within a group - should reorder
- [ ] Drag an account from Group A to Group B - should transfer
- [ ] Drag an account to ungrouped zone - should remove from group
- [ ] Drag an ungrouped account to a group - should add to group
- [ ] Verify drag overlay shows correct preview for both groups and accounts
- [ ] Cancel a drag mid-operation - should restore original state
