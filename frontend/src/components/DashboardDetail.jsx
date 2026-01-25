import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Pencil, Trash2, Check, ChevronDown, ChevronUp, Calculator, BarChart2 } from 'lucide-react';
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
import { dashboardsApi, accountsApi, groupsApi, institutionsApi, chartsApi } from '../services/api';
import AccountCard from './AccountCard';
import BalanceHistoryModal from './BalanceHistoryModal';
import BalanceHistoryTable from './BalanceHistoryTable';
import BalanceHistoryChart from './BalanceHistoryChart';
import InlineEditableText from './InlineEditableText';
import MultiSelectDropdown from './MultiSelectDropdown';
import DashboardFormulaDisplay from './DashboardFormulaDisplay';
import DashboardChartCard from './DashboardChartCard';

function SortableDashboardItem({ item, children }) {
  const itemId = item.type === 'account'
    ? `account-${item.account.id}`
    : item.type === 'group'
      ? `group-${item.group.id}`
      : item.type === 'institution'
        ? `institution-${item.institution.id}`
        : `chart-${item.chart.id}`;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: itemId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: 'grab',
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  );
}

export default function DashboardDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);
  const [viewingHistory, setViewingHistory] = useState(null);
  const [dashboardHistory, setDashboardHistory] = useState([]);
  const [dashboardHistoryViewMode, setDashboardHistoryViewMode] = useState('table');
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const [allAccounts, setAllAccounts] = useState([]);
  const [allGroups, setAllGroups] = useState([]);
  const [allInstitutions, setAllInstitutions] = useState([]);
  const [allCharts, setAllCharts] = useState([]);
  const [selectedAccounts, setSelectedAccounts] = useState([]);
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [selectedInstitutions, setSelectedInstitutions] = useState([]);
  const [selectedCharts, setSelectedCharts] = useState([]);
  const [isCalculated, setIsCalculated] = useState(false);
  const [formulaItems, setFormulaItems] = useState([]);
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

  const fetchDashboard = async () => {
    try {
      setError('');
      const data = await dashboardsApi.getById(id);
      setDashboard(data);

      // Extract current account, group, institution, and chart IDs from items
      const accountIds = data.items
        ?.filter(item => item.type === 'account')
        .map(item => item.account.id) || [];
      const groupIds = data.items
        ?.filter(item => item.type === 'group')
        .map(item => item.group.id) || [];
      const institutionIds = data.items
        ?.filter(item => item.type === 'institution')
        .map(item => item.institution.id) || [];
      const chartIds = data.items
        ?.filter(item => item.type === 'chart')
        .map(item => item.chart.id) || [];
      setSelectedAccounts(accountIds);
      setSelectedGroups(groupIds);
      setSelectedInstitutions(institutionIds);
      setSelectedCharts(chartIds);

      // Initialize formula state
      setIsCalculated(data.is_calculated || false);
      setFormulaItems(data.formula || []);

      // Expand all groups and institutions by default
      setExpandedGroups(new Set([...groupIds, ...institutionIds.map(id => `inst-${id}`)]));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchSelectionData = async () => {
    try {
      const [accountsData, groupsData, institutionsData, chartsData] = await Promise.all([
        accountsApi.getAll(),
        groupsApi.getAll(),
        institutionsApi.getAll(),
        chartsApi.getAll(1, 100),
      ]);
      setAllAccounts(accountsData || []);
      setAllGroups(groupsData || []);
      setAllInstitutions(institutionsData || []);
      setAllCharts(chartsData?.charts || []);
    } catch (err) {
      // Silently fail - selection will just be empty
    }
  };

  const fetchDashboardHistory = async () => {
    try {
      const data = await dashboardsApi.getHistory(id);
      setDashboardHistory(data || []);
    } catch (err) {
      // History might not exist yet, that's okay
    }
  };

  useEffect(() => {
    fetchDashboard();
    fetchSelectionData();
    fetchDashboardHistory();
  }, [id]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const handleSaveName = async (name) => {
    if (!name.trim()) throw new Error('Dashboard name is required');
    await dashboardsApi.update(id, name.trim(), dashboard.description, selectedAccounts, selectedGroups, selectedInstitutions, selectedCharts, isCalculated, isCalculated ? formulaItems : null);
    await fetchDashboard();
  };

  const handleSaveDescription = async (description) => {
    await dashboardsApi.update(id, dashboard.name, description || '', selectedAccounts, selectedGroups, selectedInstitutions, selectedCharts, isCalculated, isCalculated ? formulaItems : null);
    await fetchDashboard();
  };

  const handleAccountsChange = async (newSelection) => {
    setSelectedAccounts(newSelection);
    await dashboardsApi.update(id, dashboard.name, dashboard.description, newSelection, selectedGroups, selectedInstitutions, selectedCharts, isCalculated, isCalculated ? formulaItems : null);
    await fetchDashboard();
  };

  const handleGroupsChange = async (newSelection) => {
    setSelectedGroups(newSelection);
    await dashboardsApi.update(id, dashboard.name, dashboard.description, selectedAccounts, newSelection, selectedInstitutions, selectedCharts, isCalculated, isCalculated ? formulaItems : null);
    await fetchDashboard();
  };

  const handleInstitutionsChange = async (newSelection) => {
    setSelectedInstitutions(newSelection);
    await dashboardsApi.update(id, dashboard.name, dashboard.description, selectedAccounts, selectedGroups, newSelection, selectedCharts, isCalculated, isCalculated ? formulaItems : null);
    await fetchDashboard();
  };

  const handleChartsChange = async (newSelection) => {
    setSelectedCharts(newSelection);
    await dashboardsApi.update(id, dashboard.name, dashboard.description, selectedAccounts, selectedGroups, selectedInstitutions, newSelection, isCalculated, isCalculated ? formulaItems : null);
    await fetchDashboard();
  };

  const handleToggleCalculated = async (newIsCalculated) => {
    setIsCalculated(newIsCalculated);
    if (!newIsCalculated) {
      // If turning off, save immediately with formula cleared
      await dashboardsApi.update(id, dashboard.name, dashboard.description, selectedAccounts, selectedGroups, selectedInstitutions, selectedCharts, false, null);
      await fetchDashboard();
    }
  };

  const handleFormulaChange = async (newFormulaItems) => {
    setFormulaItems(newFormulaItems);
    // Save immediately when formula changes
    await dashboardsApi.update(id, dashboard.name, dashboard.description, selectedAccounts, selectedGroups, selectedInstitutions, selectedCharts, isCalculated, newFormulaItems);
    await fetchDashboard();
  };

  const handleDelete = async () => {
    if (window.confirm(`Are you sure you want to delete "${dashboard.name}"?`)) {
      await dashboardsApi.delete(id);
      navigate('/dashboards');
    }
  };

  const handleToggleExpand = (groupId) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const handleUpdateBalance = async (accountId, balance) => {
    await accountsApi.updateBalance(accountId, balance);
    await fetchDashboard();
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

    const items = dashboard.items || [];
    const oldIndex = items.findIndex((item) => {
      const itemId = item.type === 'account'
        ? `account-${item.account.id}`
        : item.type === 'group'
          ? `group-${item.group.id}`
          : item.type === 'institution'
            ? `institution-${item.institution.id}`
            : `chart-${item.chart.id}`;
      return itemId === active.id;
    });
    const newIndex = items.findIndex((item) => {
      const itemId = item.type === 'account'
        ? `account-${item.account.id}`
        : item.type === 'group'
          ? `group-${item.group.id}`
          : item.type === 'institution'
            ? `institution-${item.institution.id}`
            : `chart-${item.chart.id}`;
      return itemId === over.id;
    });

    if (oldIndex !== -1 && newIndex !== -1) {
      const reorderedItems = arrayMove(items, oldIndex, newIndex);

      // Optimistically update the UI
      setDashboard((prev) => ({
        ...prev,
        items: reorderedItems,
      }));

      // Send the new positions to the backend
      const positions = reorderedItems.map((item, index) => ({
        item_type: item.type,
        item_id: item.type === 'account'
          ? item.account.id
          : item.type === 'group'
            ? item.group.id
            : item.type === 'institution'
              ? item.institution.id
              : item.chart.id,
        position: index + 1,
      }));

      try {
        await dashboardsApi.updateItemPositions(id, positions);
      } catch (err) {
        console.error('Failed to update item positions:', err);
        // Revert on error
        await fetchDashboard();
      }
    }
  }, [dashboard, id, fetchDashboard]);

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
  }, []);

  const getActiveItem = () => {
    if (!activeId || !dashboard?.items) return null;
    return dashboard.items.find((item) => {
      const itemId = item.type === 'account'
        ? `account-${item.account.id}`
        : item.type === 'group'
          ? `group-${item.group.id}`
          : item.type === 'institution'
            ? `institution-${item.institution.id}`
            : `chart-${item.chart.id}`;
      return itemId === activeId;
    });
  };

  const formatCurrencyShort = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  if (loading) {
    return <div className="loading">Loading dashboard...</div>;
  }

  if (error) {
    return (
      <div className="app">
        <div className="error">{error}</div>
        <button onClick={() => navigate('/dashboards')} className="btn-secondary">
          <ArrowLeft size={16} /> Back
        </button>
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="app">
        <div className="error">Dashboard not found</div>
        <button onClick={() => navigate('/dashboards')} className="btn-secondary">
          <ArrowLeft size={16} /> Back
        </button>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="header">
        <div className="header-content">
          <div className="dashboard-header-row">
            <button onClick={() => navigate('/dashboards')} className="btn-back">
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
              <button onClick={handleDelete} className="btn-icon btn-icon-danger" title="Delete">
                <Trash2 size={18} />
              </button>
            </div>
          </div>
          {isEditMode ? (
            <InlineEditableText
              value={dashboard.name}
              onSave={handleSaveName}
              type="input"
              className="dashboard-title-input"
              required
              autoFocus
            />
          ) : (
            <h1>{dashboard.name}</h1>
          )}
          {!isEditMode && dashboard.is_calculated && dashboard.formula && dashboard.formula.length > 0 ? (
            <DashboardFormulaDisplay
              formulaItems={dashboard.formula}
              accounts={allAccounts}
              groups={allGroups}
              institutions={allInstitutions}
              totalBalance={dashboard.total_balance}
              editable={false}
            />
          ) : (
            <p className="total-balance">Total: {formatCurrency(dashboard.total_balance)}</p>
          )}
          {dashboard.description && !isEditMode && (
            <p className="dashboard-description">{dashboard.description}</p>
          )}
        </div>
      </div>

      {isEditMode && (
        <div className="dashboard-edit-panel">
          <div className="form-group">
            <label>Description</label>
            <InlineEditableText
              value={dashboard.description || ''}
              onSave={handleSaveDescription}
              type="textarea"
              className="detail-info-textarea"
              placeholder="Add description..."
              rows={3}
            />
          </div>

          <div className="form-group">
            <label>Accounts</label>
            <MultiSelectDropdown
              items={allAccounts}
              selectedIds={selectedAccounts}
              onChange={handleAccountsChange}
              placeholder="Select accounts..."
              labelKey="account_name"
            />
          </div>

          <div className="form-group">
            <label>Groups</label>
            <MultiSelectDropdown
              items={allGroups}
              selectedIds={selectedGroups}
              onChange={handleGroupsChange}
              placeholder="Select groups..."
              labelKey="group_name"
              renderOption={(group) => (
                <>
                  <div
                    className="group-color-dot"
                    style={{ backgroundColor: group.color }}
                  />
                  <span>{group.group_name}</span>
                </>
              )}
              renderChip={(group) => (
                <>
                  <div
                    className="group-color-dot"
                    style={{ backgroundColor: group.color }}
                  />
                  <span>{group.group_name}</span>
                </>
              )}
            />
          </div>

          <div className="form-group">
            <label>Institutions</label>
            <MultiSelectDropdown
              items={allInstitutions}
              selectedIds={selectedInstitutions}
              onChange={handleInstitutionsChange}
              placeholder="Select institutions..."
              labelKey="name"
              renderOption={(institution) => (
                <>
                  <div
                    className="group-color-dot"
                    style={{ backgroundColor: institution.color }}
                  />
                  <span>{institution.name}</span>
                </>
              )}
              renderChip={(institution) => (
                <>
                  <div
                    className="group-color-dot"
                    style={{ backgroundColor: institution.color }}
                  />
                  <span>{institution.name}</span>
                </>
              )}
            />
          </div>

          <div className="form-group">
            <label>Charts</label>
            <MultiSelectDropdown
              items={allCharts}
              selectedIds={selectedCharts}
              onChange={handleChartsChange}
              placeholder="Select charts..."
              labelKey="name"
              renderOption={(chart) => (
                <>
                  <BarChart2 size={14} className="chart-select-icon" />
                  <span>{chart.name}</span>
                </>
              )}
              renderChip={(chart) => (
                <>
                  <BarChart2 size={14} className="chart-select-icon" />
                  <span>{chart.name}</span>
                </>
              )}
            />
          </div>

          <div className="form-group">
            <div className="toggle-row">
              <div className="toggle-label-content">
                <Calculator size={18} className="toggle-icon" />
                <span className="toggle-text">Custom Balance Formula</span>
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
            <p className="form-hint">
              Use a custom formula instead of summing all item balances.
            </p>
          </div>

          {isCalculated && (
            <div className="form-group">
              <label>Formula</label>
              <DashboardFormulaDisplay
                formulaItems={formulaItems}
                accounts={allAccounts}
                groups={allGroups}
                institutions={allInstitutions}
                editable={true}
                onChange={handleFormulaChange}
              />
            </div>
          )}
        </div>
      )}

      {!dashboard.items || dashboard.items.length === 0 ? (
        <p className="empty-state">No items in this dashboard yet. Click edit to add accounts, groups, and institutions.</p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <SortableContext
            items={dashboard.items.map((item) =>
              item.type === 'account'
                ? `account-${item.account.id}`
                : item.type === 'group'
                  ? `group-${item.group.id}`
                  : item.type === 'institution'
                    ? `institution-${item.institution.id}`
                    : `chart-${item.chart.id}`
            )}
            strategy={verticalListSortingStrategy}
          >
            <div className="list-container">
              {dashboard.items.map((item) => {
                if (item.type === 'account') {
                  return (
                    <SortableDashboardItem key={`account-${item.account.id}`} item={item}>
                      <AccountCard
                        account={item.account}
                        onUpdateBalance={handleUpdateBalance}
                        onViewHistory={setViewingHistory}
                      />
                    </SortableDashboardItem>
                  );
                } else if (item.type === 'group') {
                  return (
                    <SortableDashboardItem key={`group-${item.group.id}`} item={item}>
                      <div className="group-card">
                        <div
                          className="group-color-indicator"
                          style={{ backgroundColor: item.group.color }}
                        />
                        <div
                          className="group-card-header"
                          onClick={() => handleToggleExpand(item.group.id)}
                        >
                          <div className="group-header-left">
                            <button
                              className="btn-icon btn-expand"
                              aria-label={expandedGroups.has(item.group.id) ? 'Collapse group' : 'Expand group'}
                            >
                              {expandedGroups.has(item.group.id) ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                            </button>
                            <h3
                              className="group-name"
                              onPointerDown={(e) => e.stopPropagation()}
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/groups/${item.group.id}`);
                              }}
                              title="View group details"
                            >
                              {item.group.group_name}
                            </h3>
                            <span className="group-account-count">
                              ({item.group.accounts?.length || 0} accounts)
                            </span>
                          </div>
                          <div className="group-header-right">
                            <span className="group-total">{formatCurrency(item.group.total_balance)}</span>
                          </div>
                        </div>
                        {expandedGroups.has(item.group.id) && (
                          <div className="group-content group-content-expanded">
                            {item.group.accounts && item.group.accounts.length > 0 ? (
                              <div className="group-accounts">
                                {item.group.accounts.map((account) => (
                                  <AccountCard
                                    key={account.id}
                                    account={account}
                                    onUpdateBalance={handleUpdateBalance}
                                    onViewHistory={setViewingHistory}
                                  />
                                ))}
                              </div>
                            ) : (
                              <p className="group-empty">No accounts in this group.</p>
                            )}
                          </div>
                        )}
                      </div>
                    </SortableDashboardItem>
                  );
                } else if (item.type === 'institution') {
                  const expandKey = `inst-${item.institution.id}`;
                  return (
                    <SortableDashboardItem key={`institution-${item.institution.id}`} item={item}>
                      <div className="group-card">
                        <div
                          className="group-color-indicator"
                          style={{ backgroundColor: item.institution.color }}
                        />
                        <div
                          className="group-card-header"
                          onClick={() => handleToggleExpand(expandKey)}
                        >
                          <div className="group-header-left">
                            <button
                              className="btn-icon btn-expand"
                              aria-label={expandedGroups.has(expandKey) ? 'Collapse institution' : 'Expand institution'}
                            >
                              {expandedGroups.has(expandKey) ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                            </button>
                            <h3
                              className="group-name"
                              onPointerDown={(e) => e.stopPropagation()}
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/institutions/${item.institution.id}`);
                              }}
                              title="View institution details"
                            >
                              {item.institution.name}
                            </h3>
                            <span className="group-account-count">
                              ({item.institution.accounts?.length || 0} accounts)
                            </span>
                          </div>
                          <div className="group-header-right">
                            <span className="group-total">{formatCurrency(item.institution.total_balance)}</span>
                          </div>
                        </div>
                        {expandedGroups.has(expandKey) && (
                          <div className="group-content group-content-expanded">
                            {item.institution.accounts && item.institution.accounts.length > 0 ? (
                              <div className="group-accounts">
                                {item.institution.accounts.map((account) => (
                                  <AccountCard
                                    key={account.id}
                                    account={account}
                                    onUpdateBalance={handleUpdateBalance}
                                    onViewHistory={setViewingHistory}
                                  />
                                ))}
                              </div>
                            ) : (
                              <p className="group-empty">No accounts in this institution.</p>
                            )}
                          </div>
                        )}
                      </div>
                    </SortableDashboardItem>
                  );
                } else if (item.type === 'chart') {
                  return (
                    <SortableDashboardItem key={`chart-${item.chart.id}`} item={item}>
                      <DashboardChartCard chart={item.chart} />
                    </SortableDashboardItem>
                  );
                }
                return null;
              })}
            </div>
          </SortableContext>
          <DragOverlay>
            {activeId ? (
              <div className="drag-overlay-item">
                {(() => {
                  const activeItem = getActiveItem();
                  if (!activeItem) return null;
                  if (activeItem.type === 'account') {
                    return (
                      <div className="account-card account-card-compact account-card-dragging">
                        <div className="account-header-compact">
                          <h3 className="account-name">{activeItem.account.account_name}</h3>
                          <div className="account-right">
                            <p className="account-balance account-balance-compact">
                              {formatCurrencyShort(activeItem.account.current_balance)}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  } else if (activeItem.type === 'group') {
                    return (
                      <div className="group-card group-card-dragging">
                        <div
                          className="group-color-indicator"
                          style={{ backgroundColor: activeItem.group.color }}
                        />
                        <div className="group-card-header">
                          <div className="group-header-left">
                            <h3 className="group-name">{activeItem.group.group_name}</h3>
                            <span className="group-account-count">
                              ({activeItem.group.accounts?.length || 0} accounts)
                            </span>
                          </div>
                          <div className="group-header-right">
                            <span className="group-total">{formatCurrencyShort(activeItem.group.total_balance)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  } else if (activeItem.type === 'institution') {
                    return (
                      <div className="group-card group-card-dragging">
                        <div
                          className="group-color-indicator"
                          style={{ backgroundColor: activeItem.institution.color }}
                        />
                        <div className="group-card-header">
                          <div className="group-header-left">
                            <h3 className="group-name">{activeItem.institution.name}</h3>
                            <span className="group-account-count">
                              ({activeItem.institution.accounts?.length || 0} accounts)
                            </span>
                          </div>
                          <div className="group-header-right">
                            <span className="group-total">{formatCurrencyShort(activeItem.institution.total_balance)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  } else if (activeItem.type === 'chart') {
                    return (
                      <div className="chart-card chart-card-dragging">
                        <div className="chart-card-header">
                          <BarChart2 size={18} className="chart-card-icon" />
                          <h3 className="chart-card-name">{activeItem.chart.name}</h3>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      <div className="detail-history" style={{ marginTop: 'var(--space-8)' }}>
        <div className="history-header">
          <h2 className="detail-section-title">Balance History</h2>
          {dashboardHistory.length > 0 && (
            <div className="view-toggle">
              <button
                className={`view-toggle-btn ${dashboardHistoryViewMode === 'table' ? 'active' : ''}`}
                onClick={() => setDashboardHistoryViewMode('table')}
              >
                Table
              </button>
              <button
                className={`view-toggle-btn ${dashboardHistoryViewMode === 'chart' ? 'active' : ''}`}
                onClick={() => setDashboardHistoryViewMode('chart')}
              >
                Chart
              </button>
            </div>
          )}
        </div>
        {dashboardHistory.length === 0 ? (
          <p className="empty-state-small">No history records yet.</p>
        ) : dashboardHistoryViewMode === 'table' ? (
          <div className="history-table-container">
            <BalanceHistoryTable history={dashboardHistory} showAccountName={false} />
          </div>
        ) : (
          <BalanceHistoryChart history={dashboardHistory} />
        )}
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
