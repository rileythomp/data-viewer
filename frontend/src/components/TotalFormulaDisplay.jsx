import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';

export default function TotalFormulaDisplay({
  formulaItems,
  accounts,
  groups,
  totalBalance,
  editable = false,
  onChange,
}) {
  const navigate = useNavigate();
  const [coefficient, setCoefficient] = useState('1');
  const [selectedType, setSelectedType] = useState('account');
  const [selectedId, setSelectedId] = useState('');

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getItemName = (type, id) => {
    if (type === 'account') {
      const account = accounts.find(a => a.id === id);
      return account?.account_name || 'Unknown Account';
    } else {
      const group = groups.find(g => g.id === id);
      return group?.group_name || 'Unknown Group';
    }
  };

  const getItemBalance = (type, id) => {
    if (type === 'account') {
      const account = accounts.find(a => a.id === id);
      return account?.current_balance || 0;
    } else {
      const group = groups.find(g => g.id === id);
      return group?.total_balance || 0;
    }
  };

  const formatCoefficient = (coefficient) => {
    const absCoeff = Math.abs(coefficient);
    if (absCoeff === 1) {
      return '';
    }
    return `${absCoeff} x`;
  };

  const calculateBalance = () => {
    if (!formulaItems) return 0;
    return formulaItems.reduce((sum, item) => {
      const balance = getItemBalance(item.type, item.id);
      return sum + (item.coefficient * balance);
    }, 0);
  };

  const handleAddFormulaItem = () => {
    if (!selectedId || !onChange) return;
    const coef = parseFloat(coefficient) || 1;
    const id = parseInt(selectedId);

    // Check if item already in formula
    if (formulaItems.some(item => item.type === selectedType && item.id === id)) {
      return;
    }

    const newItems = [...formulaItems, {
      id: id,
      type: selectedType,
      coefficient: coef
    }];
    onChange(newItems);
    setCoefficient('1');
    setSelectedId('');
  };

  const handleRemoveFormulaItem = (type, id) => {
    if (!onChange) return;
    const newItems = formulaItems.filter(item => !(item.type === type && item.id === id));
    onChange(newItems);
  };

  const displayBalance = editable ? calculateBalance() : totalBalance;

  // Get available items for selection (not already in formula)
  const availableAccounts = accounts?.filter(a =>
    !a.is_archived && !formulaItems?.some(item => item.type === 'account' && item.id === a.id)
  ) || [];
  const availableGroups = groups?.filter(g =>
    !g.is_archived && !formulaItems?.some(item => item.type === 'group' && item.id === g.id)
  ) || [];

  const availableItems = selectedType === 'account' ? availableAccounts : availableGroups;

  if (!editable && (!formulaItems || formulaItems.length === 0)) {
    return null;
  }

  return (
    <div className="formula-section formula-display">
      {formulaItems && formulaItems.length > 0 && (
        <div className={`formula-items formula-items-vertical${!editable ? ' formula-items-no-margin' : ''}`}>
          {formulaItems.map((item, index) => {
            const isPositive = item.coefficient >= 0;
            const coeffDisplay = formatCoefficient(item.coefficient);
            const itemName = getItemName(item.type, item.id);

            return (
              <div key={`${item.type}-${item.id}`} className="formula-item-row">
                <span className={`formula-sign ${isPositive ? 'formula-sign-plus' : 'formula-sign-minus'}`}>
                  {index === 0 && isPositive ? '' : (isPositive ? '+' : '−')}
                </span>
                <span className="formula-term">
                  {coeffDisplay && <span className="formula-coefficient">{coeffDisplay}&nbsp;</span>}
                  <span className={`formula-type-badge formula-type-badge-${item.type}`}>
                    {item.type === 'account' ? 'A' : 'G'}
                  </span>
                  {editable ? (
                    <span className="formula-account">{itemName}</span>
                  ) : (
                    <span
                      className="formula-account formula-account-link"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (item.type === 'account') {
                          navigate(`/accounts/${item.id}`);
                        }
                      }}
                      role={item.type === 'account' ? 'link' : 'text'}
                      tabIndex={item.type === 'account' ? 0 : -1}
                      onKeyDown={(e) => {
                        if (item.type === 'account' && (e.key === 'Enter' || e.key === ' ')) {
                          e.preventDefault();
                          e.stopPropagation();
                          navigate(`/accounts/${item.id}`);
                        }
                      }}
                    >
                      {itemName}
                    </span>
                  )}
                </span>
                {editable && (
                  <button
                    type="button"
                    onClick={() => handleRemoveFormulaItem(item.type, item.id)}
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

      {editable && (
        <div className="formula-add">
          <input
            type="number"
            step="any"
            value={coefficient}
            onChange={(e) => setCoefficient(e.target.value)}
            placeholder="Coefficient"
            className="formula-coefficient-input"
          />
          <span className="formula-multiply">x</span>
          <select
            value={selectedType}
            onChange={(e) => {
              setSelectedType(e.target.value);
              setSelectedId('');
            }}
            className="formula-type-select"
          >
            <option value="account">Account</option>
            <option value="group">Group</option>
          </select>
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="formula-account-select"
          >
            <option value="">Select {selectedType}...</option>
            {availableItems.map(item => (
              <option key={item.id} value={item.id}>
                {selectedType === 'account' ? item.account_name : item.group_name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleAddFormulaItem}
            className="btn-secondary btn-small"
            disabled={!selectedId}
          >
            Add
          </button>
        </div>
      )}

      {editable && availableAccounts.length === 0 && availableGroups.length === 0 && formulaItems.length === 0 && (
        <p className="form-hint">No accounts or groups available. Create some first.</p>
      )}
    </div>
  );
}
