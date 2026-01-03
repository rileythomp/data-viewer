import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Pencil, Archive } from 'lucide-react';
import { accountsApi } from '../services/api';
import EditAccountModal from './EditAccountModal';

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

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      await Promise.all([fetchAccount(), fetchHistory()]);
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

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
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
              <table className="history-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((record) => (
                    <tr key={record.id}>
                      <td>{formatDate(record.recorded_at)}</td>
                      <td>{formatCurrency(record.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
