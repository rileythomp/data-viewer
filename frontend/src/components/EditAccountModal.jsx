import { useState } from 'react';

export default function EditAccountModal({ account, onSubmit, onClose }) {
  const [name, setName] = useState(account.account_name);
  const [info, setInfo] = useState(account.account_info || '');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Account name is required');
      return;
    }

    try {
      await onSubmit(account.id, name.trim(), info);
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
          <div className="form-actions">
            <button type="submit" className="btn-primary">Save</button>
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}
