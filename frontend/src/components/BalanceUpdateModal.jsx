import { useState } from 'react';

export default function BalanceUpdateModal({ account, onSubmit, onClose }) {
  const [balance, setBalance] = useState(account.current_balance.toString());
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const balanceNum = parseFloat(balance);
    if (isNaN(balanceNum)) {
      setError('Please enter a valid number');
      return;
    }

    try {
      await onSubmit(account.id, balanceNum);
      onClose();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Update Balance</h3>
        <p className="account-name">{account.account_name}</p>
        {error && <div className="error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="newBalance">New Balance</label>
            <input
              id="newBalance"
              type="number"
              step="0.01"
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
              autoFocus
            />
          </div>
          <div className="form-actions">
            <button type="submit" className="btn-primary">Update</button>
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}
