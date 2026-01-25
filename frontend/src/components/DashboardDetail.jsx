import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Pencil, Trash2, Check, ChevronDown, ChevronUp, Calculator } from 'lucide-react';
import { dashboardsApi, accountsApi, groupsApi, institutionsApi } from '../services/api';
import AccountCard from './AccountCard';
import BalanceHistoryModal from './BalanceHistoryModal';
import InlineEditableText from './InlineEditableText';
import MultiSelectDropdown from './MultiSelectDropdown';
import DashboardFormulaDisplay from './DashboardFormulaDisplay';

export default function DashboardDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);
  const [viewingHistory, setViewingHistory] = useState(null);
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const [allAccounts, setAllAccounts] = useState([]);
  const [allGroups, setAllGroups] = useState([]);
  const [allInstitutions, setAllInstitutions] = useState([]);
  const [selectedAccounts, setSelectedAccounts] = useState([]);
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [selectedInstitutions, setSelectedInstitutions] = useState([]);
  const [isCalculated, setIsCalculated] = useState(false);
  const [formulaItems, setFormulaItems] = useState([]);

  const fetchDashboard = async () => {
    try {
      setError('');
      const data = await dashboardsApi.getById(id);
      setDashboard(data);

      // Extract current account, group, and institution IDs from items
      const accountIds = data.items
        ?.filter(item => item.type === 'account')
        .map(item => item.account.id) || [];
      const groupIds = data.items
        ?.filter(item => item.type === 'group')
        .map(item => item.group.id) || [];
      const institutionIds = data.items
        ?.filter(item => item.type === 'institution')
        .map(item => item.institution.id) || [];
      setSelectedAccounts(accountIds);
      setSelectedGroups(groupIds);
      setSelectedInstitutions(institutionIds);

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
      const [accountsData, groupsData, institutionsData] = await Promise.all([
        accountsApi.getAll(),
        groupsApi.getAll(),
        institutionsApi.getAll(),
      ]);
      setAllAccounts(accountsData || []);
      setAllGroups(groupsData || []);
      setAllInstitutions(institutionsData || []);
    } catch (err) {
      // Silently fail - selection will just be empty
    }
  };

  useEffect(() => {
    fetchDashboard();
    fetchSelectionData();
  }, [id]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const handleSaveName = async (name) => {
    if (!name.trim()) throw new Error('Dashboard name is required');
    await dashboardsApi.update(id, name.trim(), dashboard.description, selectedAccounts, selectedGroups, selectedInstitutions, isCalculated, isCalculated ? formulaItems : null);
    await fetchDashboard();
  };

  const handleSaveDescription = async (description) => {
    await dashboardsApi.update(id, dashboard.name, description || '', selectedAccounts, selectedGroups, selectedInstitutions, isCalculated, isCalculated ? formulaItems : null);
    await fetchDashboard();
  };

  const handleAccountsChange = async (newSelection) => {
    setSelectedAccounts(newSelection);
    await dashboardsApi.update(id, dashboard.name, dashboard.description, newSelection, selectedGroups, selectedInstitutions, isCalculated, isCalculated ? formulaItems : null);
    await fetchDashboard();
  };

  const handleGroupsChange = async (newSelection) => {
    setSelectedGroups(newSelection);
    await dashboardsApi.update(id, dashboard.name, dashboard.description, selectedAccounts, newSelection, selectedInstitutions, isCalculated, isCalculated ? formulaItems : null);
    await fetchDashboard();
  };

  const handleInstitutionsChange = async (newSelection) => {
    setSelectedInstitutions(newSelection);
    await dashboardsApi.update(id, dashboard.name, dashboard.description, selectedAccounts, selectedGroups, newSelection, isCalculated, isCalculated ? formulaItems : null);
    await fetchDashboard();
  };

  const handleToggleCalculated = async (newIsCalculated) => {
    setIsCalculated(newIsCalculated);
    if (!newIsCalculated) {
      // If turning off, save immediately with formula cleared
      await dashboardsApi.update(id, dashboard.name, dashboard.description, selectedAccounts, selectedGroups, selectedInstitutions, false, null);
      await fetchDashboard();
    }
  };

  const handleFormulaChange = async (newFormulaItems) => {
    setFormulaItems(newFormulaItems);
    // Save immediately when formula changes
    await dashboardsApi.update(id, dashboard.name, dashboard.description, selectedAccounts, selectedGroups, selectedInstitutions, isCalculated, newFormulaItems);
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
        <div className="list-container">
          {dashboard.items.map((item) => {
            if (item.type === 'account') {
              return (
                <AccountCard
                  key={`account-${item.account.id}`}
                  account={item.account}
                  onUpdateBalance={handleUpdateBalance}
                  onViewHistory={setViewingHistory}
                />
              );
            } else if (item.type === 'group') {
              return (
                <div key={`group-${item.group.id}`} className="group-card">
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
              );
            } else if (item.type === 'institution') {
              const expandKey = `inst-${item.institution.id}`;
              return (
                <div key={`institution-${item.institution.id}`} className="group-card">
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
              );
            }
            return null;
          })}
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
    </div>
  );
}
