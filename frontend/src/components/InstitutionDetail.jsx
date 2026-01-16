import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Pencil, Archive, Check, Calculator } from 'lucide-react';
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
import { institutionsApi, accountsApi } from '../services/api';
import AccountCard from './AccountCard';
import BalanceHistoryModal from './BalanceHistoryModal';
import FormulaDisplay from './FormulaDisplay';
import BalanceHistoryChart from './BalanceHistoryChart';
import BalanceHistoryTable from './BalanceHistoryTable';
import InlineEditableText from './InlineEditableText';
import InlineColorPicker from './InlineColorPicker';

function SortableAccountItem({ account, onUpdateBalance, onViewHistory, onRemoveFromInstitution }) {
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
        onRemoveFromGroup={onRemoveFromInstitution}
      />
    </div>
  );
}

export default function InstitutionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [institution, setInstitution] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);
  const [viewingHistory, setViewingHistory] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyViewMode, setHistoryViewMode] = useState('table');
  const [isCalculated, setIsCalculated] = useState(false);
  const [formulaItems, setFormulaItems] = useState([]);
  const [allAccounts, setAllAccounts] = useState([]);

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

  const fetchHistory = async () => {
    try {
      const data = await institutionsApi.getHistory(id);
      setHistory(data || []);
    } catch (err) {
      // History might not exist yet, that's okay
      setHistory([]);
    }
  };

  const fetchInstitution = async () => {
    try {
      setError('');
      const data = await institutionsApi.getById(id);
      setInstitution(data);
      await fetchHistory();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllAccounts = async () => {
    try {
      const data = await accountsApi.getAll();
      setAllAccounts(data || []);
    } catch (err) {
      // Accounts might not exist, that's okay
    }
  };

  useEffect(() => {
    fetchInstitution();
    fetchAllAccounts();
  }, [id]);

  // Initialize formula state when institution loads
  useEffect(() => {
    if (institution) {
      setIsCalculated(institution.is_calculated || false);
      if (institution.formula && Array.isArray(institution.formula)) {
        setFormulaItems(institution.formula.map(item => ({
          accountId: item.account_id,
          accountName: (institution.accounts || []).find(a => a.id === item.account_id)?.account_name || 'Unknown',
          coefficient: item.coefficient
        })));
      } else {
        setFormulaItems([]);
      }
    }
  }, [institution]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  // Save handlers for inline editing
  const handleSaveName = async (name) => {
    if (!name.trim()) throw new Error('Institution name is required');
    await institutionsApi.update(id, name.trim(), institution.description, institution.color, institution.is_calculated, institution.formula);
    await fetchInstitution();
  };

  const handleSaveDescription = async (description) => {
    await institutionsApi.update(id, institution.name, description || '', institution.color, institution.is_calculated, institution.formula);
    await fetchInstitution();
  };

  const handleSaveColor = async (color) => {
    await institutionsApi.update(id, institution.name, institution.description, color, institution.is_calculated, institution.formula);
    await fetchInstitution();
  };

  const handleToggleCalculated = async (newIsCalculated) => {
    setIsCalculated(newIsCalculated);

    // If turning off calculated mode, save immediately
    if (!newIsCalculated) {
      await institutionsApi.update(id, institution.name, institution.description, institution.color, false, null);
      await fetchInstitution();
    }
  };

  const handleFormulaChange = (newFormulaItems) => {
    setFormulaItems(newFormulaItems);
  };

  const handleFormulaSave = async (itemsOverride) => {
    if (!isCalculated) return;

    // Use provided items (for remove operations) or current state
    const items = itemsOverride || formulaItems;

    const formulaData = items.map(item => ({
      account_id: item.accountId,
      coefficient: item.coefficient
    }));

    await institutionsApi.update(id, institution.name, institution.description, institution.color, isCalculated, formulaData.length > 0 ? formulaData : null);
    await fetchInstitution();
  };

  const handleArchive = async () => {
    if (window.confirm(`Are you sure you want to archive "${institution.name}"? The accounts in this institution will become unassigned.`)) {
      await institutionsApi.archive(institution.id);
      navigate('/institutions');
    }
  };

  const handleUpdateBalance = async (accountId, balance) => {
    await accountsApi.updateBalance(accountId, balance);
    await fetchInstitution();
    await fetchHistory();
  };

  const handleRemoveFromInstitution = async (account) => {
    if (window.confirm(`Remove "${account.account_name}" from this institution? It will remain in any groups.`)) {
      await accountsApi.modifyGroupMembership(account.id, 'remove', parseInt(id));
      await fetchInstitution();
    }
  };

  const handleAddAccount = async (accountId) => {
    try {
      await accountsApi.setInstitution(accountId, parseInt(id));
      await fetchInstitution();
      await fetchAllAccounts();
    } catch (err) {
      setError(err.message);
    }
  };

  // Get accounts that are not already in this institution
  const getAvailableAccounts = () => {
    if (!allAccounts || allAccounts.length === 0) return [];
    const institutionAccountIds = (institution?.accounts || []).map(a => a.id);
    return allAccounts.filter(a => !institutionAccountIds.includes(a.id));
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

    // Reorder accounts within the institution
    const accounts = institution.accounts || [];
    const oldIndex = accounts.findIndex((a) => `account-${a.id}` === active.id);
    const newIndex = accounts.findIndex((a) => `account-${a.id}` === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      const reorderedAccounts = arrayMove(accounts, oldIndex, newIndex);

      // Optimistically update the UI
      setInstitution((prev) => ({
        ...prev,
        accounts: reorderedAccounts,
      }));

      // Send the new positions to the backend
      const positions = reorderedAccounts.map((account, index) => ({
        id: account.id,
        position_in_group: index,
      }));

      try {
        await institutionsApi.updateAccountPositionsInInstitution(id, positions);
      } catch (err) {
        console.error('Failed to update account positions:', err);
        // Revert on error
        await fetchInstitution();
      }
    }
  }, [institution, id, fetchInstitution]);

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
  }, []);

  const getActiveAccount = () => {
    if (!activeId || !institution?.accounts) return null;
    const accountId = activeId.replace('account-', '');
    return institution.accounts.find((a) => a.id.toString() === accountId);
  };

  if (loading) {
    return <div className="loading">Loading institution...</div>;
  }

  if (error) {
    return (
      <div className="app">
        <div className="error">{error}</div>
        <button onClick={() => navigate('/institutions')} className="btn-secondary">
          <ArrowLeft size={16} /> Back
        </button>
      </div>
    );
  }

  if (!institution) {
    return (
      <div className="app">
        <div className="error">Institution not found</div>
        <button onClick={() => navigate('/institutions')} className="btn-secondary">
          <ArrowLeft size={16} /> Back
        </button>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="detail-header">
        <button onClick={() => navigate('/institutions')} className="btn-back">
          <ArrowLeft size={18} />
          <span>Back</span>
        </button>
        <div className="detail-actions">
          <button
            onClick={() => setIsEditMode(!isEditMode)}
            className={`btn-icon ${isEditMode ? 'btn-icon-active' : ''}`}
            title={isEditMode ? "Done editing" : "Edit"}
          >
            {isEditMode ? <Check size={18} /> : <Pencil size={18} />}
          </button>
          <button onClick={handleArchive} className="btn-icon btn-icon-danger" title="Archive">
            <Archive size={18} />
          </button>
        </div>
      </div>

      <div className="detail-content">
        <div className="detail-main">
          <div className="group-detail-header">
            {isEditMode ? (
              <InlineColorPicker value={institution.color} onChange={handleSaveColor} />
            ) : (
              <div
                className="group-color-dot"
                style={{ backgroundColor: institution.color }}
              />
            )}
            {isEditMode ? (
              <InlineEditableText
                value={institution.name}
                onSave={handleSaveName}
                type="input"
                className="detail-title-input"
                required
                autoFocus
              />
            ) : (
              <h1 className="detail-title">{institution.name}</h1>
            )}
          </div>

          {isEditMode && (institution.accounts || []).length > 0 ? (
            <div className="detail-formula-section-inline">
              <div className="toggle-row">
                <div className="toggle-label-content">
                  <Calculator size={18} className="toggle-icon" />
                  <span className="toggle-text">Calculated Balance</span>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={isCalculated}
                    onChange={(e) => handleToggleCalculated(e.target.checked)}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
              {isCalculated ? (
                <FormulaDisplay
                  formulaItems={formulaItems}
                  accounts={institution.accounts || []}
                  editable={true}
                  onChange={handleFormulaChange}
                  onBlur={handleFormulaSave}
                />
              ) : (
                <div className="detail-balance-section">
                  <span className="detail-balance-label">Total Balance</span>
                  <p className="detail-balance">{formatCurrency(institution.total_balance)}</p>
                </div>
              )}
            </div>
          ) : institution.is_calculated && institution.formula && institution.formula.length > 0 ? (
            <FormulaDisplay
              formulaItems={institution.formula}
              accounts={institution.accounts || []}
              totalBalance={institution.total_balance}
            />
          ) : (
            <div className="detail-balance-section">
              <span className="detail-balance-label">Total Balance</span>
              <p className="detail-balance">{formatCurrency(institution.total_balance)}</p>
            </div>
          )}

          {(institution.description || isEditMode) && (
            <div className="detail-info-section">
              <span className="detail-info-label">Description</span>
              {isEditMode ? (
                <InlineEditableText
                  value={institution.description || ''}
                  onSave={handleSaveDescription}
                  type="textarea"
                  className="detail-info-textarea"
                  placeholder="Add description..."
                  rows={4}
                />
              ) : (
                <p className="detail-info-text">{institution.description}</p>
              )}
            </div>
          )}
        </div>

        <div className="detail-accounts">
          <div className="section-header-with-action">
            <h2 className="detail-section-title">
              Accounts ({institution.accounts?.length || 0})
            </h2>
            {getAvailableAccounts().length > 0 && (
              <select
                className="group-add-dropdown"
                value=""
                onChange={(e) => {
                  if (e.target.value) {
                    handleAddAccount(parseInt(e.target.value));
                  }
                }}
              >
                <option value="">Add account...</option>
                {getAvailableAccounts().map(account => (
                  <option key={account.id} value={account.id}>
                    {account.account_name}
                  </option>
                ))}
              </select>
            )}
          </div>
          {!institution.accounts || institution.accounts.length === 0 ? (
            <p className="empty-state-small">No accounts in this institution yet.</p>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragCancel={handleDragCancel}
            >
              <SortableContext
                items={institution.accounts.map((a) => `account-${a.id}`)}
                strategy={verticalListSortingStrategy}
              >
                <div className="group-accounts-list">
                  {institution.accounts.map((account) => (
                    <SortableAccountItem
                      key={account.id}
                      account={account}
                      onUpdateBalance={handleUpdateBalance}
                      onViewHistory={setViewingHistory}
                      onRemoveFromInstitution={handleRemoveFromInstitution}
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

        <div className="detail-history">
          <div className="history-header">
            <h2 className="detail-section-title">Balance History</h2>
            {history.length > 0 && (
              <div className="view-toggle">
                <button
                  className={`view-toggle-btn ${historyViewMode === 'table' ? 'active' : ''}`}
                  onClick={() => setHistoryViewMode('table')}
                >
                  Table
                </button>
                <button
                  className={`view-toggle-btn ${historyViewMode === 'chart' ? 'active' : ''}`}
                  onClick={() => setHistoryViewMode('chart')}
                >
                  Chart
                </button>
              </div>
            )}
          </div>
          {history.length === 0 ? (
            <p className="empty-state-small">No history records yet.</p>
          ) : historyViewMode === 'table' ? (
            <div className="history-table-container">
              <BalanceHistoryTable history={history} showAccountName={false} />
            </div>
          ) : (
            <BalanceHistoryChart history={history} />
          )}
        </div>
      </div>

      {viewingHistory && (
        <BalanceHistoryModal
          entityType="account"
          entityId={viewingHistory.id}
          entityName={viewingHistory.account_name}
          onClose={() => setViewingHistory(null)}
        />
      )}
    </div>
  );
}
