import { useState, useEffect } from 'react';
import {
  DndContext,
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
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { accountsApi } from '../services/api';
import AccountCard from './AccountCard';
import AccountForm from './AccountForm';
import EditAccountModal from './EditAccountModal';
import HistoryTable from './HistoryTable';

function SortableAccountCard({ account, ...props }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: account.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 'auto',
    height: '100%',
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <AccountCard account={account} {...props} />
    </div>
  );
}

export default function AccountList() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [viewingHistory, setViewingHistory] = useState(null);

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

  const fetchAccounts = async () => {
    try {
      setError('');
      const data = await accountsApi.getAll();
      setAccounts(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const handleDragEnd = (event) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setAccounts((prevAccounts) => {
        const oldIndex = prevAccounts.findIndex((a) => a.id === active.id);
        const newIndex = prevAccounts.findIndex((a) => a.id === over.id);
        const newAccounts = arrayMove(prevAccounts, oldIndex, newIndex);

        // Calculate new positions and save to backend
        const positions = newAccounts.map((account, index) => ({
          id: account.id,
          position: index + 1,
        }));

        accountsApi.updatePositions(positions).catch((err) => {
          setError('Failed to save order');
          fetchAccounts();
        });

        return newAccounts;
      });
    }
  };

  const handleCreateAccount = async (name, info, balance, calculatedData) => {
    await accountsApi.create(name, info, balance, calculatedData);
    await fetchAccounts();
    setShowAddForm(false);
  };

  const handleUpdateAccount = async (id, name, info) => {
    await accountsApi.updateName(id, name);
    await accountsApi.updateInfo(id, info);
    await fetchAccounts();
  };

  const handleUpdateBalance = async (id, balance) => {
    await accountsApi.updateBalance(id, balance);
    await fetchAccounts();
  };

  const handleArchive = async (account) => {
    if (window.confirm(`Are you sure you want to archive "${account.account_name}"?`)) {
      await accountsApi.archive(account.id);
      await fetchAccounts();
    }
  };

  const totalBalance = accounts.reduce((sum, acc) => sum + acc.current_balance, 0);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  if (loading) {
    return <div className="loading">Loading accounts...</div>;
  }

  return (
    <div className="app">
      <div className="header">
        <p className="total-balance">Total: {formatCurrency(totalBalance)}</p>
        <button onClick={() => setShowAddForm(!showAddForm)} className="btn-primary">
          {showAddForm ? 'Cancel' : '+ Add Account'}
        </button>
      </div>

      {error && <div className="error">{error}</div>}

      {showAddForm && (
        <AccountForm
          onSubmit={handleCreateAccount}
          onCancel={() => setShowAddForm(false)}
          accounts={accounts.filter(a => !a.is_calculated)}
        />
      )}

      {accounts.length === 0 ? (
        <p className="empty-state">No accounts yet. Add your first account to get started!</p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={accounts.map((a) => a.id)}
            strategy={rectSortingStrategy}
          >
            <div className="accounts-grid">
              {accounts.map((account) => (
                <SortableAccountCard
                  key={account.id}
                  account={account}
                  onEdit={setEditingAccount}
                  onUpdateBalance={handleUpdateBalance}
                  onViewHistory={setViewingHistory}
                  onArchive={handleArchive}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
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
