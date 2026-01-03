import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
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
import SortControls from './SortControls';
import AccountForm from './AccountForm';
import GroupForm from './GroupForm';
import EditAccountModal from './EditAccountModal';
import BalanceHistoryModal from './BalanceHistoryModal';
import SettingsModal from './SettingsModal';

function SortableGroup({ group, children }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `group-${group.id}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1,
    zIndex: isDragging ? 1000 : 'auto',
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      {React.cloneElement(children, { dragHandleProps: listeners })}
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
  const [activeGroup, setActiveGroup] = useState(null);
  const [sortOrder, setSortOrder] = useState(() => {
    return localStorage.getItem('groupSortOrder') || 'custom';
  });

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

  // Handle sort order change
  const handleSortChange = useCallback((newSortOrder) => {
    setSortOrder(newSortOrder);
    localStorage.setItem('groupSortOrder', newSortOrder);
  }, []);

  // Compute sorted items based on sort selection
  const sortedItems = useMemo(() => {
    if (sortOrder === 'custom') {
      return listData.items;
    }

    const itemsCopy = [...listData.items];

    const getGroupName = (item) => item.group?.group_name?.toLowerCase() || '';
    const getAccountName = (item) => item.account?.account_name?.toLowerCase() || '';
    const getGroupValue = (item) => item.group?.total_balance || 0;
    const getAccountValue = (item) => item.account?.current_balance || 0;

    const getName = (item) => item.type === 'group' ? getGroupName(item) : getAccountName(item);
    const getValue = (item) => item.type === 'group' ? getGroupValue(item) : getAccountValue(item);

    switch (sortOrder) {
      case 'name-asc':
        return itemsCopy.sort((a, b) => getName(a).localeCompare(getName(b)));
      case 'name-desc':
        return itemsCopy.sort((a, b) => getName(b).localeCompare(getName(a)));
      case 'value-asc':
        return itemsCopy.sort((a, b) => getValue(a) - getValue(b));
      case 'value-desc':
        return itemsCopy.sort((a, b) => getValue(b) - getValue(a));
      default:
        return itemsCopy;
    }
  }, [listData.items, sortOrder]);

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
    const idStr = String(active.id);

    // Only handle group dragging
    if (idStr.startsWith('group-')) {
      const groupId = parseInt(idStr.replace('group-', ''), 10);
      const groupItem = listData.items.find(
        (item) => item.type === 'group' && item.group.id === groupId
      );
      if (groupItem) {
        setActiveGroup(groupItem.group);
      }
    }
  };

  const handleDragCancel = () => {
    setActiveGroup(null);
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    setActiveGroup(null);

    if (!over || active.id === over.id) return;

    const activeIdStr = String(active.id);
    const overIdStr = String(over.id);

    // Only handle group reordering
    if (!activeIdStr.startsWith('group-') || !overIdStr.startsWith('group-')) {
      return;
    }

    const activeIndex = listData.items.findIndex((item) =>
      item.type === 'group' && `group-${item.group.id}` === activeIdStr
    );

    const overIndex = listData.items.findIndex((item) =>
      item.type === 'group' && `group-${item.group.id}` === overIdStr
    );

    if (activeIndex !== -1 && overIndex !== -1 && activeIndex !== overIndex) {
      // Reorder groups in the list
      const newItems = arrayMove([...listData.items], activeIndex, overIndex);
      setListData({ ...listData, items: newItems });

      // Build positions array for groups only
      const positions = newItems
        .filter((item) => item.type === 'group')
        .map((item, index) => ({
          id: item.group.id,
          position: index + 1,
          is_group: true,
        }));

      try {
        await groupsApi.updatePositions(positions);
      } catch (err) {
        setError('Failed to save group order');
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

  // Only groups are sortable now
  const sortableGroupIds = sortedItems
    .filter((item) => item.type === 'group')
    .map((item) => `group-${item.group.id}`);

  const isSortable = sortOrder === 'custom';

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
          <SortControls sortOrder={sortOrder} onSortChange={handleSortChange} />
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
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <SortableContext items={sortableGroupIds} strategy={verticalListSortingStrategy}>
            <div className="list-container">
              {sortedItems.map((item) =>
                item.type === 'group' ? (
                  <SortableGroup key={`group-${item.group.id}`} group={item.group}>
                    <GroupCard
                      group={item.group}
                      isExpanded={expandedGroups.has(item.group.id)}
                      onToggleExpand={handleToggleExpand}
                      onEdit={setEditingGroup}
                      onUpdateBalance={handleUpdateBalance}
                      onViewHistory={setViewingHistory}
                      sortable={isSortable}
                    />
                  </SortableGroup>
                ) : (
                  <AccountCard
                    key={`account-${item.account.id}`}
                    account={item.account}
                    onEdit={setEditingAccount}
                    onUpdateBalance={handleUpdateBalance}
                    onViewHistory={setViewingHistory}
                  />
                )
              )}
            </div>
          </SortableContext>
          <DragOverlay dropAnimation={{ duration: 200, easing: 'ease' }}>
            {activeGroup && (
              <div className="drag-overlay drag-overlay-group">
                <GroupCardPreview group={activeGroup} />
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
