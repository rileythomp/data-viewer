import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Pencil, Archive, ExternalLink, X } from 'lucide-react';
import { accountsApi, groupsApi } from '../services/api';
import EditAccountModal from './EditAccountModal';
import BalanceHistoryTable from './BalanceHistoryTable';
import BalanceHistoryChart from './BalanceHistoryChart';
import FormulaDisplay from './FormulaDisplay';

export default function AccountDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [account, setAccount] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingAccount, setEditingAccount] = useState(null);
  const [isEditingBalance, setIsEditingBalance] = useState(false);
  const [balanceValue, setBalanceValue] = useState('');
  const [groups, setGroups] = useState([]);
  const [allAccounts, setAllAccounts] = useState([]);
  const [viewMode, setViewMode] = useState('table');
  const inputRef = useRef(null);

  const fetchAccount = async () => {
    try {
      setError('');
      const data = await accountsApi.getById(id);
      setAccount(data);
      setBalanceValue(data.current_balance.toString());
    } catch (err) {
      setError(err.message);
    }
  };

  const fetchHistory = async () => {
    try {
      const data = await accountsApi.getHistory(id);
      setHistory(data);
    } catch (err) {
      // History might not exist yet, that's okay
    }
  };

  const fetchGroups = async () => {
    try {
      const data = await groupsApi.getAll();
      setGroups(data || []);
    } catch (err) {
      // Groups might not exist, that's okay
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
    const fetchData = async () => {
      setLoading(true);
      await Promise.all([fetchAccount(), fetchHistory(), fetchGroups(), fetchAllAccounts()]);
      setLoading(false);
    };
    fetchData();
  }, [id]);

  useEffect(() => {
    if (isEditingBalance && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditingBalance]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const handleUpdateAccount = async (accountId, name, info, isCalculated, formula) => {
    await accountsApi.updateName(accountId, name);
    await accountsApi.updateInfo(accountId, info || '');

    // Update formula if provided (isCalculated is not undefined)
    if (isCalculated !== undefined) {
      await accountsApi.updateFormula(accountId, isCalculated, formula);
    }

    await fetchAccount();
  };

  const handleArchive = async () => {
    if (window.confirm(`Are you sure you want to archive "${account.account_name}"?`)) {
      await accountsApi.archive(account.id);
      navigate('/');
    }
  };

  const handleAddToGroup = async (groupId) => {
    try {
      await accountsApi.modifyGroupMembership(account.id, 'add', groupId);
      await fetchAccount();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRemoveFromGroup = async (groupId) => {
    try {
      await accountsApi.modifyGroupMembership(account.id, 'remove', groupId);
      await fetchAccount();
    } catch (err) {
      setError(err.message);
    }
  };

  const getAvailableGroups = () => {
    if (!groups || groups.length === 0) return [];
    const currentGroupIds = account?.group_ids || [];
    return groups.filter(g => !currentGroupIds.includes(g.id));
  };

  const getAccountGroups = () => {
    if (!account?.group_ids || account.group_ids.length === 0) return [];
    return groups.filter(g => account.group_ids.includes(g.id));
  };

  const handleBalanceClick = () => {
    setBalanceValue(account.current_balance.toString());
    setIsEditingBalance(true);
  };

  const handleBalanceSubmit = async () => {
    const balanceNum = parseFloat(balanceValue);
    if (!isNaN(balanceNum) && balanceNum !== account.current_balance) {
      try {
        await accountsApi.updateBalance(account.id, balanceNum);
        await fetchAccount();
        await fetchHistory();
      } catch (err) {
        setBalanceValue(account.current_balance.toString());
      }
    }
    setIsEditingBalance(false);
  };

  const handleBalanceKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleBalanceSubmit();
    } else if (e.key === 'Escape') {
      setBalanceValue(account.current_balance.toString());
      setIsEditingBalance(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading account...</div>;
  }

  if (error) {
    return (
      <div className="app">
        <div className="error">{error}</div>
        <button onClick={() => navigate('/')} className="btn-secondary">
          <ArrowLeft size={16} /> Back to Accounts
        </button>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="app">
        <div className="error">Account not found</div>
        <button onClick={() => navigate('/')} className="btn-secondary">
          <ArrowLeft size={16} /> Back to Accounts
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
          <button onClick={() => setEditingAccount(account)} className="btn-icon" title="Edit">
            <Pencil size={18} />
          </button>
          <button onClick={handleArchive} className="btn-icon btn-icon-danger" title="Archive">
            <Archive size={18} />
          </button>
        </div>
      </div>

      <div className="detail-content">
        <div className="detail-main">
          <h1 className="detail-title">{account.account_name}</h1>

          {account.is_calculated && account.formula && account.formula.length > 0 ? (
            <FormulaDisplay
              formulaItems={account.formula}
              accounts={allAccounts}
              totalBalance={account.current_balance}
            />
          ) : (
            <div className="detail-balance-section">
              <span className="detail-balance-label">Current Balance</span>
              {isEditingBalance ? (
                <input
                  ref={inputRef}
                  type="number"
                  step="0.01"
                  value={balanceValue}
                  onChange={(e) => setBalanceValue(e.target.value)}
                  onKeyDown={handleBalanceKeyDown}
                  onBlur={handleBalanceSubmit}
                  className="balance-input balance-input-large"
                />
              ) : (
                <p
                  className="detail-balance account-balance-clickable"
                  onClick={handleBalanceClick}
                  title="Click to edit balance"
                >
                  {formatCurrency(account.current_balance)}
                </p>
              )}
            </div>
          )}

          <div className="detail-group-section">
            <span className="detail-group-label">Groups</span>
            <div className="group-tags-container">
              {getAccountGroups().map(group => (
                <div key={group.id} className="group-tag">
                  <span
                    className="group-color-dot"
                    style={{ backgroundColor: group.color }}
                  />
                  <span
                    className="group-tag-name"
                    onClick={() => navigate(`/groups/${group.id}`)}
                    title="View group"
                  >
                    {group.group_name}
                  </span>
                  <button
                    onClick={() => handleRemoveFromGroup(group.id)}
                    className="group-tag-remove"
                    title="Remove from group"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
            {getAvailableGroups().length > 0 && (
              <select
                className="group-add-dropdown"
                value=""
                onChange={(e) => {
                  if (e.target.value) {
                    handleAddToGroup(parseInt(e.target.value));
                  }
                }}
              >
                <option value="">Add to group...</option>
                {getAvailableGroups().map(group => (
                  <option key={group.id} value={group.id}>
                    {group.group_name}
                  </option>
                ))}
              </select>
            )}
            {groups.length === 0 && (
              <p className="empty-state-small">No groups available</p>
            )}
          </div>

          {account.account_info && (
            <div className="detail-info-section">
              <span className="detail-info-label">Notes</span>
              <p className="detail-info-text">{account.account_info}</p>
            </div>
          )}
        </div>

        <div className="detail-history">
          <div className="history-header">
            <h2 className="detail-section-title">Balance History</h2>
            {history.length > 0 && (
              <div className="view-toggle">
                <button
                  className={`view-toggle-btn ${viewMode === 'table' ? 'active' : ''}`}
                  onClick={() => setViewMode('table')}
                >
                  Table
                </button>
                <button
                  className={`view-toggle-btn ${viewMode === 'chart' ? 'active' : ''}`}
                  onClick={() => setViewMode('chart')}
                >
                  Chart
                </button>
              </div>
            )}
          </div>
          {history.length === 0 ? (
            <p className="empty-state-small">No history records yet.</p>
          ) : viewMode === 'table' ? (
            <div className="history-table-container">
              <BalanceHistoryTable history={history} showAccountName={false} />
            </div>
          ) : (
            <BalanceHistoryChart history={history} />
          )}
        </div>
      </div>

      {editingAccount && (
        <EditAccountModal
          account={editingAccount}
          accounts={allAccounts}
          onSubmit={handleUpdateAccount}
          onClose={() => setEditingAccount(null)}
        />
      )}
    </div>
  );
}
