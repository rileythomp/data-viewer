import { Calculator } from 'lucide-react';

export default function FormulaDisplay({ formulaItems, accounts, totalBalance }) {
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

  if (!formulaItems || formulaItems.length === 0) {
    return null;
  }

  return (
    <div className="formula-section formula-display">
      <div className="formula-header">
        <Calculator size={16} />
        <span>Calculated Balance</span>
      </div>
      <div className="formula-items">
        {formulaItems.map((item, index) => (
          <div key={item.account_id} className="formula-item">
            <span className="formula-item-text">
              {index > 0 && (
                <span className="formula-operator">
                  {item.coefficient >= 0 ? '+' : ''}
                </span>
              )}
              <span className="formula-coefficient">{item.coefficient}</span>
              <span className="formula-multiply">×</span>
              <span className="formula-account">{getAccountName(item.account_id)}</span>
            </span>
          </div>
        ))}
        <div className="formula-result">
          = <span className="formula-result-value">{formatCurrency(totalBalance)}</span>
        </div>
      </div>
    </div>
  );
}
