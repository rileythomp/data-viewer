import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { detectCircularDependency } from '../utils/formulaValidation';

export default function FormulaDisplay({
  formulaItems,
  accounts,
  totalBalance,
  editable = false,
  onChange,
  onBlur,
  currentAccountId = null,
  allAccounts = null,
}) {
  const navigate = useNavigate();
  const [coefficient, setCoefficient] = useState('1');
  const [validationError, setValidationError] = useState('');

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getAccountName = (accountId) => {
    const account = accounts.find(a => a.id === accountId);
    return account?.account_name || 'Unknown Account';
  };

  const formatCoefficient = (coefficient) => {
    const absCoeff = Math.abs(coefficient);
    // Omit coefficient display if it's 1
    if (absCoeff === 1) {
      return '';
    }
    return `${absCoeff} x`;
  };

  // Normalize formula items to handle both formats:
  // - Display mode: {account_id, coefficient}
  // - Edit mode: {accountId, accountName, coefficient}
  const normalizeItem = (item) => {
    return {
      accountId: item.accountId ?? item.account_id,
      coefficient: item.coefficient
    };
  };

  const calculateBalance = () => {
    if (!formulaItems || !accounts) return 0;
    return formulaItems.reduce((sum, item) => {
      const normalized = normalizeItem(item);
      const account = accounts.find(a => a.id === normalized.accountId);
      if (!account) return sum;
      return sum + (normalized.coefficient * account.current_balance);
    }, 0);
  };

  const handleAddFormulaItem = (accountId) => {
    if (!accountId || !onChange) return;
    const coef = parseFloat(coefficient) || 1;
    const account = accounts.find(a => a.id === parseInt(accountId));
    if (!account) return;

    const normalized = formulaItems.map(normalizeItem);
    // Check if account already in formula
    if (normalized.some(item => item.accountId === account.id)) {
      return;
    }

    // Check for circular dependency (use allAccounts if provided for full dependency graph)
    const proposedFormula = [
      ...formulaItems,
      { accountId: account.id, coefficient: coef }
    ];
    const { hasCircle, errorMessage } = detectCircularDependency(
      currentAccountId,
      proposedFormula,
      allAccounts || accounts
    );
    if (hasCircle) {
      setValidationError(errorMessage);
      return;
    }
    setValidationError('');

    const newItems = [...formulaItems, {
      accountId: account.id,
      accountName: account.account_name,
      coefficient: coef
    }];
    onChange(newItems);
    setCoefficient('1');
    // Trigger save after adding, passing the new items directly
    if (onBlur) {
      onBlur(newItems);
    }
  };

  const handleRemoveFormulaItem = (accountId) => {
    if (!onChange) return;
    const newItems = formulaItems.filter(item => {
      const normalized = normalizeItem(item);
      return normalized.accountId !== accountId;
    });
    onChange(newItems);
    // Trigger save after removing, passing the new items directly
    // since state won't be updated yet
    if (onBlur) {
      onBlur(newItems);
    }
  };

  const displayBalance = editable ? calculateBalance() : totalBalance;

  if (!editable && (!formulaItems || formulaItems.length === 0)) {
    return null;
  }

  return (
    <div className="formula-section formula-display">
      {validationError && (
        <div className="formula-error">{validationError}</div>
      )}
      {formulaItems && formulaItems.length > 0 && (
        <div className={`formula-items formula-items-vertical${!editable ? ' formula-items-no-margin' : ''}`}>
          {formulaItems.map((item, index) => {
            const normalized = normalizeItem(item);
            const isPositive = normalized.coefficient >= 0;
            const coeffDisplay = formatCoefficient(normalized.coefficient);
            const accountName = item.accountName || getAccountName(normalized.accountId);

            return (
              <div key={normalized.accountId} className="formula-item-row">
                <span className={`formula-sign ${isPositive ? 'formula-sign-plus' : 'formula-sign-minus'}`}>
                  {index === 0 && isPositive ? '' : (isPositive ? '+' : '−')}
                </span>
                <span className="formula-term">
                  {coeffDisplay && <span className="formula-coefficient">{coeffDisplay}&nbsp;</span>}
                  {editable ? (
                    <span className="formula-account">{accountName}</span>
                  ) : (
                    <span
                      className="formula-account formula-account-link"
                      onClick={(e) => { e.stopPropagation(); navigate(`/accounts/${normalized.accountId}`); }}
                      role="link"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); navigate(`/accounts/${normalized.accountId}`); } }}
                    >
                      {accountName}
                    </span>
                  )}
                </span>
                {editable && (
                  <button
                    type="button"
                    onClick={() => handleRemoveFormulaItem(normalized.accountId)}
                    className="btn-icon-small"
                    aria-label="Remove from formula"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            );
          })}
          <div className="formula-result">
            = <span className="formula-result-value">{formatCurrency(displayBalance)}</span>
          </div>
        </div>
      )}

      {editable && accounts && accounts.length > 0 && (
        <div className="formula-add">
          <input
            type="number"
            step="any"
            value={coefficient}
            onChange={(e) => setCoefficient(e.target.value)}
            onBlur={onBlur}
            placeholder="Coefficient"
            className="formula-coefficient-input"
          />
          <span className="formula-multiply">×</span>
          <select
            value=""
            onChange={(e) => handleAddFormulaItem(e.target.value)}
            onBlur={onBlur}
            className="formula-account-select"
          >
            <option value="">Select account...</option>
            {accounts
              .filter(a => !formulaItems?.some(item => normalizeItem(item).accountId === a.id))
              .map(a => (
                <option key={a.id} value={a.id}>{a.account_name}</option>
              ))
            }
          </select>
        </div>
      )}

      {editable && (!accounts || accounts.length === 0) && (
        <p className="form-hint">No accounts available. Create regular accounts first.</p>
      )}
    </div>
  );
}
