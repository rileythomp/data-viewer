import { useState } from 'react';
import { X, Calculator } from 'lucide-react';

export default function AccountForm({ onSubmit, onCancel, accounts = [], groups = [] }) {
  const [accountName, setAccountName] = useState('');
  const [accountInfo, setAccountInfo] = useState('');
  const [balance, setBalance] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [error, setError] = useState('');
  const [isCalculated, setIsCalculated] = useState(false);
  const [formulaItems, setFormulaItems] = useState([]);
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
    setError('');

    if (!accountName.trim()) {
      setError('Account name is required');
      return;
    }

    if (isCalculated && formulaItems.length === 0) {
      setError('Calculated account must have at least one account in the formula');
      return;
    }

    const balanceNum = isCalculated ? calculateBalance() : (parseFloat(balance) || 0);
    const calculatedData = isCalculated ? {
      is_calculated: true,
      formula: formulaItems.map(item => ({
        account_id: item.accountId,
        coefficient: item.coefficient
      }))
    } : null;

    try {
      const groupId = selectedGroupId ? parseInt(selectedGroupId) : null;
      await onSubmit(accountName.trim(), accountInfo.trim(), balanceNum, calculatedData, groupId);
      setAccountName('');
      setAccountInfo('');
      setBalance('');
      setSelectedGroupId('');
      setIsCalculated(false);
      setFormulaItems([]);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="account-form">
      <h3>Add New Account</h3>
      {error && <div className="error">{error}</div>}
      <div className="form-group">
        <label htmlFor="accountName">Account Name</label>
        <input
          id="accountName"
          type="text"
          value={accountName}
          onChange={(e) => setAccountName(e.target.value)}
          placeholder="e.g., Savings Account"
        />
      </div>
      <div className="form-group">
        <label htmlFor="accountInfo">Account Info (optional)</label>
        <textarea
          id="accountInfo"
          value={accountInfo}
          onChange={(e) => setAccountInfo(e.target.value)}
          placeholder="e.g., Account number, institution, notes..."
          rows={3}
        />
      </div>
      {groups.length > 0 && (
        <div className="form-group">
          <label htmlFor="groupSelect">Group (optional)</label>
          <select
            id="groupSelect"
            value={selectedGroupId}
            onChange={(e) => setSelectedGroupId(e.target.value)}
          >
            <option value="">No group</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.group_name}
              </option>
            ))}
          </select>
        </div>
      )}
      {!isCalculated && (
        <div className="form-group">
          <label htmlFor="balance">Initial Balance</label>
          <input
            id="balance"
            type="number"
            step="0.01"
            value={balance}
            onChange={(e) => setBalance(e.target.value)}
            placeholder="0.00"
          />
        </div>
      )}

      <div className="form-group">
        <div className="toggle-row">
          <div className="toggle-label-content">
            <Calculator size={18} className="toggle-icon" />
            <span className="toggle-text">Calculated Account</span>
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
          Calculated accounts derive their balance from a formula of other accounts.
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
            <p className="form-hint">No accounts available. Create regular accounts first.</p>
          )}
        </div>
      )}

      <div className="form-actions">
        <button type="submit" className="btn-primary">Add Account</button>
        {onCancel && <button type="button" onClick={onCancel} className="btn-secondary">Cancel</button>}
      </div>
    </form>
  );
}
