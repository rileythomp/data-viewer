import { useState, useEffect } from 'react';
import { accountsApi } from '../services/api';
import BalanceHistoryTable from './BalanceHistoryTable';

export default function HistoryTable({ accountId, accountName, onClose }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const data = await accountsApi.getHistory(accountId);
        setHistory(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, [accountId]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <h3>Balance History</h3>
        <p className="account-name">{accountName}</p>

        {loading && <p>Loading...</p>}
        {error && <div className="error">{error}</div>}

        {!loading && !error && (
          <div className="history-table-container">
            {history.length === 0 ? (
              <p>No history records found.</p>
            ) : (
              <BalanceHistoryTable history={history} showAccountName={true} />
            )}
          </div>
        )}

        <div className="form-actions">
          <button type="button" onClick={onClose} className="btn-secondary">Close</button>
        </div>
      </div>
    </div>
  );
}
