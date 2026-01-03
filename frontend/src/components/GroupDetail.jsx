import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Pencil, Archive } from 'lucide-react';
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
import { groupsApi, accountsApi } from '../services/api';
import AccountCard from './AccountCard';
import EditAccountModal from './EditAccountModal';
import HistoryTable from './HistoryTable';
import GroupForm from './GroupForm';
import FormulaDisplay from './FormulaDisplay';

function SortableAccountItem({ account, onUpdateBalance, onViewHistory, onRemoveFromGroup }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `account-${account.id}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: 'grab',
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <AccountCard
        account={account}
        onUpdateBalance={onUpdateBalance}
        onViewHistory={onViewHistory}
        onRemoveFromGroup={onRemoveFromGroup}
      />
    </div>
  );
}

export default function GroupDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [group, setGroup] = useState(null);
  const [allAccounts, setAllAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [viewingHistory, setViewingHistory] = useState(null);
  const [activeId, setActiveId] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const fetchGroup = async () => {
    try {
      setError('');
      const [data, accounts] = await Promise.all([
        groupsApi.getById(id),
        accountsApi.getAll()
      ]);
      setGroup(data);
      setAllAccounts(accounts);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroup();
  }, [id]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const handleUpdateGroup = async (name, description, color, isCalculated, formula, accountIds = []) => {
    await groupsApi.update(id, name, description, color, isCalculated, formula);

    const currentAccountIds = (group.accounts || []).map(a => a.id);
    const accountsToAdd = accountIds.filter(accId => !currentAccountIds.includes(accId));
    const accountsToRemove = currentAccountIds.filter(accId => !accountIds.includes(accId));

    for (const accountId of accountsToRemove) {
      await accountsApi.setGroup(accountId, null);
    }
    for (let i = 0; i < accountsToAdd.length; i++) {
      await accountsApi.setGroup(accountsToAdd[i], parseInt(id));
    }

    await fetchGroup();
    setIsEditing(false);
  };

  const handleArchive = async () => {
    if (window.confirm(`Are you sure you want to archive "${group.group_name}"? The accounts in this group will become ungrouped.`)) {
      await groupsApi.archive(group.id);
      navigate('/');
    }
  };

  const handleUpdateAccount = async (accountId, name, info) => {
    await accountsApi.updateName(accountId, name);
    await accountsApi.updateInfo(accountId, info || '');
    await fetchGroup();
    setEditingAccount(null);
  };

  const handleUpdateBalance = async (accountId, balance) => {
    await accountsApi.updateBalance(accountId, balance);
    await fetchGroup();
  };

  const handleRemoveFromGroup = async (account) => {
    if (window.confirm(`Remove "${account.account_name}" from this group?`)) {
      await accountsApi.setGroup(account.id, null);
      await fetchGroup();
    }
  };

  const handleDragStart = useCallback((event) => {
    setActiveId(event.active.id);
  }, []);

  const handleDragEnd = useCallback(async (event) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) {
      return;
    }

    // Reorder accounts within the group
    const accounts = group.accounts || [];
    const oldIndex = accounts.findIndex((a) => `account-${a.id}` === active.id);
    const newIndex = accounts.findIndex((a) => `account-${a.id}` === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      const reorderedAccounts = arrayMove(accounts, oldIndex, newIndex);

      // Optimistically update the UI
      setGroup((prev) => ({
        ...prev,
        accounts: reorderedAccounts,
      }));

      // Send the new positions to the backend
      const positions = reorderedAccounts.map((account, index) => ({
        id: account.id,
        position_in_group: index,
      }));

      try {
        await groupsApi.updateAccountPositionsInGroup(id, positions);
      } catch (err) {
        console.error('Failed to update account positions:', err);
        // Revert on error
        await fetchGroup();
      }
    }
  }, [group, id, fetchGroup]);

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
  }, []);

  const getActiveAccount = () => {
    if (!activeId || !group?.accounts) return null;
    const accountId = activeId.replace('account-', '');
    return group.accounts.find((a) => a.id.toString() === accountId);
  };

  if (loading) {
    return <div className="loading">Loading group...</div>;
  }

  if (error) {
    return (
      <div className="app">
        <div className="error">{error}</div>
        <button onClick={() => navigate('/')} className="btn-secondary">
          <ArrowLeft size={16} /> Back
        </button>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="app">
        <div className="error">Group not found</div>
        <button onClick={() => navigate('/')} className="btn-secondary">
          <ArrowLeft size={16} /> Back
        </button>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="detail-header">
        <button onClick={() => navigate('/')} className="btn-back">
          <ArrowLeft size={18} />
          <span>Back</span>
        </button>
        <div className="detail-actions">
          <button onClick={() => setIsEditing(true)} className="btn-icon" title="Edit">
            <Pencil size={18} />
          </button>
          <button onClick={handleArchive} className="btn-icon btn-icon-danger" title="Archive">
            <Archive size={18} />
          </button>
        </div>
      </div>

      <div className="detail-content">
        <div className="detail-main">
          <div className="group-detail-header">
            <div
              className="group-color-dot"
              style={{ backgroundColor: group.color }}
            />
            <h1 className="detail-title">{group.group_name}</h1>
          </div>

          {group.is_calculated && group.formula && group.formula.length > 0 ? (
            <FormulaDisplay
              formulaItems={group.formula}
              accounts={group.accounts || []}
              totalBalance={group.total_balance}
            />
          ) : (
            <div className="detail-balance-section">
              <span className="detail-balance-label">Total Balance</span>
              <p className="detail-balance">{formatCurrency(group.total_balance)}</p>
            </div>
          )}

          {group.group_description && (
            <div className="detail-info-section">
              <span className="detail-info-label">Description</span>
              <p className="detail-info-text">{group.group_description}</p>
            </div>
          )}
        </div>

        <div className="detail-accounts">
          <h2 className="detail-section-title">
            Accounts ({group.accounts?.length || 0})
          </h2>
          {!group.accounts || group.accounts.length === 0 ? (
            <p className="empty-state-small">No accounts in this group yet.</p>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragCancel={handleDragCancel}
            >
              <SortableContext
                items={group.accounts.map((a) => `account-${a.id}`)}
                strategy={verticalListSortingStrategy}
              >
                <div className="group-accounts-list">
                  {group.accounts.map((account) => (
                    <SortableAccountItem
                      key={account.id}
                      account={account}
                      onUpdateBalance={handleUpdateBalance}
                      onViewHistory={setViewingHistory}
                      onRemoveFromGroup={handleRemoveFromGroup}
                    />
                  ))}
                </div>
              </SortableContext>
              <DragOverlay>
                {activeId ? (
                  <div className="account-card account-card-compact account-card-dragging">
                    <div className="account-header-compact">
                      <h3 className="account-name">{getActiveAccount()?.account_name}</h3>
                      <div className="account-right">
                        <p className="account-balance account-balance-compact">
                          {formatCurrency(getActiveAccount()?.current_balance || 0)}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          )}
        </div>
      </div>

      {isEditing && (
        <div className="modal-overlay" onClick={() => setIsEditing(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <GroupForm
              initialData={group}
              accounts={group.accounts || []}
              allAccounts={allAccounts}
              onSubmit={handleUpdateGroup}
              onCancel={() => setIsEditing(false)}
            />
          </div>
        </div>
      )}

      {editingAccount && (
        <EditAccountModal
          account={editingAccount}
          onSubmit={handleUpdateAccount}
          onClose={() => setEditingAccount(null)}
        />
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
