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

  const formatCoefficient = (coefficient) => {
    const absCoeff = Math.abs(coefficient);
    // Omit coefficient display if it's 1
    if (absCoeff === 1) {
      return '';
    }
    return `${absCoeff} x`;
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
      <div className="formula-items formula-items-vertical">
        {formulaItems.map((item, index) => {
          const isPositive = item.coefficient >= 0;
          const coeffDisplay = formatCoefficient(item.coefficient);

          return (
            <div key={item.account_id} className="formula-item-row">
              <span className={`formula-sign ${isPositive ? 'formula-sign-plus' : 'formula-sign-minus'}`}>
                {index === 0 && isPositive ? '' : (isPositive ? '+' : '−')}
              </span>
              <span className="formula-term">
                {coeffDisplay && <span className="formula-coefficient">{coeffDisplay}&nbsp;</span>}
                <span className="formula-account">{getAccountName(item.account_id)}</span>
              </span>
            </div>
          );
        })}
        <div className="formula-result">
          = <span className="formula-result-value">{formatCurrency(totalBalance)}</span>
        </div>
      </div>
    </div>
  );
}
