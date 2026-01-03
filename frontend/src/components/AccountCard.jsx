import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { History, Archive, X } from 'lucide-react';

export default function AccountCard({ account, onUpdateBalance, onViewHistory, onArchive, onRemoveFromGroup }) {
  const navigate = useNavigate();
  const [isEditingBalance, setIsEditingBalance] = useState(false);
  const [balanceValue, setBalanceValue] = useState(account.current_balance.toString());
  const inputRef = useRef(null);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  useEffect(() => {
    if (isEditingBalance && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditingBalance]);

  const handleBalanceClick = (e) => {
    e.stopPropagation(); // Prevent card click from navigating
    if (account.is_calculated) return; // Can't edit calculated account balance
    setBalanceValue(account.current_balance.toString());
    setIsEditingBalance(true);
  };

  const handleBalanceSubmit = async () => {
    const balanceNum = parseFloat(balanceValue);
    if (!isNaN(balanceNum) && balanceNum !== account.current_balance) {
      try {
        await onUpdateBalance(account.id, balanceNum);
      } catch (err) {
        // Reset to original value on error
        setBalanceValue(account.current_balance.toString());
      }
    }
    setIsEditingBalance(false);
  };

  const handleBalanceKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleBalanceSubmit();
    } else if (e.key === 'Escape') {
      setBalanceValue(account.current_balance.toString());
      setIsEditingBalance(false);
    }
  };

  const handleBalanceBlur = () => {
    handleBalanceSubmit();
  };

  const handleCardClick = (e) => {
    // Don't navigate if clicking on interactive elements
    if (e.target.closest('button') || e.target.closest('input')) {
      return;
    }
    navigate(`/accounts/${account.id}`);
  };

  return (
    <div className="account-card account-card-compact account-card-clickable" onClick={handleCardClick}>
      <div className="account-header-compact">
        <h3 className="account-name">{account.account_name}</h3>
        <div className="account-right">
          {isEditingBalance ? (
            <input
              ref={inputRef}
              type="number"
              step="0.01"
              value={balanceValue}
              onChange={(e) => setBalanceValue(e.target.value)}
              onKeyDown={handleBalanceKeyDown}
              onBlur={handleBalanceBlur}
              className="balance-input balance-input-compact"
            />
          ) : (
            <p
              className={`account-balance account-balance-compact ${!account.is_calculated ? 'account-balance-clickable' : ''}`}
              onClick={handleBalanceClick}
              title={account.is_calculated ? 'Calculated balance' : 'Click to edit balance'}
            >
              {formatCurrency(account.current_balance)}
              {account.is_calculated && <span className="calculated-badge">calc</span>}
            </p>
          )}
          <div className="account-actions-icons">
            <button
              onClick={() => onViewHistory(account)}
              className="btn-icon"
              aria-label="View balance history"
              title="History"
            >
              <History size={16} />
            </button>
            {onRemoveFromGroup && (
              <button
                onClick={() => onRemoveFromGroup(account)}
                className="btn-icon btn-icon-danger"
                aria-label="Remove from group"
                title="Remove from group"
              >
                <X size={16} />
              </button>
            )}
            {onArchive && (
              <button
                onClick={() => onArchive(account)}
                className="btn-icon btn-icon-danger"
                aria-label="Archive account"
                title="Archive"
              >
                <Archive size={16} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
