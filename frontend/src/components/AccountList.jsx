import { useState, useEffect, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  pointerWithin,
  rectIntersection,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { listApi, accountsApi, groupsApi } from '../services/api';
import AccountCard from './AccountCard';
import GroupCard from './GroupCard';
import AccountForm from './AccountForm';
import GroupForm from './GroupForm';
import EditAccountModal from './EditAccountModal';
import HistoryTable from './HistoryTable';

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

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  );
}

function UnGroupedDropZone({ isVisible }) {
  const { setNodeRef, isOver } = useDroppable({
    id: 'ungrouped-drop',
  });

  if (!isVisible) return null;

  return (
    <div
      ref={setNodeRef}
      className={`ungrouped-drop-zone ${isOver ? 'ungrouped-drop-zone-active' : ''}`}
    >
      <p>Drop here to remove from group</p>
    </div>
  );
}

export default function AccountList() {
  const [listData, setListData] = useState({ items: [], total_balance: 0 });
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddAccountForm, setShowAddAccountForm] = useState(false);
  const [showAddGroupForm, setShowAddGroupForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [editingGroup, setEditingGroup] = useState(null);
  const [viewingHistory, setViewingHistory] = useState(null);
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const [activeId, setActiveId] = useState(null);
  const [activeItem, setActiveItem] = useState(null);
  const [draggedWithinGroup, setDraggedWithinGroup] = useState(null); // Track group ID if reordering within a group
  const [dragSourceGroupId, setDragSourceGroupId] = useState(null); // Track source group for cross-group transfers
  const [crossGroupDragTarget, setCrossGroupDragTarget] = useState(null); // Track cross-group drag { groupId, position }

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Helper to find which group an account belongs to
  const findAccountGroup = useCallback((accountId) => {
    for (const item of listData.items) {
      if (item.type === 'group' && item.group.accounts) {
        const account = item.group.accounts.find((a) => a.id === accountId);
        if (account) {
          return item.group;
        }
      }
    }
    return null;
  }, [listData.items]);

  // Custom collision detection that prioritizes group drop zones
  // but allows sorting within groups (same or different)
  const collisionDetection = useCallback((args) => {
    const { active } = args;
    const activeIdStr = String(active.id);

    // Check if we're dragging an account that's in a group
    let activeAccountGroupId = null;
    if (activeIdStr.startsWith('account-')) {
      const accountId = parseInt(activeIdStr.replace('account-', ''), 10);
      const group = findAccountGroup(accountId);
      if (group) {
        activeAccountGroupId = group.id;
      }
    }

    // First check for droppable zones (groups and ungrouped)
    const pointerCollisions = pointerWithin(args);

    // Check for ungrouped drop zone (only valid if dragging from a group)
    const ungroupedDropCollision = pointerCollisions.find(
      (collision) => String(collision.id) === 'ungrouped-drop'
    );
    if (ungroupedDropCollision && activeAccountGroupId !== null) {
      return [ungroupedDropCollision];
    }

    const groupDropCollision = pointerCollisions.find(
      (collision) => String(collision.id).startsWith('group-drop-')
    );

    // If hovering over a group drop zone, use closestCenter to allow positioning
    if (groupDropCollision) {
      // Use closestCenter for sorting within any group (same or different)
      return closestCenter(args);
    }

    // Fall back to closest center for sortable reordering
    return closestCenter(args);
  }, [findAccountGroup]);

  const fetchData = async (isInitialLoad = false) => {
    try {
      setError('');
      const [listResponse, groupsResponse] = await Promise.all([
        listApi.getGroupedList(),
        groupsApi.getAll(),
      ]);
      setListData(listResponse);
      setGroups(groupsResponse);

      // On initial load, expand all groups by default
      if (isInitialLoad) {
        const allGroupIds = listResponse.items
          .filter((item) => item.type === 'group')
          .map((item) => item.group.id);
        setExpandedGroups(new Set(allGroupIds));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(true);
  }, []);

  const handleToggleExpand = (groupId) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const handleDragStart = (event) => {
    const { active } = event;
    setActiveId(active.id);

    // Find the active item to render in the overlay
    const id = String(active.id);
    if (id.startsWith('account-')) {
      const accountId = parseInt(id.replace('account-', ''), 10);
      // Search in ungrouped accounts
      const ungroupedItem = listData.items.find(
        (item) => item.type === 'account' && item.account.id === accountId
      );
      if (ungroupedItem) {
        setActiveItem({ type: 'account', data: ungroupedItem.account });
        setDragSourceGroupId(null);
      } else {
        // Search in grouped accounts
        for (const item of listData.items) {
          if (item.type === 'group' && item.group.accounts) {
            const account = item.group.accounts.find((a) => a.id === accountId);
            if (account) {
              setActiveItem({ type: 'account', data: account });
              setDragSourceGroupId(item.group.id);
              break;
            }
          }
        }
      }
    }
  };

  const handleDragCancel = () => {
    setActiveId(null);
    setActiveItem(null);
    setDraggedWithinGroup(null);
    setDragSourceGroupId(null);
    setCrossGroupDragTarget(null);
    // Refetch to reset any temporary UI changes
    fetchData();
  };

  const handleDragOver = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeIdStr = String(active.id);
    const overIdStr = String(over.id);

    // Handle real-time reordering within a group or cross-group positioning
    if (activeIdStr.startsWith('account-') && overIdStr.startsWith('account-')) {
      const activeAccountId = parseInt(activeIdStr.replace('account-', ''), 10);
      const overAccountId = parseInt(overIdStr.replace('account-', ''), 10);

      // Use dragSourceGroupId (set at drag start) to determine the real source group,
      // since findAccountGroup uses the current UI state which may have been modified during drag preview
      const overGroup = findAccountGroup(overAccountId);

      // Both accounts are in the same group - update UI in real-time
      // Use dragSourceGroupId to check if we're actually in the same group (not just visually)
      if (dragSourceGroupId !== null && overGroup && dragSourceGroupId === overGroup.id) {
        const group = overGroup;
        const accounts = group.accounts;
        const activeIndex = accounts.findIndex((a) => a.id === activeAccountId);
        const overIndex = accounts.findIndex((a) => a.id === overAccountId);

        if (activeIndex !== -1 && overIndex !== -1 && activeIndex !== overIndex) {
          // Track that we're reordering within this group
          setDraggedWithinGroup(group.id);
          setCrossGroupDragTarget(null);
          setListData((prev) => ({
            ...prev,
            items: prev.items.map((item) => {
              if (item.type === 'group' && item.group.id === group.id) {
                return {
                  ...item,
                  group: {
                    ...item.group,
                    accounts: arrayMove([...item.group.accounts], activeIndex, overIndex),
                  },
                };
              }
              return item;
            }),
          }));
        }
      } else if (overGroup && (dragSourceGroupId === null || dragSourceGroupId !== overGroup.id)) {
        // Cross-group drag: account is being dragged over an account in a different group
        // dragSourceGroupId === null means ungrouped account, !== overGroup.id means different group
        // Find position in the target group, excluding the dragged item if it's already there (from preview)
        const accountsWithoutDragged = overGroup.accounts.filter((a) => a.id !== activeAccountId);
        const overIndexInFiltered = accountsWithoutDragged.findIndex((a) => a.id === overAccountId);
        const targetPosition = overIndexInFiltered + 1;

        // Track cross-group target position (1-indexed)
        setCrossGroupDragTarget({ groupId: overGroup.id, position: targetPosition });
        setDraggedWithinGroup(null);

        // Update UI to show the account in its new position temporarily
        setListData((prev) => {
          // First, find the dragged account from the original data
          let draggedAccount = null;
          for (const item of prev.items) {
            if (item.type === 'account' && item.account.id === activeAccountId) {
              draggedAccount = item.account;
              break;
            }
            if (item.type === 'group' && item.group.accounts) {
              const found = item.group.accounts.find((a) => a.id === activeAccountId);
              if (found) {
                draggedAccount = found;
                break;
              }
            }
          }

          if (!draggedAccount) return prev;

          return {
            ...prev,
            items: prev.items.map((item) => {
              // Remove from source (ungrouped or source group)
              if (item.type === 'account' && item.account.id === activeAccountId) {
                return null; // Will be filtered out
              }
              if (item.type === 'group') {
                // Filter out the dragged account from all groups first
                let newAccounts = item.group.accounts?.filter((a) => a.id !== activeAccountId) || [];

                // Add to target group at the right position
                if (item.group.id === overGroup.id) {
                  newAccounts = [...newAccounts];
                  newAccounts.splice(overIndexInFiltered, 0, draggedAccount);
                }

                return {
                  ...item,
                  group: {
                    ...item.group,
                    accounts: newAccounts,
                  },
                };
              }
              return item;
            }).filter(Boolean),
          };
        });
      }
    } else if (activeIdStr.startsWith('account-') && overIdStr.startsWith('group-drop-')) {
      // Dragging over empty group area (not over a specific account)
      const targetGroupId = parseInt(overIdStr.replace('group-drop-', ''), 10);
      const activeAccountId = parseInt(activeIdStr.replace('account-', ''), 10);
      const activeGroup = findAccountGroup(activeAccountId);

      if (!activeGroup || activeGroup.id !== targetGroupId) {
        // Find the target group to get account count
        const targetGroupItem = listData.items.find(
          (item) => item.type === 'group' && item.group.id === targetGroupId
        );
        const accountCount = targetGroupItem?.group?.accounts?.length || 0;

        // Position at end of group
        setCrossGroupDragTarget({ groupId: targetGroupId, position: accountCount + 1 });
        setDraggedWithinGroup(null);
      }
    }
  };

  const handleDragEnd = async (event) => {
    setActiveId(null);
    setActiveItem(null);

    const { active, over } = event;
    const groupIdForReorder = draggedWithinGroup;
    const sourceGroupId = dragSourceGroupId;
    const crossGroupTarget = crossGroupDragTarget;
    setDraggedWithinGroup(null); // Reset the tracking state
    setDragSourceGroupId(null);
    setCrossGroupDragTarget(null);

    // If we reordered within a group during drag, persist the new order
    if (groupIdForReorder !== null) {
      const currentGroupItem = listData.items.find(
        (item) => item.type === 'group' && item.group.id === groupIdForReorder
      );
      if (currentGroupItem && currentGroupItem.group.accounts) {
        const positions = currentGroupItem.group.accounts.map((account, index) => ({
          id: account.id,
          position_in_group: index + 1,
        }));

        try {
          await groupsApi.updateAccountPositionsInGroup(groupIdForReorder, positions);
        } catch (err) {
          setError('Failed to save account order');
          fetchData();
        }
      }
      return;
    }

    // If we have a cross-group drag target, use it
    if (crossGroupTarget !== null) {
      const activeIdStr = String(active.id);
      if (activeIdStr.startsWith('account-')) {
        const accountId = parseInt(activeIdStr.replace('account-', ''), 10);

        // Skip if dropping into the same group (shouldn't happen but safety check)
        if (sourceGroupId === crossGroupTarget.groupId) {
          fetchData();
          return;
        }

        try {
          await accountsApi.setGroup(accountId, crossGroupTarget.groupId, crossGroupTarget.position);
          await fetchData();
        } catch (err) {
          setError('Failed to move account to group');
          fetchData();
        }
      }
      return;
    }

    if (!over || active.id === over.id) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    // Check if dropping an account onto the ungrouped drop zone
    if (activeId.startsWith('account-') && overId === 'ungrouped-drop') {
      const accountId = parseInt(activeId.replace('account-', ''), 10);

      try {
        await accountsApi.setGroup(accountId, null);
        await fetchData();
      } catch (err) {
        setError('Failed to remove account from group');
      }
      return;
    }

    // Check if dropping an account onto a group drop target (works for both ungrouped→group and group→group)
    if (activeId.startsWith('account-') && overId.startsWith('group-drop-')) {
      const accountId = parseInt(activeId.replace('account-', ''), 10);
      const targetGroupId = parseInt(overId.replace('group-drop-', ''), 10);

      // Skip if dropping into the same group
      if (sourceGroupId === targetGroupId) {
        return;
      }

      try {
        // Default to end of group when dropping on the group zone itself
        await accountsApi.setGroup(accountId, targetGroupId);
        await fetchData();
      } catch (err) {
        setError('Failed to move account to group');
      }
      return;
    }

    // Handle dropping on an account in a different group
    if (activeId.startsWith('account-') && overId.startsWith('account-')) {
      const accountId = parseInt(activeId.replace('account-', ''), 10);
      const overAccountId = parseInt(overId.replace('account-', ''), 10);

      const overGroup = findAccountGroup(overAccountId);
      if (overGroup && overGroup.id !== sourceGroupId) {
        const overIndex = overGroup.accounts.findIndex((a) => a.id === overAccountId);
        const targetPosition = overIndex + 1;

        try {
          await accountsApi.setGroup(accountId, overGroup.id, targetPosition);
          await fetchData();
        } catch (err) {
          setError('Failed to move account to group');
        }
        return;
      }
    }

    // Check if we're reordering main list items
    const activeIndex = listData.items.findIndex((item) => {
      const itemId = item.type === 'group' ? `group-${item.group.id}` : `account-${item.account.id}`;
      return itemId === activeId;
    });

    const overIndex = listData.items.findIndex((item) => {
      const itemId = item.type === 'group' ? `group-${item.group.id}` : `account-${item.account.id}`;
      return itemId === overId;
    });

    if (activeIndex !== -1 && overIndex !== -1) {
      // Reordering main list
      const newItems = arrayMove(listData.items, activeIndex, overIndex);
      setListData({ ...listData, items: newItems });

      // Build positions array
      const positions = newItems.map((item, index) => ({
        id: item.type === 'group' ? item.group.id : item.account.id,
        position: index + 1,
        is_group: item.type === 'group',
      }));

      try {
        await groupsApi.updatePositions(positions);
      } catch (err) {
        setError('Failed to save order');
        fetchData();
      }
    }
  };

  const handleCreateAccount = async (name, info, balance, calculatedData, groupId) => {
    await accountsApi.create(name, info, balance, calculatedData);
    // If a group was selected, assign the account to the group
    if (groupId) {
      const accounts = await accountsApi.getAll();
      const newAccount = accounts[accounts.length - 1]; // Get the newly created account
      await accountsApi.setGroup(newAccount.id, groupId);
    }
    await fetchData();
    setShowAddAccountForm(false);
  };

  const handleCreateGroup = async (name, description, color) => {
    await groupsApi.create(name, description, color);
    await fetchData();
    setShowAddGroupForm(false);
  };

  const handleUpdateAccount = async (id, name, info) => {
    await accountsApi.updateName(id, name);
    await accountsApi.updateInfo(id, info);
    await fetchData();
    setEditingAccount(null);
  };

  const handleUpdateGroup = async (name, description, color, isCalculated, formula) => {
    await groupsApi.update(editingGroup.id, name, description, color, isCalculated, formula);
    await fetchData();
    setEditingGroup(null);
  };

  const handleUpdateBalance = async (id, balance) => {
    await accountsApi.updateBalance(id, balance);
    await fetchData();
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  // Get all accounts for calculated account formulas
  const allAccounts = listData.items.reduce((acc, item) => {
    if (item.type === 'account') {
      acc.push(item.account);
    } else if (item.type === 'group' && item.group.accounts) {
      acc.push(...item.group.accounts);
    }
    return acc;
  }, []);

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  const sortableIds = listData.items.map((item) =>
    item.type === 'group' ? `group-${item.group.id}` : `account-${item.account.id}`
  );

  return (
    <div className="app">
      <div className="header">
        <p className="total-balance">Total: {formatCurrency(listData.total_balance)}</p>
        <div className="header-actions">
          <button
            onClick={() => {
              setShowAddGroupForm(!showAddGroupForm);
              setShowAddAccountForm(false);
            }}
            className="btn-secondary"
          >
            {showAddGroupForm ? 'Cancel' : '+ Add Group'}
          </button>
          <button
            onClick={() => {
              setShowAddAccountForm(!showAddAccountForm);
              setShowAddGroupForm(false);
            }}
            className="btn-primary"
          >
            {showAddAccountForm ? 'Cancel' : '+ Add Account'}
          </button>
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      {showAddGroupForm && (
        <GroupForm
          onSubmit={handleCreateGroup}
          onCancel={() => setShowAddGroupForm(false)}
        />
      )}

      {showAddAccountForm && (
        <AccountForm
          onSubmit={handleCreateAccount}
          onCancel={() => setShowAddAccountForm(false)}
          accounts={allAccounts.filter((a) => !a.is_calculated)}
          groups={groups}
        />
      )}

      {listData.items.length === 0 ? (
        <p className="empty-state">No accounts or groups yet. Add your first one to get started!</p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={collisionDetection}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
            <div className="list-container">
              {listData.items.map((item) => (
                <SortableItem key={item.type === 'group' ? `group-${item.group.id}` : `account-${item.account.id}`} item={item}>
                  {item.type === 'group' ? (
                    <GroupCard
                      group={item.group}
                      isExpanded={expandedGroups.has(item.group.id)}
                      onToggleExpand={handleToggleExpand}
                      onEdit={setEditingGroup}
                      onEditAccount={setEditingAccount}
                      onUpdateBalance={handleUpdateBalance}
                      onViewHistory={setViewingHistory}
                    />
                  ) : (
                    <AccountCard
                      account={item.account}
                      onEdit={setEditingAccount}
                      onUpdateBalance={handleUpdateBalance}
                      onViewHistory={setViewingHistory}
                    />
                  )}
                </SortableItem>
              ))}
            </div>
          </SortableContext>
          <UnGroupedDropZone isVisible={dragSourceGroupId !== null} />
          <DragOverlay dropAnimation={{ duration: 200, easing: 'ease' }}>
            {activeItem?.type === 'account' && (
              <div className="drag-overlay">
                <AccountCard
                  account={activeItem.data}
                  onEdit={() => { }}
                  onUpdateBalance={() => { }}
                  onViewHistory={() => { }}
                />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      {editingAccount && (
        <EditAccountModal
          account={editingAccount}
          onSubmit={handleUpdateAccount}
          onClose={() => setEditingAccount(null)}
        />
      )}

      {editingGroup && (
        <div className="modal-overlay" onClick={() => setEditingGroup(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <GroupForm
              initialData={editingGroup}
              accounts={editingGroup.accounts || []}
              onSubmit={handleUpdateGroup}
              onCancel={() => setEditingGroup(null)}
            />
          </div>
        </div>
      )}

      {viewingHistory && (
        <HistoryTable
          accountId={viewingHistory.id}
          accountName={viewingHistory.account_name}
          onClose={() => setViewingHistory(null)}
        />
      )}
    </div>
  );
}
