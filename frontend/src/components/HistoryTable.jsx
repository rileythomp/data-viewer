import { useState, useEffect } from 'react';
import { accountsApi } from '../services/api';

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

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

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
              <table className="history-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Account Name</th>
                    <th>Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((record) => (
                    <tr key={record.id}>
                      <td>{formatDate(record.recorded_at)}</td>
                      <td>{record.account_name_snapshot}</td>
                      <td>{formatCurrency(record.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
