import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Pencil, Trash2, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { dashboardsApi, accountsApi, groupsApi } from '../services/api';
import AccountCard from './AccountCard';
import BalanceHistoryModal from './BalanceHistoryModal';
import InlineEditableText from './InlineEditableText';

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
  const [selectedAccounts, setSelectedAccounts] = useState([]);
  const [selectedGroups, setSelectedGroups] = useState([]);

  const fetchDashboard = async () => {
    try {
      setError('');
      const data = await dashboardsApi.getById(id);
      setDashboard(data);

      // Extract current account and group IDs from items
      const accountIds = data.items
        ?.filter(item => item.type === 'account')
        .map(item => item.account.id) || [];
      const groupIds = data.items
        ?.filter(item => item.type === 'group')
        .map(item => item.group.id) || [];
      setSelectedAccounts(accountIds);
      setSelectedGroups(groupIds);

      // Expand all groups by default
      setExpandedGroups(new Set(groupIds));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchSelectionData = async () => {
    try {
      const [accountsData, groupsData] = await Promise.all([
        accountsApi.getAll(),
        groupsApi.getAll(),
      ]);
      setAllAccounts(accountsData || []);
      setAllGroups(groupsData || []);
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
    await dashboardsApi.update(id, name.trim(), dashboard.description, selectedAccounts, selectedGroups);
    await fetchDashboard();
  };

  const handleSaveDescription = async (description) => {
    await dashboardsApi.update(id, dashboard.name, description || '', selectedAccounts, selectedGroups);
    await fetchDashboard();
  };

  const handleAccountToggle = async (accountId) => {
    const newSelection = selectedAccounts.includes(accountId)
      ? selectedAccounts.filter(id => id !== accountId)
      : [...selectedAccounts, accountId];
    setSelectedAccounts(newSelection);
    await dashboardsApi.update(id, dashboard.name, dashboard.description, newSelection, selectedGroups);
    await fetchDashboard();
  };

  const handleGroupToggle = async (groupId) => {
    const newSelection = selectedGroups.includes(groupId)
      ? selectedGroups.filter(id => id !== groupId)
      : [...selectedGroups, groupId];
    setSelectedGroups(newSelection);
    await dashboardsApi.update(id, dashboard.name, dashboard.description, selectedAccounts, newSelection);
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
          <p className="total-balance">Total: {formatCurrency(dashboard.total_balance)}</p>
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
            <div className="item-selection">
              {allAccounts.map((account) => (
                <label key={account.id} className="item-checkbox">
                  <input
                    type="checkbox"
                    checked={selectedAccounts.includes(account.id)}
                    onChange={() => handleAccountToggle(account.id)}
                  />
                  <span className="item-checkbox-name">{account.account_name}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Groups</label>
            <div className="item-selection">
              {allGroups.map((group) => (
                <label key={group.id} className="item-checkbox">
                  <input
                    type="checkbox"
                    checked={selectedGroups.includes(group.id)}
                    onChange={() => handleGroupToggle(group.id)}
                  />
                  <div
                    className="group-color-dot"
                    style={{ backgroundColor: group.color }}
                  />
                  <span className="item-checkbox-name">{group.group_name}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {!dashboard.items || dashboard.items.length === 0 ? (
        <p className="empty-state">No items in this dashboard yet. Click edit to add accounts and groups.</p>
      ) : (
        <div className="list-container">
          {dashboard.items.map((item) => (
            item.type === 'account' ? (
              <AccountCard
                key={`account-${item.account.id}`}
                account={item.account}
                onUpdateBalance={handleUpdateBalance}
                onViewHistory={setViewingHistory}
              />
            ) : (
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
            )
          ))}
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
