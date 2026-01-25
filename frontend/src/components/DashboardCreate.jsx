import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Calculator } from 'lucide-react';
import { dashboardsApi, accountsApi, groupsApi, institutionsApi } from '../services/api';
import MultiSelectDropdown from './MultiSelectDropdown';
import DashboardFormulaDisplay from './DashboardFormulaDisplay';

export default function DashboardCreate() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedAccounts, setSelectedAccounts] = useState([]);
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [selectedInstitutions, setSelectedInstitutions] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [groups, setGroups] = useState([]);
  const [institutions, setInstitutions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [isCalculated, setIsCalculated] = useState(false);
  const [formulaItems, setFormulaItems] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [accountsData, groupsData, institutionsData] = await Promise.all([
          accountsApi.getAll(),
          groupsApi.getAll(),
          institutionsApi.getAll(),
        ]);
        setAccounts(accountsData || []);
        setGroups(groupsData || []);
        setInstitutions(institutionsData || []);
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
        selectedGroups,
        selectedInstitutions,
        isCalculated,
        isCalculated ? formulaItems : null
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

          {institutions.length > 0 && (
            <div className="form-group">
              <label>Institutions</label>
              <MultiSelectDropdown
                items={institutions}
                selectedIds={selectedInstitutions}
                onChange={setSelectedInstitutions}
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
          )}

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
                  onChange={(e) => setIsCalculated(e.target.checked)}
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
                accounts={accounts}
                groups={groups}
                institutions={institutions}
                editable={true}
                onChange={setFormulaItems}
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
