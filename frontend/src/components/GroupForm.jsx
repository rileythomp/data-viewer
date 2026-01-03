import { useState } from 'react';
import { Calculator } from 'lucide-react';
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
