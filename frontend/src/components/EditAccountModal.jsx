import { useState } from 'react';
import { Calculator } from 'lucide-react';
import FormulaDisplay from './FormulaDisplay';
import { detectCircularDependency } from '../utils/formulaValidation';

export default function EditAccountModal({ account, accounts = [], onSubmit, onClose }) {
  const [name, setName] = useState(account.account_name);
  const [info, setInfo] = useState(account.account_info || '');
  const [error, setError] = useState('');
  const [isCalculated, setIsCalculated] = useState(account.is_calculated || false);
  const [formulaItems, setFormulaItems] = useState(() => {
    if (account?.formula && Array.isArray(account.formula)) {
      return account.formula.map(item => ({
        accountId: item.account_id,
        accountName: accounts?.find(a => a.id === item.account_id)?.account_name || 'Unknown',
        coefficient: item.coefficient
      }));
    }
    return [];
  });

  // Filter out the current account from formula options to prevent self-reference
  const availableAccounts = accounts.filter(a => a.id !== account.id);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Account name is required');
      return;
    }

    if (isCalculated && formulaItems.length === 0) {
      setError('Calculated account must have at least one account in the formula');
      return;
    }

    // Check for circular dependencies before submitting
    if (isCalculated && formulaItems.length > 0) {
      const { hasCircle, errorMessage } = detectCircularDependency(
        account.id,
        formulaItems,
        accounts
      );
      if (hasCircle) {
        setError(errorMessage);
        return;
      }
    }

    const formulaData = isCalculated ? formulaItems.map(item => ({
      account_id: item.accountId,
      coefficient: item.coefficient
    })) : null;

    try {
      await onSubmit(account.id, name.trim(), info, isCalculated, formulaData);
      onClose();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Edit Account</h3>
        {error && <div className="error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="accountName">Account Name</label>
            <input
              id="accountName"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="form-group">
            <label htmlFor="accountInfo">Account Info</label>
            <textarea
              id="accountInfo"
              value={info}
              onChange={(e) => setInfo(e.target.value)}
              placeholder="e.g., Account number, institution, notes..."
              rows={4}
            />
          </div>

          {availableAccounts.length > 0 && (
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
                  Use a formula to calculate this account's balance from other accounts.
                </p>
              </div>

              {isCalculated && (
                <FormulaDisplay
                  formulaItems={formulaItems}
                  accounts={availableAccounts}
                  editable={true}
                  onChange={setFormulaItems}
                  currentAccountId={account.id}
                  allAccounts={accounts}
                />
              )}
            </>
          )}

          <div className="form-actions">
            <button type="submit" className="btn-primary">Save</button>
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}
