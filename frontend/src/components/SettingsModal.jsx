import { useState, useEffect } from 'react';
import { Calculator } from 'lucide-react';
import TotalFormulaDisplay from './TotalFormulaDisplay';
import { settingsApi } from '../services/api';

export default function SettingsModal({ accounts, groups, totalFormulaConfig, onSave, onClose }) {
  const [isEnabled, setIsEnabled] = useState(totalFormulaConfig?.is_enabled || false);
  const [formulaItems, setFormulaItems] = useState([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (totalFormulaConfig?.formula) {
      setFormulaItems(totalFormulaConfig.formula);
    }
  }, [totalFormulaConfig]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (isEnabled && formulaItems.length === 0) {
      setError('Custom Total formula must have at least one item');
      return;
    }

    setSaving(true);
    try {
      await settingsApi.updateTotalFormula(isEnabled, formulaItems);
      onSave();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Create groups with total_balance for the formula display
  const groupsWithBalances = groups?.map(g => ({
    ...g,
    total_balance: g.total_balance || 0
  })) || [];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal settings-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Total Formula Settings</h3>
        {error && <div className="error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <div className="toggle-row">
              <div className="toggle-label-content">
                <Calculator size={18} className="toggle-icon" />
                <span className="toggle-text">Use Custom Total Formula</span>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={isEnabled}
                  onChange={(e) => setIsEnabled(e.target.checked)}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
            <p className="form-hint">
              {isEnabled
                ? 'Define a custom formula using accounts and groups to calculate the Total.'
                : 'Total is calculated as the sum of all group totals and ungrouped account balances.'}
            </p>
          </div>

          {isEnabled && (
            <TotalFormulaDisplay
              formulaItems={formulaItems}
              accounts={accounts}
              groups={groupsWithBalances}
              editable={true}
              onChange={setFormulaItems}
            />
          )}

          <div className="form-actions">
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary" disabled={saving}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
