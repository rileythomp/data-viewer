import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { dashboardsApi, accountsApi, groupsApi } from '../services/api';
import MultiSelectDropdown from './MultiSelectDropdown';

export default function DashboardCreate() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedAccounts, setSelectedAccounts] = useState([]);
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [accountsData, groupsData] = await Promise.all([
          accountsApi.getAll(),
          groupsApi.getAll(),
        ]);
        setAccounts(accountsData || []);
        setGroups(groupsData || []);
      } catch (err) {
        setError('Failed to load data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleAccountToggle = (accountId) => {
    setSelectedAccounts(prev =>
      prev.includes(accountId)
        ? prev.filter(id => id !== accountId)
        : [...prev, accountId]
    );
  };

  const handleGroupToggle = (groupId) => {
    setSelectedGroups(prev =>
      prev.includes(groupId)
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Dashboard name is required');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const dashboard = await dashboardsApi.create(
        name.trim(),
        description.trim(),
        selectedAccounts,
        selectedGroups
      );
      navigate(`/dashboards/${dashboard.id}`);
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="app">
      <div className="detail-header">
        <button onClick={() => navigate('/dashboards')} className="btn-back">
          <ArrowLeft size={18} />
          <span>Back</span>
        </button>
      </div>

      <div className="detail-main">
        <h1 className="detail-title">Create Dashboard</h1>

        {error && <div className="error">{error}</div>}

        <form onSubmit={handleSubmit} className="dashboard-form">
          <div className="form-group">
            <label htmlFor="name">Name *</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Dashboard"
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description..."
              rows={3}
            />
          </div>

          {accounts.length > 0 && (
            <div className="form-group">
              <label>Accounts</label>
              <MultiSelectDropdown
                items={accounts}
                selectedIds={selectedAccounts}
                onChange={setSelectedAccounts}
                placeholder="Select accounts..."
                labelKey="account_name"
              />
            </div>
          )}

          {groups.length > 0 && (
            <div className="form-group">
              <label>Groups</label>
              <MultiSelectDropdown
                items={groups}
                selectedIds={selectedGroups}
                onChange={setSelectedGroups}
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
          )}

          <div className="form-actions">
            <button
              type="button"
              onClick={() => navigate('/dashboards')}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={submitting}
            >
              {submitting ? 'Creating...' : 'Create Dashboard'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
