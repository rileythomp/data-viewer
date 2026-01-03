import React, { useState, useEffect, useCallback } from 'react';
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
import { Settings } from 'lucide-react';
import { listApi, accountsApi, groupsApi } from '../services/api';
import AccountCard from './AccountCard';
import GroupCard, { GroupCardPreview } from './GroupCard';
import AccountForm from './AccountForm';
import GroupForm from './GroupForm';
import EditAccountModal from './EditAccountModal';
import BalanceHistoryModal from './BalanceHistoryModal';
import SettingsModal from './SettingsModal';

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
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const [activeId, setActiveId] = useState(null);
  const [activeItem, setActiveItem] = useState(null);
  const [draggedWithinGroup, setDraggedWithinGroup] = useState(null); // Track group ID if reordering within a group
  const [dragSourceGroupId, setDragSourceGroupId] = useState(null); // Track source group for cross-group transfers
  const [crossGroupDragTarget, setCrossGroupDragTarget] = useState(null); // Track cross-group drag { groupId, position }
  const [originalListData, setOriginalListData] = useState(null); // Store original state for cross-group drag preview
  const [groupReordered, setGroupReordered] = useState(false); // Track if groups were reordered during drag

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

  // Helper to parse drag IDs - handles both "account-{id}" and "group-{groupId}-account-{accountId}"
  const parseDragId = useCallback((idStr) => {
    const str = String(idStr);
    // Check for composite ID: "group-{groupId}-account-{accountId}"
    const compositeMatch = str.match(/^group-(\d+)-account-(\d+)$/);
    if (compositeMatch) {
      return {
        type: 'grouped-account',
        groupId: parseInt(compositeMatch[1], 10),
        accountId: parseInt(compositeMatch[2], 10),
      };
    }
    // Check for simple account ID: "account-{id}"
    if (str.startsWith('account-')) {
      return {
        type: 'ungrouped-account',
        groupId: null,
        accountId: parseInt(str.replace('account-', ''), 10),
      };
    }
    // Check for group drop zone: "group-drop-{id}"
    if (str.startsWith('group-drop-')) {
      return {
        type: 'group-drop',
        groupId: parseInt(str.replace('group-drop-', ''), 10),
        accountId: null,
      };
    }
    // Check for group: "group-{id}"
    if (str.startsWith('group-')) {
      return {
        type: 'group',
        groupId: parseInt(str.replace('group-', ''), 10),
        accountId: null,
      };
    }
    return { type: 'unknown', groupId: null, accountId: null };
  }, []);

  // Determine if we should insert after the target based on cursor position
  const shouldInsertAfter = useCallback((event) => {
    const activeRect = event.active?.rect?.current?.translated;
    const overRect = event.over?.rect;

    if (!activeRect || !overRect) return false;

    // Compare center of dragged element to midpoint of target
    const activeCenterY = activeRect.top + activeRect.height / 2;
    const overMidpointY = overRect.top + overRect.height / 2;

    return activeCenterY > overMidpointY;
  }, []);

  // Custom collision detection that prioritizes group drop zones
  // but allows sorting within groups (same or different)
  const collisionDetection = useCallback((args) => {
    const { active } = args;
    const activeParsed = parseDragId(active.id);

    // When dragging a GROUP, use only closestCenter for sortable reordering
    // Skip group drop zones entirely to prevent self-drop interference
    if (activeParsed.type === 'group') {
      return closestCenter(args);
    }

    // Check if we're dragging an account that's in a group
    const isFromGroup = activeParsed.type === 'grouped-account';

    // First check for droppable zones (groups and ungrouped)
    const pointerCollisions = pointerWithin(args);

    // Check for ungrouped drop zone (only valid if dragging from a group)
    const ungroupedDropCollision = pointerCollisions.find(
      (collision) => String(collision.id) === 'ungrouped-drop'
    );
    if (ungroupedDropCollision && isFromGroup) {
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
  }, [parseDragId]);

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

    // Save original state for potential restoration on cancel
    setOriginalListData(listData);

    // Find the active item to render in the overlay
    const parsed = parseDragId(active.id);

    if (parsed.type === 'grouped-account') {
      // Dragging from within a group - we know the exact group
      const groupItem = listData.items.find(
        (item) => item.type === 'group' && item.group.id === parsed.groupId
      );
      if (groupItem) {
        const account = groupItem.group.accounts?.find((a) => a.id === parsed.accountId);
        if (account) {
          setActiveItem({ type: 'account', data: account });
          setDragSourceGroupId(parsed.groupId);
        }
      }
    } else if (parsed.type === 'ungrouped-account') {
      // Dragging an ungrouped account
      const ungroupedItem = listData.items.find(
        (item) => item.type === 'account' && item.account.id === parsed.accountId
      );
      if (ungroupedItem) {
        setActiveItem({ type: 'account', data: ungroupedItem.account });
        setDragSourceGroupId(null);
      }
    } else if (parsed.type === 'group') {
      // Dragging a group
      const groupItem = listData.items.find(
        (item) => item.type === 'group' && item.group.id === parsed.groupId
      );
      if (groupItem) {
        setActiveItem({ type: 'group', data: groupItem.group });
      }
    }
  };

  const handleDragCancel = () => {
    setActiveId(null);
    setActiveItem(null);
    setDraggedWithinGroup(null);
    setDragSourceGroupId(null);
    setCrossGroupDragTarget(null);
    setGroupReordered(false);
    // Restore original state instead of refetching
    if (originalListData) {
      setListData(originalListData);
    }
    setOriginalListData(null);
  };

  const handleDragOver = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeParsed = parseDragId(active.id);
    const overParsed = parseDragId(over.id);

    // Handle GROUP reordering with real-time preview
    if (activeParsed.type === 'group') {
      // Only reorder when hovering over another group or ungrouped account in main list
      if (overParsed.type === 'group' || overParsed.type === 'ungrouped-account') {
        const activeIdStr = String(active.id);
        const overIdStr = String(over.id);

        const activeIndex = listData.items.findIndex((item) => {
          const itemId = item.type === 'group' ? `group-${item.group.id}` : `account-${item.account.id}`;
          return itemId === activeIdStr;
        });

        const overIndex = listData.items.findIndex((item) => {
          const itemId = item.type === 'group' ? `group-${item.group.id}` : `account-${item.account.id}`;
          return itemId === overIdStr;
        });

        if (activeIndex !== -1 && overIndex !== -1 && activeIndex !== overIndex) {
          setGroupReordered(true);
          setListData((prev) => ({
            ...prev,
            items: arrayMove([...prev.items], activeIndex, overIndex),
          }));
        }
      }
      return;
    }

    // Handle account drags
    if (activeParsed.type !== 'grouped-account' && activeParsed.type !== 'ungrouped-account') {
      return;
    }

    const activeAccountId = activeParsed.accountId;

    // Handle dragging over another account (either in same group or different group)
    if (overParsed.type === 'grouped-account') {
      const overAccountId = overParsed.accountId;
      const overGroupId = overParsed.groupId;

      // Find the over group
      const overGroupItem = listData.items.find(
        (item) => item.type === 'group' && item.group.id === overGroupId
      );
      if (!overGroupItem) return;

      const overGroup = overGroupItem.group;

      // Both accounts are in the same group - update UI in real-time for reordering
      if (dragSourceGroupId !== null && dragSourceGroupId === overGroupId) {
        const accounts = overGroup.accounts;
        const activeIndex = accounts.findIndex((a) => a.id === activeAccountId);
        const overIndex = accounts.findIndex((a) => a.id === overAccountId);

        if (activeIndex !== -1 && overIndex !== -1 && activeIndex !== overIndex) {
          // Track that we're reordering within this group
          setDraggedWithinGroup(overGroupId);
          setCrossGroupDragTarget(null);
          setListData((prev) => ({
            ...prev,
            items: prev.items.map((item) => {
              if (item.type === 'group' && item.group.id === overGroupId) {
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
      } else if (dragSourceGroupId !== overGroupId) {
        // Cross-group drag: dragging over an account in a different group
        const originalOverGroup = originalListData?.items.find(
          (item) => item.type === 'group' && item.group.id === overGroupId
        )?.group;
        const isAlreadyInTargetGroup = originalOverGroup?.accounts?.some((a) => a.id === activeAccountId);
        if (isAlreadyInTargetGroup) {
          setCrossGroupDragTarget(null);
          return;
        }

        // Check if account is already in target group (from previous dragOver)
        const currentAccountIndex = overGroup.accounts.findIndex((a) => a.id === activeAccountId);
        const overAccountIndex = overGroup.accounts.findIndex((a) => a.id === overAccountId);

        if (currentAccountIndex !== -1) {
          // Account already in target group - reposition with arrayMove
          if (currentAccountIndex !== overAccountIndex && overAccountIndex !== -1) {
            // Adjust target based on cursor position
            const insertAfter = shouldInsertAfter(event);
            let targetIndex = overAccountIndex;

            // When moving up but wanting to be after target, add 1
            if (insertAfter && currentAccountIndex > overAccountIndex) {
              targetIndex = overAccountIndex + 1;
            }

            // Skip if target equals current (no actual move)
            if (targetIndex === currentAccountIndex) {
              return;
            }

            setListData((prev) => {
              const newItems = prev.items.map((item) => {
                if (item.type === 'group' && item.group.id === overGroupId) {
                  const newAccounts = arrayMove([...item.group.accounts], currentAccountIndex, targetIndex);
                  return {
                    ...item,
                    group: { ...item.group, accounts: newAccounts },
                  };
                }
                return item;
              });
              // Calculate position from actual index after move
              const updatedGroup = newItems.find((item) => item.type === 'group' && item.group.id === overGroupId);
              const actualIndex = updatedGroup?.group?.accounts?.findIndex((a) => a.id === activeAccountId) ?? 0;
              setCrossGroupDragTarget({ groupId: overGroupId, position: actualIndex + 1 });
              return { ...prev, items: newItems };
            });
          }
          return;
        }

        // First time moving to target group - insert the account
        const draggedAccount = activeItem?.data;
        if (!draggedAccount) return;

        setListData((prev) => {
          const newItems = prev.items.map((item) => {
            if (item.type === 'group') {
              // Remove from source group
              if (dragSourceGroupId !== null && item.group.id === dragSourceGroupId) {
                return {
                  ...item,
                  group: {
                    ...item.group,
                    accounts: (item.group.accounts || []).filter((a) => a.id !== activeAccountId),
                  },
                };
              }
              // Insert into target group at hover position
              if (item.group.id === overGroupId) {
                const newAccounts = [...(item.group.accounts || [])];
                const insertIndex = newAccounts.findIndex((a) => a.id === overAccountId);
                // Determine if inserting before or after based on cursor position
                const insertAfter = shouldInsertAfter(event);
                const actualInsertIndex = insertAfter ? insertIndex + 1 : insertIndex;
                newAccounts.splice(actualInsertIndex, 0, draggedAccount);
                return {
                  ...item,
                  group: { ...item.group, accounts: newAccounts },
                };
              }
            }
            return item;
          });
          // Calculate position from actual index after insert
          const updatedGroup = newItems.find((item) => item.type === 'group' && item.group.id === overGroupId);
          const actualIndex = updatedGroup?.group?.accounts?.findIndex((a) => a.id === activeAccountId) ?? 0;
          setCrossGroupDragTarget({ groupId: overGroupId, position: actualIndex + 1 });
          return { ...prev, items: newItems };
        });
        setDraggedWithinGroup(null);
      }
    } else if (overParsed.type === 'group-drop') {
      // Dragging over empty group area (not over a specific account)
      const targetGroupId = overParsed.groupId;

      const originalTargetGroup = originalListData?.items.find(
        (item) => item.type === 'group' && item.group.id === targetGroupId
      )?.group;
      const isAlreadyInTargetGroup = originalTargetGroup?.accounts?.some((a) => a.id === activeAccountId);

      if (isAlreadyInTargetGroup) {
        setCrossGroupDragTarget(null);
        return;
      }

      if (dragSourceGroupId !== targetGroupId) {
        // Check if account is already in target group (from previous dragOver)
        const currentTargetGroup = listData.items.find(
          (item) => item.type === 'group' && item.group.id === targetGroupId
        )?.group;
        const alreadyInCurrentTarget = currentTargetGroup?.accounts?.some((a) => a.id === activeAccountId);

        if (alreadyInCurrentTarget) {
          // Already in target, just update position to end
          const accountCount = currentTargetGroup.accounts.length;
          setCrossGroupDragTarget({ groupId: targetGroupId, position: accountCount });
          return;
        }

        // First time - insert at end of target group
        const draggedAccount = activeItem?.data;
        if (!draggedAccount) return;

        setListData((prev) => {
          const newItems = prev.items.map((item) => {
            if (item.type === 'group') {
              // Remove from source group
              if (dragSourceGroupId !== null && item.group.id === dragSourceGroupId) {
                return {
                  ...item,
                  group: {
                    ...item.group,
                    accounts: (item.group.accounts || []).filter((a) => a.id !== activeAccountId),
                  },
                };
              }
              // Append to target group
              if (item.group.id === targetGroupId) {
                const newAccounts = [...(item.group.accounts || []), draggedAccount];
                return {
                  ...item,
                  group: { ...item.group, accounts: newAccounts },
                };
              }
            }
            return item;
          });
          // Position at end
          const updatedGroup = newItems.find((item) => item.type === 'group' && item.group.id === targetGroupId);
          const accountCount = updatedGroup?.group?.accounts?.length ?? 1;
          setCrossGroupDragTarget({ groupId: targetGroupId, position: accountCount });
          return { ...prev, items: newItems };
        });
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
    const wasGroupReordered = groupReordered;
    const savedOriginalListData = originalListData; // Save before clearing for use in checks
    setDraggedWithinGroup(null); // Reset the tracking state
    setDragSourceGroupId(null);
    setCrossGroupDragTarget(null);
    setOriginalListData(null); // Clear original state - we're committing the change
    setGroupReordered(false); // Reset group reorder tracking

    // If we reordered within a group during drag, persist the new order
    if (groupIdForReorder !== null) {
      const currentGroupItem = listData.items.find(
        (item) => item.type === 'group' && item.group.id === groupIdForReorder
      );
      if (currentGroupItem && currentGroupItem.group.accounts) {
        const positions = currentGroupItem.group.accounts
          .map((account, index) => ({
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

    // If we reordered groups/main list items during drag, persist the new order
    if (wasGroupReordered) {
      const positions = listData.items.map((item, index) => ({
        id: item.type === 'group' ? item.group.id : item.account.id,
        position: index + 1,
        is_group: item.type === 'group',
      }));

      try {
        await groupsApi.updatePositions(positions);
      } catch (err) {
        setError('Failed to save group order');
        fetchData();
      }
      return;
    }

    // If we have a cross-group drag target, use it
    if (crossGroupTarget !== null) {
      const activeParsed = parseDragId(active.id);
      if (activeParsed.type === 'grouped-account' || activeParsed.type === 'ungrouped-account') {
        const accountId = activeParsed.accountId;

        // Skip if dropping into the same group (shouldn't happen but safety check)
        if (sourceGroupId === crossGroupTarget.groupId) {
          fetchData();
          return;
        }

        // Check if account was already in target group before drag (using original data)
        const checkData = savedOriginalListData || listData;
        const targetGroupItem = checkData.items.find(
          (item) => item.type === 'group' && item.group.id === crossGroupTarget.groupId
        );
        const isAlreadyInTargetGroup = targetGroupItem?.group?.accounts?.some((a) => a.id === accountId);
        if (isAlreadyInTargetGroup) {
          // Account already exists in target group, just refresh and return
          fetchData();
          return;
        }

        try {
          // Use move action: removes from source group, adds to destination
          await accountsApi.modifyGroupMembership(
            accountId,
            'move',
            crossGroupTarget.groupId,
            sourceGroupId,  // Source group (null if ungrouped)
            crossGroupTarget.position
          );
          await fetchData();
        } catch (err) {
          setError('Failed to move account to group');
          fetchData();
        }
      }
      return;
    }

    if (!over || active.id === over.id) return;

    const activeParsed = parseDragId(active.id);
    const overParsed = parseDragId(over.id);

    // Check if dropping an account onto the ungrouped drop zone
    if ((activeParsed.type === 'grouped-account' || activeParsed.type === 'ungrouped-account') &&
        String(over.id) === 'ungrouped-drop') {
      const accountId = activeParsed.accountId;

      try {
        // Remove from source group only (keeps other group memberships)
        if (sourceGroupId !== null) {
          await accountsApi.modifyGroupMembership(accountId, 'remove', sourceGroupId);
        }
        await fetchData();
      } catch (err) {
        setError('Failed to remove account from group');
      }
      return;
    }

    // Check if dropping an account onto a group drop target (works for both ungrouped→group and group→group)
    if ((activeParsed.type === 'grouped-account' || activeParsed.type === 'ungrouped-account') &&
        overParsed.type === 'group-drop') {
      const accountId = activeParsed.accountId;
      const targetGroupId = overParsed.groupId;

      // Skip if dropping into the same group
      if (sourceGroupId === targetGroupId) {
        return;
      }

      // Check if account is already in target group (multi-group case)
      const targetGroupItem = listData.items.find(
        (item) => item.type === 'group' && item.group.id === targetGroupId
      );
      const isAlreadyInTargetGroup = targetGroupItem?.group?.accounts?.some((a) => a.id === accountId);
      if (isAlreadyInTargetGroup) {
        // Account already exists in target group, ignore
        return;
      }

      try {
        // Use move action: removes from source group, adds to destination
        await accountsApi.modifyGroupMembership(
          accountId,
          'move',
          targetGroupId,
          sourceGroupId,  // Source group (null if ungrouped)
          null  // Default to end of group
        );
        await fetchData();
      } catch (err) {
        setError('Failed to move account to group');
      }
      return;
    }

    // Handle dropping on an account in a different group
    if ((activeParsed.type === 'grouped-account' || activeParsed.type === 'ungrouped-account') &&
        overParsed.type === 'grouped-account') {
      const accountId = activeParsed.accountId;
      const overAccountId = overParsed.accountId;
      const overGroupId = overParsed.groupId;

      // Find the over group
      const overGroupItem = listData.items.find(
        (item) => item.type === 'group' && item.group.id === overGroupId
      );
      if (overGroupItem && overGroupId !== sourceGroupId) {
        const overGroup = overGroupItem.group;
        // Check if account is already in target group (multi-group case)
        const isAlreadyInTargetGroup = overGroup.accounts.some((a) => a.id === accountId);
        if (isAlreadyInTargetGroup) {
          // Account already exists in target group, ignore
          return;
        }

        const overIndex = overGroup.accounts.findIndex((a) => a.id === overAccountId);
        const targetPosition = overIndex + 1;

        try {
          // Use move action: removes from source group, adds to destination
          await accountsApi.modifyGroupMembership(
            accountId,
            'move',
            overGroup.id,
            sourceGroupId,
            targetPosition
          );
          await fetchData();
        } catch (err) {
          setError('Failed to move account to group');
        }
        return;
      }
    }

    // Check if we're reordering main list items (ungrouped accounts or groups themselves)
    const activeIdStr = String(active.id);
    const overIdStr = String(over.id);

    const activeIndex = listData.items.findIndex((item) => {
      const itemId = item.type === 'group' ? `group-${item.group.id}` : `account-${item.account.id}`;
      return itemId === activeIdStr;
    });

    const overIndex = listData.items.findIndex((item) => {
      const itemId = item.type === 'group' ? `group-${item.group.id}` : `account-${item.account.id}`;
      return itemId === overIdStr;
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
    const newAccount = await accountsApi.create(name, info, balance, calculatedData);
    // If a group was selected, add the account to the group
    if (groupId) {
      await accountsApi.modifyGroupMembership(newAccount.id, 'add', groupId);
    }
    await fetchData();
    setShowAddAccountForm(false);
  };

  const handleCreateGroup = async (name, description, color, isCalculated, formula, accountIds = []) => {
    const newGroup = await groupsApi.create(name, description, color, isCalculated, formula);

    // Add selected accounts to the new group
    for (let i = 0; i < accountIds.length; i++) {
      await accountsApi.modifyGroupMembership(accountIds[i], 'add', newGroup.id, null, i + 1);
    }

    await fetchData();
    setShowAddGroupForm(false);
  };

  const handleUpdateAccount = async (id, name, info) => {
    await accountsApi.updateName(id, name);
    await accountsApi.updateInfo(id, info);
    await fetchData();
    setEditingAccount(null);
  };

  const handleUpdateGroup = async (name, description, color, isCalculated, formula, accountIds = []) => {
    await groupsApi.update(editingGroup.id, name, description, color, isCalculated, formula);

    const currentAccountIds = (editingGroup.accounts || []).map(a => a.id);
    const accountsToAdd = accountIds.filter(id => !currentAccountIds.includes(id));
    const accountsToRemove = currentAccountIds.filter(id => !accountIds.includes(id));

    // Remove accounts from this group (keeps other group memberships)
    for (const accountId of accountsToRemove) {
      await accountsApi.modifyGroupMembership(accountId, 'remove', editingGroup.id);
    }
    // Add accounts to this group
    for (let i = 0; i < accountsToAdd.length; i++) {
      await accountsApi.modifyGroupMembership(accountsToAdd[i], 'add', editingGroup.id);
    }

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

  // Get all accounts for calculated account formulas (deduplicated)
  const allAccounts = listData.items.reduce((acc, item) => {
    if (item.type === 'account') {
      if (!acc.some(a => a.id === item.account.id)) {
        acc.push(item.account);
      }
    } else if (item.type === 'group' && item.group.accounts) {
      for (const account of item.group.accounts) {
        if (!acc.some(a => a.id === account.id)) {
          acc.push(account);
        }
      }
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
        <div className="total-section">
          <div className="total-header">
            <p className="total-balance">Total: {formatCurrency(listData.total_balance)}</p>
            <button
              className="btn-icon-small settings-button"
              onClick={() => setShowSettingsModal(true)}
              aria-label="Total formula settings"
            >
              <Settings size={18} />
            </button>
          </div>
        </div>
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
          allAccounts={allAccounts}
        />
      )}

      {showAddAccountForm && (
        <AccountForm
          onSubmit={handleCreateAccount}
          onCancel={() => setShowAddAccountForm(false)}
          accounts={allAccounts}
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
                      crossGroupDragAccountId={crossGroupDragTarget?.groupId === item.group.id ? activeItem?.data?.id : null}
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
            {activeItem?.type === 'group' && (
              <div className="drag-overlay drag-overlay-group">
                <GroupCardPreview group={activeItem.data} />
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
              allAccounts={allAccounts}
              onSubmit={handleUpdateGroup}
              onCancel={() => setEditingGroup(null)}
            />
          </div>
        </div>
      )}

      {viewingHistory && (
        <BalanceHistoryModal
          entityType="account"
          entityId={viewingHistory.id}
          entityName={viewingHistory.account_name}
          onClose={() => setViewingHistory(null)}
        />
      )}

      {showSettingsModal && (
        <SettingsModal
          accounts={allAccounts}
          groups={groups.map(g => {
            const groupItem = listData.items.find(i => i.type === 'group' && i.group.id === g.id);
            return { ...g, total_balance: groupItem?.group?.total_balance || 0 };
          })}
          totalFormulaConfig={listData.total_formula_config}
          onSave={() => fetchData()}
          onClose={() => setShowSettingsModal(false)}
        />
      )}
    </div>
  );
}
