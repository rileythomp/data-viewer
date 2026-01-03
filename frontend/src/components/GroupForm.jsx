import { useState } from 'react';
import { X, Calculator } from 'lucide-react';

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

export default function GroupForm({ onSubmit, onCancel, initialData = null, accounts = [] }) {
  const [groupName, setGroupName] = useState(initialData?.group_name || '');
  const [groupDescription, setGroupDescription] = useState(initialData?.group_description || '');
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
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [coefficient, setCoefficient] = useState('1');

  const handleAddFormulaItem = () => {
    if (!selectedAccountId) return;
    const coef = parseFloat(coefficient) || 1;
    const account = accounts.find(a => a.id === parseInt(selectedAccountId));
    if (!account) return;

    // Check if account already in formula
    if (formulaItems.some(item => item.accountId === account.id)) {
      setError('Account already in formula');
      return;
    }

    setFormulaItems([...formulaItems, {
      accountId: account.id,
      accountName: account.account_name,
      coefficient: coef
    }]);
    setSelectedAccountId('');
    setCoefficient('1');
    setError('');
  };

  const handleRemoveFormulaItem = (accountId) => {
    setFormulaItems(formulaItems.filter(item => item.accountId !== accountId));
  };

  const calculateBalance = () => {
    return formulaItems.reduce((sum, item) => {
      const account = accounts.find(a => a.id === item.accountId);
      if (!account) return sum;
      return sum + (item.coefficient * account.current_balance);
    }, 0);
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

    try {
      await onSubmit(groupName.trim(), groupDescription.trim(), color, isCalculated, formulaData);
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
            <div className="formula-section">
              <label>Formula</label>

              {formulaItems.length > 0 && (
                <div className="formula-items">
                  {formulaItems.map((item, index) => (
                    <div key={item.accountId} className="formula-item">
                      <span className="formula-item-text">
                        {index > 0 && <span className="formula-operator">{item.coefficient >= 0 ? '+' : ''}</span>}
                        <span className="formula-coefficient">{item.coefficient}</span>
                        <span className="formula-multiply">×</span>
                        <span className="formula-account">{item.accountName}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveFormulaItem(item.accountId)}
                        className="btn-icon-small"
                        aria-label="Remove from formula"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                  <div className="formula-result">
                    = <span className="formula-result-value">
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(calculateBalance())}
                    </span>
                  </div>
                </div>
              )}

              {accounts.length > 0 ? (
                <div className="formula-add">
                  <input
                    type="number"
                    step="any"
                    value={coefficient}
                    onChange={(e) => setCoefficient(e.target.value)}
                    placeholder="Coefficient"
                    className="formula-coefficient-input"
                  />
                  <span className="formula-multiply">×</span>
                  <select
                    value={selectedAccountId}
                    onChange={(e) => setSelectedAccountId(e.target.value)}
                    className="formula-account-select"
                  >
                    <option value="">Select account...</option>
                    {accounts
                      .filter(a => !formulaItems.some(item => item.accountId === a.id))
                      .map(a => (
                        <option key={a.id} value={a.id}>{a.account_name}</option>
                      ))
                    }
                  </select>
                  <button
                    type="button"
                    onClick={handleAddFormulaItem}
                    className="btn-small btn-primary"
                    disabled={!selectedAccountId}
                  >
                    Add
                  </button>
                </div>
              ) : (
                <p className="form-hint">No accounts in this group yet.</p>
              )}
            </div>
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
