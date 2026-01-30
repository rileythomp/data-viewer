import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Pencil, Archive, X, Check, Calculator } from 'lucide-react';
import { accountsApi, groupsApi, institutionsApi } from '../services/api';
import BalanceHistoryTable from './BalanceHistoryTable';
import BalanceHistoryChart from './BalanceHistoryChart';
import FormulaDisplay from './FormulaDisplay';
import InlineEditableText from './InlineEditableText';
import { detectCircularDependency } from '../utils/formulaValidation';

export default function AccountDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [account, setAccount] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);
  const [isEditingBalance, setIsEditingBalance] = useState(false);
  const [balanceValue, setBalanceValue] = useState('');
  const [groups, setGroups] = useState([]);
  const [institutions, setInstitutions] = useState([]);
  const [allAccounts, setAllAccounts] = useState([]);
  const [viewMode, setViewMode] = useState('table');
  const [isCalculated, setIsCalculated] = useState(false);
  const [formulaItems, setFormulaItems] = useState([]);
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

  const fetchInstitutions = async () => {
    try {
      const data = await institutionsApi.getAll();
      setInstitutions(data || []);
    } catch (err) {
      // Institutions might not exist, that's okay
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
      await Promise.all([fetchAccount(), fetchHistory(), fetchGroups(), fetchInstitutions(), fetchAllAccounts()]);
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

  const handleSetInstitution = async (institutionId) => {
    try {
      await accountsApi.setInstitution(account.id, institutionId);
      await fetchAccount();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRemoveFromInstitution = async () => {
    try {
      await accountsApi.setInstitution(account.id, null);
      await fetchAccount();
    } catch (err) {
      setError(err.message);
    }
  };

  const getAccountInstitution = () => {
    if (!account?.institution_id) return null;
    return institutions.find(i => i.id === account.institution_id);
  };

  const getAvailableInstitutions = () => {
    if (!institutions || institutions.length === 0) return [];
    // Exclude the current institution if account already has one
    if (account?.institution_id) {
      return institutions.filter(i => i.id !== account.institution_id);
    }
    return institutions;
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

  // Initialize formula state when account loads or edit mode changes
  useEffect(() => {
    if (account) {
      setIsCalculated(account.is_calculated || false);
      if (account.formula && Array.isArray(account.formula)) {
        setFormulaItems(account.formula.map(item => ({
          accountId: item.account_id,
          accountName: allAccounts.find(a => a.id === item.account_id)?.account_name || 'Unknown',
          coefficient: item.coefficient
        })));
      } else {
        setFormulaItems([]);
      }
    }
  }, [account, allAccounts]);

  // Filter out the current account from formula options
  const availableAccountsForFormula = allAccounts.filter(a => a.id !== account?.id);

  // Save handlers for inline editing
  const handleSaveName = async (name) => {
    if (!name.trim()) throw new Error('Account name is required');
    await accountsApi.updateName(account.id, name.trim());
    await fetchAccount();
  };

  const handleSaveInfo = async (info) => {
    await accountsApi.updateInfo(account.id, info || '');
    await fetchAccount();
  };

  const handleToggleCalculated = async (newIsCalculated) => {
    setIsCalculated(newIsCalculated);

    // If turning off calculated mode, save immediately
    if (!newIsCalculated) {
      await accountsApi.updateFormula(account.id, false, null);
      await fetchAccount();
    }
  };

  const handleFormulaChange = (newFormulaItems) => {
    setFormulaItems(newFormulaItems);
  };

  const handleFormulaSave = async (itemsOverride) => {
    if (!isCalculated) return;

    // Use provided items (for remove operations) or current state
    const items = itemsOverride || formulaItems;

    // Validate circular dependencies
    if (items.length > 0) {
      const { hasCircle, errorMessage } = detectCircularDependency(
        account.id,
        items,
        allAccounts
      );
      if (hasCircle) {
        setError(errorMessage);
        return;
      }
    }

    const formulaData = items.map(item => ({
      account_id: item.accountId,
      coefficient: item.coefficient
    }));

    await accountsApi.updateFormula(account.id, isCalculated, formulaData.length > 0 ? formulaData : null);
    await fetchAccount();
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
          <button
            onClick={() => setIsEditMode(!isEditMode)}
            className={`btn-icon ${isEditMode ? 'btn-icon-active' : ''}`}
            title={isEditMode ? "Done editing" : "Edit"}
          >
            {isEditMode ? <Check size={18} /> : <Pencil size={18} />}
          </button>
          <button onClick={handleArchive} className="btn-icon btn-icon-danger" title="Archive">
            <Archive size={18} />
          </button>
        </div>
      </div>

      <div className="detail-content">
        <div className="detail-main">
          {isEditMode ? (
            <InlineEditableText
              value={account.account_name}
              onSave={handleSaveName}
              type="input"
              className="detail-title-input"
              required
              autoFocus
            />
          ) : (
            <h1 className="detail-title">{account.account_name}</h1>
          )}

          {isEditMode && availableAccountsForFormula.length > 0 ? (
            <div className="detail-formula-section-inline">
              <div className="toggle-row">
                <div className="toggle-label-content">
                  <Calculator size={18} className="toggle-icon" />
                  <span className="toggle-text">Calculated Balance</span>
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
              {isCalculated ? (
                <FormulaDisplay
                  formulaItems={formulaItems}
                  accounts={availableAccountsForFormula}
                  editable={true}
                  onChange={handleFormulaChange}
                  onBlur={handleFormulaSave}
                  currentAccountId={account.id}
                  allAccounts={allAccounts}
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
            </div>
          ) : account.is_calculated && account.formula && account.formula.length > 0 ? (
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
                  {isEditMode && (
                    <button
                      onClick={() => handleRemoveFromGroup(group.id)}
                      className="group-tag-remove"
                      title="Remove from group"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {isEditMode && getAvailableGroups().length > 0 && (
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

          <div className="detail-group-section">
            <span className="detail-group-label">Institution</span>
            <div className="group-tags-container">
              {getAccountInstitution() && (
                <div className="group-tag">
                  <span
                    className="group-color-dot"
                    style={{ backgroundColor: getAccountInstitution().color }}
                  />
                  <span
                    className="group-tag-name"
                    onClick={() => navigate(`/institutions/${getAccountInstitution().id}`)}
                    title="View institution"
                  >
                    {getAccountInstitution().name}
                  </span>
                  {isEditMode && (
                    <button
                      onClick={handleRemoveFromInstitution}
                      className="group-tag-remove"
                      title="Remove from institution"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              )}
            </div>
            {isEditMode && getAvailableInstitutions().length > 0 && (
              <select
                className="group-add-dropdown"
                value=""
                onChange={(e) => {
                  if (e.target.value) {
                    handleSetInstitution(parseInt(e.target.value));
                  }
                }}
              >
                <option value="">{account?.institution_id ? 'Change institution...' : 'Set institution...'}</option>
                {getAvailableInstitutions().map(inst => (
                  <option key={inst.id} value={inst.id}>
                    {inst.name}
                  </option>
                ))}
              </select>
            )}
            {institutions.length === 0 && (
              <p className="empty-state-small">No institutions available</p>
            )}
          </div>

          {(account.account_info || isEditMode) && (
            <div className="detail-info-section">
              <span className="detail-info-label">Notes</span>
              {isEditMode ? (
                <InlineEditableText
                  value={account.account_info || ''}
                  onSave={handleSaveInfo}
                  type="textarea"
                  className="detail-info-textarea"
                  placeholder="Add notes..."
                  rows={4}
                />
              ) : (
                <p className="detail-info-text">{account.account_info}</p>
              )}
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

    </div>
  );
}
