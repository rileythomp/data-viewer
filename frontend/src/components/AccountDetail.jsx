import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Pencil, Archive, ExternalLink } from 'lucide-react';
import { accountsApi, groupsApi } from '../services/api';
import EditAccountModal from './EditAccountModal';
import BalanceHistoryTable from './BalanceHistoryTable';
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

  const handleUpdateAccount = async (accountId, name, info) => {
    await accountsApi.updateName(accountId, name);
    await accountsApi.updateInfo(accountId, info || '');
    await fetchAccount();
  };

  const handleArchive = async () => {
    if (window.confirm(`Are you sure you want to archive "${account.account_name}"?`)) {
      await accountsApi.archive(account.id);
      navigate('/');
    }
  };

  const handleGroupChange = async (e) => {
    const newGroupId = e.target.value === '' ? null : parseInt(e.target.value, 10);
    try {
      await accountsApi.setGroup(account.id, newGroupId);
      await fetchAccount();
    } catch (err) {
      setError(err.message);
    }
  };

  const getCurrentGroup = () => {
    if (!account?.group_id) return null;
    return groups.find(g => g.id === account.group_id);
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

          <div className="detail-balance-section">
            <span className="detail-balance-label">Current Balance</span>
            {account.is_calculated ? (
              <p className="detail-balance" title="Calculated balance">
                {formatCurrency(account.current_balance)}
              </p>
            ) : isEditingBalance ? (
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

          {account.is_calculated && account.formula && account.formula.length > 0 && (
            <FormulaDisplay
              formulaItems={account.formula}
              accounts={allAccounts}
              totalBalance={account.current_balance}
            />
          )}

          <div className="detail-group-section">
            <span className="detail-group-label">Group</span>
            <div className="detail-group-controls">
              {getCurrentGroup() && (
                <span
                  className="group-color-dot"
                  style={{ backgroundColor: getCurrentGroup().color }}
                />
              )}
              <select
                value={account.group_id || ''}
                onChange={handleGroupChange}
                className="group-select"
              >
                <option value="">None</option>
                {groups.map(group => (
                  <option key={group.id} value={group.id}>
                    {group.group_name}
                  </option>
                ))}
              </select>
              {getCurrentGroup() && (
                <button
                  onClick={() => navigate(`/groups/${account.group_id}`)}
                  className="btn-icon btn-icon-small"
                  title="View group"
                >
                  <ExternalLink size={14} />
                </button>
              )}
            </div>
          </div>

          {account.account_info && (
            <div className="detail-info-section">
              <span className="detail-info-label">Notes</span>
              <p className="detail-info-text">{account.account_info}</p>
            </div>
          )}
        </div>

        <div className="detail-history">
          <h2 className="detail-section-title">Balance History</h2>
          {history.length === 0 ? (
            <p className="empty-state-small">No history records yet.</p>
          ) : (
            <div className="history-table-container">
              <BalanceHistoryTable history={history} showAccountName={false} />
            </div>
          )}
        </div>
      </div>

      {editingAccount && (
        <EditAccountModal
          account={editingAccount}
          onSubmit={handleUpdateAccount}
          onClose={() => setEditingAccount(null)}
        />
      )}
    </div>
  );
}
