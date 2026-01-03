import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Archive, ArchiveRestore, Trash2, Plus } from 'lucide-react';
import { accountsApi, groupsApi } from '../services/api';
import DeleteConfirmModal from './DeleteConfirmModal';
import AccountForm from './AccountForm';
import GroupForm from './GroupForm';

export default function SettingsPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('accounts');
  const [accounts, setAccounts] = useState([]);
  const [groups, setGroups] = useState([]);
  const [activeAccounts, setActiveAccounts] = useState([]); // Non-archived accounts for form dropdowns
  const [activeGroups, setActiveGroups] = useState([]); // Non-archived groups for form dropdowns
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, item: null, type: null });
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [showGroupForm, setShowGroupForm] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [accountsData, groupsData, activeAccountsData, activeGroupsData] = await Promise.all([
        accountsApi.getAllIncludingArchived(),
        groupsApi.getAllIncludingArchived(),
        accountsApi.getAll(),
        groupsApi.getAll(),
      ]);
      setAccounts(accountsData);
      setGroups(groupsData);
      setActiveAccounts(activeAccountsData);
      setActiveGroups(activeGroupsData);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleArchive = async (id, type) => {
    try {
      if (type === 'account') {
        await accountsApi.archive(id);
      } else {
        await groupsApi.archive(id);
      }
      fetchData();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleUnarchive = async (id, type) => {
    try {
      if (type === 'account') {
        await accountsApi.unarchive(id);
      } else {
        await groupsApi.unarchive(id);
      }
      fetchData();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async () => {
    if (!deleteModal.item) return;
    try {
      if (deleteModal.type === 'account') {
        await accountsApi.delete(deleteModal.item.id);
      } else {
        await groupsApi.delete(deleteModal.item.id);
      }
      setDeleteModal({ isOpen: false, item: null, type: null });
      fetchData();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleItemClick = (item, type) => {
    if (type === 'account') {
      navigate(`/accounts/${item.id}`);
    } else {
      navigate(`/groups/${item.id}`);
    }
  };

  const openDeleteModal = (item, type) => {
    setDeleteModal({ isOpen: true, item, type });
  };

  const closeDeleteModal = () => {
    setDeleteModal({ isOpen: false, item: null, type: null });
  };

  const handleCreateAccount = async (name, info, balance, calculatedData, groupId) => {
    try {
      const newAccount = await accountsApi.create(name, info, balance, calculatedData);
      // If a group was selected, add the account to the group
      if (groupId) {
        await accountsApi.modifyGroupMembership(newAccount.id, 'add', groupId);
      }
      await fetchData();
      setShowAccountForm(false);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCreateGroup = async (name, description, color, isCalculated, formula, accountIds = []) => {
    try {
      const newGroup = await groupsApi.create(name, description, color, isCalculated, formula);
      // Add selected accounts to the new group
      for (let i = 0; i < accountIds.length; i++) {
        await accountsApi.modifyGroupMembership(accountIds[i], 'add', newGroup.id, null, i + 1);
      }
      await fetchData();
      setShowGroupForm(false);
    } catch (err) {
      setError(err.message);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="app">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  const currentItems = activeTab === 'accounts' ? accounts : groups;

  return (
    <div className="app">
      <div className="header">
        <div className="header-content">
          <h1>Settings</h1>
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="settings-tabs">
        <button
          className={`settings-tab ${activeTab === 'accounts' ? 'active' : ''}`}
          onClick={() => setActiveTab('accounts')}
        >
          Accounts ({accounts.length})
        </button>
        <button
          className={`settings-tab ${activeTab === 'groups' ? 'active' : ''}`}
          onClick={() => setActiveTab('groups')}
        >
          Groups ({groups.length})
        </button>
        <button
          className="btn-primary settings-create-btn"
          onClick={() => activeTab === 'accounts' ? setShowAccountForm(true) : setShowGroupForm(true)}
        >
          <Plus size={18} />
          Create {activeTab === 'accounts' ? 'Account' : 'Group'}
        </button>
      </div>

      {showAccountForm && (
        <AccountForm
          onSubmit={handleCreateAccount}
          onCancel={() => setShowAccountForm(false)}
          accounts={activeAccounts}
          groups={activeGroups}
        />
      )}

      {showGroupForm && (
        <GroupForm
          onSubmit={handleCreateGroup}
          onCancel={() => setShowGroupForm(false)}
          accounts={activeAccounts}
          allAccounts={activeAccounts}
        />
      )}

      <div className="settings-list">
        {currentItems.length === 0 ? (
          <div className="empty-state">
            No {activeTab} found
          </div>
        ) : (
          currentItems.map((item) => {
            const name = activeTab === 'accounts' ? item.account_name : item.group_name;
            const isArchived = item.is_archived;

            return (
              <div
                key={item.id}
                className={`settings-list-item ${isArchived ? 'settings-list-item-archived' : ''}`}
              >
                <div className="settings-list-item-content" onClick={() => handleItemClick(item, activeTab === 'accounts' ? 'account' : 'group')}>
                  {activeTab === 'groups' && item.color && (
                    <div
                      className="group-color-dot"
                      style={{ backgroundColor: item.color }}
                    />
                  )}
                  <span className="settings-list-item-name">{name}</span>
                  {isArchived && <span className="archived-badge">ARCHIVED</span>}
                  {activeTab === 'accounts' && (
                    <span className="settings-list-item-balance">
                      {formatCurrency(item.current_balance)}
                    </span>
                  )}
                </div>
                <div className="settings-list-item-actions">
                  {isArchived ? (
                    <button
                      className="btn-icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUnarchive(item.id, activeTab === 'accounts' ? 'account' : 'group');
                      }}
                      title="Unarchive"
                    >
                      <ArchiveRestore size={18} />
                    </button>
                  ) : (
                    <button
                      className="btn-icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleArchive(item.id, activeTab === 'accounts' ? 'account' : 'group');
                      }}
                      title="Archive"
                    >
                      <Archive size={18} />
                    </button>
                  )}
                  <button
                    className="btn-icon btn-icon-danger"
                    onClick={(e) => {
                      e.stopPropagation();
                      openDeleteModal(item, activeTab === 'accounts' ? 'account' : 'group');
                    }}
                    title="Delete permanently"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <DeleteConfirmModal
        isOpen={deleteModal.isOpen}
        itemName={deleteModal.item ? (deleteModal.type === 'account' ? deleteModal.item.account_name : deleteModal.item.group_name) : ''}
        itemType={deleteModal.type || 'item'}
        onConfirm={handleDelete}
        onCancel={closeDeleteModal}
      />
    </div>
  );
}
