import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Archive, ArchiveRestore, Trash2, Plus } from 'lucide-react';
import { accountsApi, groupsApi, institutionsApi } from '../services/api';
import DeleteConfirmModal from './DeleteConfirmModal';
import AccountForm from './AccountForm';
import GroupForm from './GroupForm';
import InstitutionForm from './InstitutionForm';

export default function SettingsPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('accounts');
  const [accounts, setAccounts] = useState([]);
  const [groups, setGroups] = useState([]);
  const [institutions, setInstitutions] = useState([]);
  const [activeAccounts, setActiveAccounts] = useState([]); // Non-archived accounts for form dropdowns
  const [activeGroups, setActiveGroups] = useState([]); // Non-archived groups for form dropdowns
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, item: null, type: null });
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [showInstitutionForm, setShowInstitutionForm] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [accountsData, groupsData, institutionsData, activeAccountsData, activeGroupsData] = await Promise.all([
        accountsApi.getAllIncludingArchived(),
        groupsApi.getAllIncludingArchived(),
        institutionsApi.getAllIncludingArchived(),
        accountsApi.getAll(),
        groupsApi.getAll(),
      ]);
      setAccounts(accountsData);
      setGroups(groupsData);
      setInstitutions(institutionsData);
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
      } else if (type === 'group') {
        await groupsApi.archive(id);
      } else if (type === 'institution') {
        await institutionsApi.archive(id);
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
      } else if (type === 'group') {
        await groupsApi.unarchive(id);
      } else if (type === 'institution') {
        await institutionsApi.unarchive(id);
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
      } else if (deleteModal.type === 'group') {
        await groupsApi.delete(deleteModal.item.id);
      } else if (deleteModal.type === 'institution') {
        await institutionsApi.delete(deleteModal.item.id);
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
    } else if (type === 'group') {
      navigate(`/groups/${item.id}`);
    } else if (type === 'institution') {
      navigate(`/institutions/${item.id}`);
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

  const handleCreateInstitution = async (name, description, color, isCalculated, formula) => {
    try {
      await institutionsApi.create(name, description, color, isCalculated, formula);
      await fetchData();
      setShowInstitutionForm(false);
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) {
    return (
      <div className="app">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  const sortedAccounts = [...accounts].sort((a, b) => a.account_name.localeCompare(b.account_name));
  const sortedGroups = [...groups].sort((a, b) => a.group_name.localeCompare(b.group_name));
  const sortedInstitutions = [...institutions].sort((a, b) => a.name.localeCompare(b.name));
  const currentItems = activeTab === 'accounts' ? sortedAccounts : activeTab === 'groups' ? sortedGroups : sortedInstitutions;

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
          className={`settings-tab ${activeTab === 'institutions' ? 'active' : ''}`}
          onClick={() => setActiveTab('institutions')}
        >
          Institutions ({institutions.length})
        </button>
        <button
          className="btn-primary settings-create-btn"
          onClick={() => {
            if (activeTab === 'accounts') setShowAccountForm(true);
            else if (activeTab === 'groups') setShowGroupForm(true);
            else if (activeTab === 'institutions') setShowInstitutionForm(true);
          }}
        >
          <Plus size={18} />
          Create {activeTab === 'accounts' ? 'Account' : activeTab === 'groups' ? 'Group' : 'Institution'}
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

      {showInstitutionForm && (
        <InstitutionForm
          onSubmit={handleCreateInstitution}
          onCancel={() => setShowInstitutionForm(false)}
        />
      )}

      <div className="settings-list">
        {currentItems.length === 0 ? (
          <div className="empty-state">
            No {activeTab} found
          </div>
        ) : (
          currentItems.map((item) => {
            const name = activeTab === 'accounts' ? item.account_name : activeTab === 'groups' ? item.group_name : item.name;
            const itemType = activeTab === 'accounts' ? 'account' : activeTab === 'groups' ? 'group' : 'institution';
            const isArchived = item.is_archived;

            return (
              <div
                key={item.id}
                className={`settings-list-item ${isArchived ? 'settings-list-item-archived' : ''}`}
              >
                <div className="settings-list-item-content" onClick={() => handleItemClick(item, itemType)}>
                  {(activeTab === 'groups' || activeTab === 'institutions') && item.color && (
                    <div
                      className="group-color-dot"
                      style={{ backgroundColor: item.color }}
                    />
                  )}
                  <span className="settings-list-item-name">{name}</span>
                  {isArchived && <span className="archived-badge">ARCHIVED</span>}
                </div>
                <div className="settings-list-item-actions">
                  {isArchived ? (
                    <button
                      className="btn-icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUnarchive(item.id, itemType);
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
                        handleArchive(item.id, itemType);
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
                      openDeleteModal(item, itemType);
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
        itemName={deleteModal.item ? (deleteModal.type === 'account' ? deleteModal.item.account_name : deleteModal.type === 'group' ? deleteModal.item.group_name : deleteModal.item.name) : ''}
        itemType={deleteModal.type || 'item'}
        onConfirm={handleDelete}
        onCancel={closeDeleteModal}
      />
    </div>
  );
}
