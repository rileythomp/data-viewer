import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Pencil, Archive } from 'lucide-react';
import { groupsApi, accountsApi } from '../services/api';
import AccountCard from './AccountCard';
import EditAccountModal from './EditAccountModal';
import HistoryTable from './HistoryTable';
import GroupForm from './GroupForm';

export default function GroupDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [viewingHistory, setViewingHistory] = useState(null);

  const fetchGroup = async () => {
    try {
      setError('');
      const data = await groupsApi.getById(id);
      setGroup(data);
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

  const handleUpdateGroup = async (name, description, color) => {
    await groupsApi.update(id, name, description, color);
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

          <div className="detail-balance-section">
            <span className="detail-balance-label">Total Balance</span>
            <p className="detail-balance">{formatCurrency(group.total_balance)}</p>
          </div>

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
            <div className="group-accounts-list">
              {group.accounts.map((account) => (
                <AccountCard
                  key={account.id}
                  account={account}
                  onUpdateBalance={handleUpdateBalance}
                  onViewHistory={setViewingHistory}
                  onRemoveFromGroup={handleRemoveFromGroup}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {isEditing && (
        <div className="modal-overlay" onClick={() => setIsEditing(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <GroupForm
              initialData={group}
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
