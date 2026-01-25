import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';

export default function DashboardFormulaDisplay({
  formulaItems,
  accounts,
  groups,
  institutions,
  totalBalance,
  editable = false,
  onChange,
}) {
  const navigate = useNavigate();
  const [coefficient, setCoefficient] = useState('1');
  const [selectedType, setSelectedType] = useState('account');

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
    } else if (type === 'group') {
      const group = groups.find(g => g.id === id);
      return group?.group_name || 'Unknown Group';
    } else {
      const institution = institutions.find(i => i.id === id);
      return institution?.name || 'Unknown Institution';
    }
  };

  const getItemBalance = (type, id) => {
    if (type === 'account') {
      const account = accounts.find(a => a.id === id);
      return account?.current_balance || 0;
    } else if (type === 'group') {
      const group = groups.find(g => g.id === id);
      return group?.total_balance || 0;
    } else {
      const institution = institutions.find(i => i.id === id);
      return institution?.total_balance || 0;
    }
  };

  const getItemNavigatePath = (type, id) => {
    if (type === 'account') return `/accounts/${id}`;
    if (type === 'group') return `/groups/${id}`;
    return `/institutions/${id}`;
  };

  const getTypeBadge = (type) => {
    if (type === 'account') return 'A';
    if (type === 'group') return 'G';
    return 'I';
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

  const handleAddFormulaItem = (itemId, itemType) => {
    if (!itemId || !onChange) return;
    const coef = parseFloat(coefficient) || 1;
    const id = parseInt(itemId);

    // Check if item already in formula
    if (formulaItems.some(item => item.type === itemType && item.id === id)) {
      return;
    }

    const newItems = [...formulaItems, {
      id: id,
      type: itemType,
      coefficient: coef
    }];
    onChange(newItems);
    setCoefficient('1');
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
  const availableInstitutions = institutions?.filter(i =>
    !i.is_archived && !formulaItems?.some(item => item.type === 'institution' && item.id === i.id)
  ) || [];

  const getAvailableItems = () => {
    if (selectedType === 'account') return availableAccounts;
    if (selectedType === 'group') return availableGroups;
    return availableInstitutions;
  };

  const getItemLabel = (item) => {
    if (selectedType === 'account') return item.account_name;
    if (selectedType === 'group') return item.group_name;
    return item.name;
  };

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
                  {index === 0 && isPositive ? '' : (isPositive ? '+' : '-')}
                </span>
                <span className="formula-term">
                  {coeffDisplay && <span className="formula-coefficient">{coeffDisplay}&nbsp;</span>}
                  <span className={`formula-type-badge formula-type-badge-${item.type}`}>
                    {getTypeBadge(item.type)}
                  </span>
                  {editable ? (
                    <span className="formula-account">{itemName}</span>
                  ) : (
                    <span
                      className="formula-account formula-account-link"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(getItemNavigatePath(item.type, item.id));
                      }}
                      role="link"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          e.stopPropagation();
                          navigate(getItemNavigatePath(item.type, item.id));
                        }
                      }}
                    >
                      {itemName}
                    </span>
                  )}
                  <span className="formula-account-value">
                    ({formatCurrency(getItemBalance(item.type, item.id))})
                  </span>
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
            onChange={(e) => setSelectedType(e.target.value)}
            className="formula-type-select"
          >
            <option value="account">Account</option>
            <option value="group">Group</option>
            <option value="institution">Institution</option>
          </select>
          <select
            value=""
            onChange={(e) => handleAddFormulaItem(e.target.value, selectedType)}
            className="formula-account-select"
          >
            <option value="">Select {selectedType}...</option>
            {getAvailableItems().map(item => (
              <option key={item.id} value={item.id}>
                {getItemLabel(item)}
              </option>
            ))}
          </select>
        </div>
      )}

      {editable && availableAccounts.length === 0 && availableGroups.length === 0 && availableInstitutions.length === 0 && formulaItems.length === 0 && (
        <p className="form-hint">No accounts, groups, or institutions available. Create some first.</p>
      )}
    </div>
  );
}
