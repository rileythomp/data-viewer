import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';

export default function DeleteConfirmModal({ itemName, itemType, isOpen, onConfirm, onCancel }) {
  const [confirmText, setConfirmText] = useState('');

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (confirmText === itemName) {
      onConfirm();
      setConfirmText('');
    }
  };

  const handleCancel = () => {
    setConfirmText('');
    onCancel();
  };

  return (
    <div className="modal-overlay" onClick={handleCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="delete-warning">
          <AlertTriangle size={24} />
          <span>This action cannot be undone</span>
        </div>
        <h3>Delete {itemType}</h3>
        <p className="delete-warning-text">
          You are about to permanently delete <strong>{itemName}</strong>.
          {itemType === 'account' && ' All balance history will also be deleted.'}
          {itemType === 'group' && ' Accounts in this group will become ungrouped.'}
        </p>
        <div className="form-group">
          <label>Type <strong>{itemName}</strong> to confirm:</label>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={itemName}
            className="delete-confirm-input"
            autoFocus
          />
        </div>
        <div className="form-actions">
          <button className="btn-secondary" onClick={handleCancel}>
            Cancel
          </button>
          <button
            className="btn-danger"
            onClick={handleConfirm}
            disabled={confirmText !== itemName}
          >
            Delete {itemType}
          </button>
        </div>
      </div>
    </div>
  );
}
