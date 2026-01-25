import { useState, useEffect } from 'react';
import { accountsApi, groupsApi, institutionsApi } from '../services/api';
import BalanceHistoryTable from './BalanceHistoryTable';
import BalanceHistoryChart from './BalanceHistoryChart';

export default function BalanceHistoryModal({ entityType, entityId, entityName, onClose }) {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [viewMode, setViewMode] = useState('table');

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                let data;
                if (entityType === 'account') {
                    data = await accountsApi.getHistory(entityId);
                } else if (entityType === 'institution') {
                    data = await institutionsApi.getHistory(entityId);
                } else {
                    data = await groupsApi.getHistory(entityId);
                }
                setHistory(data || []);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchHistory();
    }, [entityType, entityId]);

    // Show account name column only for account history (matches previous HistoryTable behavior)
    const showAccountName = entityType === 'account';

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
                <h3>Balance History</h3>
                <p className="account-name">{entityName}</p>

                {loading && <p>Loading...</p>}
                {error && <div className="error">{error}</div>}

                {!loading && !error && (
                    <>
                        {history.length > 0 && (
                            <div className="view-toggle" style={{ marginBottom: '1rem' }}>
                                <button
                                    className={`view-toggle-btn ${viewMode === 'table' ? 'active' : ''}`}
                                    onClick={() => setViewMode('table')}
                                >
                                    Table
                                </button>
                                <button
                                    className={`view-toggle-btn ${viewMode === 'chart' ? 'active' : ''}`}
                                    onClick={() => setViewMode('chart')}
                                >
                                    Chart
                                </button>
                            </div>
                        )}
                        <div className="history-table-container">
                            {history.length === 0 ? (
                                <p>No history records found.</p>
                            ) : viewMode === 'table' ? (
                                <BalanceHistoryTable history={history} showAccountName={showAccountName} />
                            ) : (
                                <BalanceHistoryChart history={history} />
                            )}
                        </div>
                    </>
                )}

                <div className="form-actions">
                    <button type="button" onClick={onClose} className="btn-secondary">Close</button>
                </div>
            </div>
        </div>
    );
}
