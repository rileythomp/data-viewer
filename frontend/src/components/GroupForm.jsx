import { useState } from 'react';
import { Calculator, X } from 'lucide-react';
import FormulaDisplay from './FormulaDisplay';

const COLOR_PRESETS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
];

export default function GroupForm({ onSubmit, onCancel, initialData = null, accounts = [], allAccounts = [] }) {
  const [groupName, setGroupName] = useState(initialData?.name || '');
  const [groupDescription, setGroupDescription] = useState(initialData?.description || '');
  const [color, setColor] = useState(initialData?.color || COLOR_PRESETS[0]);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCalculated, setIsCalculated] = useState(initialData?.is_calculated || false);
  const [formulaItems, setFormulaItems] = useState(() => {
    if (initialData?.formula && Array.isArray(initialData.formula)) {
      return initialData.formula.map(item => ({
        accountId: item.account_id,
        accountName: accounts?.find(a => a.id === item.account_id)?.account_name || 'Unknown',
        coefficient: item.coefficient
      }));
    }
    return [];
  });
  const [selectedAccounts, setSelectedAccounts] = useState(() => {
    if (initialData?.accounts && Array.isArray(initialData.accounts)) {
      return initialData.accounts;
    }
    return [];
  });

  // Filter to show accounts not already selected for this group
  const availableAccounts = allAccounts.filter(a => {
    return !selectedAccounts.some(sa => sa.id === a.id);
  });

  const handleAddAccount = (accountId) => {
    if (!accountId) return;
    const account = allAccounts.find(a => a.id === parseInt(accountId));
    if (!account) return;
    setSelectedAccounts([...selectedAccounts, account]);
  };

  const handleRemoveAccount = (accountId) => {
    setSelectedAccounts(selectedAccounts.filter(a => a.id !== accountId));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!groupName.trim()) {
      setError('Group name is required');
      return;
    }

    if (isCalculated && formulaItems.length === 0) {
      setError('Calculated group must have at least one account in the formula');
      return;
    }

    setIsSubmitting(true);
    setError('');

    const formulaData = isCalculated ? formulaItems.map(item => ({
      account_id: item.accountId,
      coefficient: item.coefficient
    })) : null;

    const accountIds = selectedAccounts.map(a => a.id);

    try {
      await onSubmit(groupName.trim(), groupDescription.trim(), color, isCalculated, formulaData, accountIds);
    } catch (err) {
      setError(err.message);
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="group-form">
      <h3>{initialData ? 'Edit Group' : 'Create New Group'}</h3>

      {error && <div className="error">{error}</div>}

      <div className="form-group">
        <label htmlFor="groupName">Group Name *</label>
        <input
          id="groupName"
          type="text"
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
          placeholder="e.g., Savings, Investments"
          autoFocus
        />
      </div>

      <div className="form-group">
        <label htmlFor="groupDescription">Description</label>
        <textarea
          id="groupDescription"
          value={groupDescription}
          onChange={(e) => setGroupDescription(e.target.value)}
          placeholder="Optional description for this group"
          rows={2}
        />
      </div>

      <div className="form-group">
        <label>Color</label>
        <div className="color-presets">
          {COLOR_PRESETS.map((presetColor) => (
            <button
              key={presetColor}
              type="button"
              className={`color-preset ${color === presetColor ? 'selected' : ''}`}
              style={{ backgroundColor: presetColor }}
              onClick={() => setColor(presetColor)}
              aria-label={`Select color ${presetColor}`}
            />
          ))}
        </div>
      </div>

      {allAccounts.length > 0 && (
        <div className="form-group">
          <label>Accounts</label>
          {selectedAccounts.length > 0 && (
            <div className="selected-accounts-list">
              {selectedAccounts.map((account) => (
                <div key={account.id} className="selected-account-item">
                  <span className="selected-account-name">{account.account_name}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveAccount(account.id)}
                    className="btn-icon-small"
                    aria-label={`Remove ${account.account_name}`}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
          {availableAccounts.length > 0 && (
            <select
              value=""
              onChange={(e) => handleAddAccount(e.target.value)}
              className="account-select"
            >
              <option value="">Select account to add...</option>
              {availableAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.account_name}
                </option>
              ))}
            </select>
          )}
          {availableAccounts.length === 0 && selectedAccounts.length === 0 && (
            <p className="form-hint">No accounts available to add.</p>
          )}
        </div>
      )}

      {initialData && accounts && accounts.length > 0 && (
        <>
          <div className="form-group">
            <div className="toggle-row">
              <div className="toggle-label-content">
                <Calculator size={18} className="toggle-icon" />
                <span className="toggle-text">Calculated Balance</span>
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
              Use a formula instead of summing all account balances.
            </p>
          </div>

          {isCalculated && (
            <FormulaDisplay
              formulaItems={formulaItems}
              accounts={accounts}
              editable={true}
              onChange={setFormulaItems}
            />
          )}
        </>
      )}

      <div className="form-actions">
        <button type="button" onClick={onCancel} className="btn-secondary" disabled={isSubmitting}>
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : initialData ? 'Save Changes' : 'Create Group'}
        </button>
      </div>
    </form>
  );
}
