import { ArrowLeft, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Database, Download, FileText, GitBranch, Group, Loader, RefreshCw, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { datasetsApi } from '../services/api';

export default function DatasetDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [dataset, setDataset] = useState(null);
    const [dataResponse, setDataResponse] = useState(null);
    const [loading, setLoading] = useState(true);
    const [dataLoading, setDataLoading] = useState(false);
    const [error, setError] = useState('');
    const [page, setPage] = useState(1);
    const [sortColumn, setSortColumn] = useState('');
    const [sortDirection, setSortDirection] = useState('asc');
    const [syncing, setSyncing] = useState(false);
    const syncPollRef = useRef(null);
    const pageSize = 50;

    const fetchDataset = async () => {
        try {
            setError('');
            const data = await datasetsApi.getById(id);
            setDataset(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchData = async () => {
        try {
            setDataLoading(true);
            const data = await datasetsApi.getData(id, page, pageSize, sortColumn, sortDirection);
            setDataResponse(data);

            // Update syncing state from response
            if (data.syncing !== undefined) {
                setSyncing(data.syncing);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setDataLoading(false);
        }
    };

    // Poll for sync status when syncing
    useEffect(() => {
        if (syncing) {
            syncPollRef.current = setInterval(async () => {
                try {
                    const data = await datasetsApi.getData(id, page, pageSize, sortColumn, sortDirection);
                    setDataResponse(data);
                    if (!data.syncing) {
                        setSyncing(false);
                        // Refresh dataset info to get updated row count, etc.
                        const updated = await datasetsApi.getById(id);
                        setDataset(updated);
                    }
                } catch {
                    // Ignore poll errors
                }
            }, 2000);
        }

        return () => {
            if (syncPollRef.current) {
                clearInterval(syncPollRef.current);
            }
        };
    }, [syncing, id, page, pageSize, sortColumn, sortDirection]);

    useEffect(() => {
        fetchDataset();
    }, [id]);

    useEffect(() => {
        if (dataset) {
            fetchData();
        }
    }, [dataset?.id, page, sortColumn, sortDirection]);

    const handleDelete = async () => {
        if (window.confirm(`Are you sure you want to delete "${dataset.name}"? This will also delete all associated data.`)) {
            try {
                await datasetsApi.delete(id);
                navigate('/datasets');
            } catch (err) {
                setError(err.message);
            }
        }
    };

    const handleSync = async () => {
        try {
            setSyncing(true);
            setError('');
            await datasetsApi.sync(id);
            // The sync endpoint returns immediately but sync continues in background
            // Start polling
        } catch (err) {
            setError(err.message);
            setSyncing(false);
        }
    };

    const handleSort = (column) => {
        if (sortColumn === column) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortDirection('asc');
        }
        setPage(1);
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'Never';
        const date = new Date(dateString);
        const month = date.toLocaleDateString('en-US', { month: 'short' });
        const day = date.getDate();
        const year = date.getFullYear();
        const time = date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
        return `${month} ${day}, ${year} at ${time}`;
    };

    const formatCellValue = (value, columnName) => {
        if (value === null || value === undefined) return '';
        if (typeof value === 'object') return JSON.stringify(value);
        return String(value);
    };

    const isAmountColumn = (columnName) => {
        const lowerName = columnName?.toLowerCase() || '';
        return lowerName === 'amount' || lowerName.includes('amount') || lowerName === 'balance';
    };

    const isNegativeAmount = (value) => {
        if (typeof value === 'number') return value < 0;
        if (typeof value === 'string') {
            const cleaned = value.replace(/[$,]/g, '');
            return cleaned.startsWith('-') || (cleaned.startsWith('(') && cleaned.endsWith(')'));
        }
        return false;
    };

    const handleExportCSV = async () => {
        try {
            const blob = await datasetsApi.exportCSV(id);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${dataset.name.replace(/ /g, '_')}.csv`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (err) {
            setError(err.message);
        }
    };

    const handleCategorizeTransactions = async () => {
        
    }

    const getStatusClass = (status) => {
        return `dataset-status dataset-status-${status}`;
    };

    if (loading) {
        return <div className="loading">Loading dataset...</div>;
    }

    if (error && !dataset) {
        return (
            <div className="app">
                <div className="error">{error}</div>
                <button onClick={() => navigate('/datasets')} className="btn-secondary">
                    <ArrowLeft size={16} /> Back
                </button>
            </div>
        );
    }

    if (!dataset) {
        return (
            <div className="app">
                <div className="error">Dataset not found</div>
                <button onClick={() => navigate('/datasets')} className="btn-secondary">
                    <ArrowLeft size={16} /> Back
                </button>
            </div>
        );
    }

    const totalPages = dataResponse ? Math.ceil(dataResponse.total / pageSize) : 0;

    return (
        <div className="app">
            {/* Header Row */}
            <div className="dataset-detail-header">
                <div className="dataset-detail-header-left">
                    <button onClick={() => navigate('/datasets')} className="btn-outline-back">
                        <ArrowLeft size={16} />
                        <span>Back</span>
                    </button>
                    <div className="dataset-detail-title">
                        <Database size={20} className="dataset-icon" />
                        <h1>{dataset.name}</h1>
                    </div>
                </div>
                <div className="dataset-detail-actions">
                    <button
                        onClick={handleSync}
                        className="btn-outline"
                        disabled={syncing}
                    >
                        <RefreshCw size={16} className={syncing ? 'spinning' : ''} />
                        <span>Sync Now</span>
                    </button>
                    <button onClick={handleDelete} className="btn-danger">
                        <Trash2 size={16} />
                        <span>Delete</span>
                    </button>
                </div>
            </div>

            {dataset.description && (
                <p className="dashboard-description">{dataset.description}</p>
            )}

            {/* Dataset Info Section */}
            <div className="dataset-info-section">
                <div className="dataset-source-row">
                    <div className="dataset-source-path">
                        <FileText size={16} className="source-icon" />
                        <span className="source-label">Source:</span>
                        <span className="source-value">{dataset.folder_path || 'No folder configured'}</span>
                    </div>
                    {dataset.last_commit_hash && (
                        <div className="dataset-commit-badge">
                            <GitBranch size={14} />
                            <span className="commit-label">Last Commit:</span>
                            <code className="commit-hash">{dataset.last_commit_hash.substring(0, 8)}</code>
                        </div>
                    )}
                </div>
                <div className="dataset-stats-grid">
                    <div className="dataset-stat-card">
                        <span className="stat-label">Rows</span>
                        <span className="stat-value">{dataset.row_count.toLocaleString()}</span>
                    </div>
                    <div className="dataset-stat-card">
                        <span className="stat-label">Columns</span>
                        <span className="stat-value">{dataResponse?.columns?.length || 0}</span>
                    </div>
                    <div className="dataset-stat-card">
                        <span className="stat-label">Last Synced</span>
                        <span className="stat-value">{formatDate(dataset.last_synced_at)}</span>
                    </div>
                    <div className="dataset-stat-card">
                        <span className="stat-label">Created</span>
                        <span className="stat-value">{formatDate(dataset.created_at)}</span>
                    </div>
                </div>
            </div>

            {dataset.error_message && (
                <div className="error">{dataset.error_message}</div>
            )}

            {error && <div className="error">{error}</div>}

            {/* Data Table Section */}
            <div className="upload-data-section">
                <div className="upload-data-header">
                    <h2>Data Preview</h2>
                    <div className="data-header-actions">
                        {syncing && (
                            <div className="sync-indicator">
                                <Loader size={16} className="spinning" />
                                <span>Syncing data...</span>
                            </div>
                        )}
                        <button onClick={handleExportCSV} className="btn-outline-small">
                            <Download size={14} />
                            <span>Export CSV</span>
                        </button>
                        <button onClick={handleCategorizeTransactions} className="btn-outline-small">
                            <Group size={14} />
                            <span>Categorize</span>
                        </button>
                    </div>
                </div>

                {dataLoading && !dataResponse ? (
                    <div className="loading">Loading data...</div>
                ) : dataResponse && dataResponse.rows && dataResponse.rows.length > 0 ? (
                    <>
                        <div className="upload-table-container">
                            <table className="upload-table sortable-table">
                                <thead>
                                    <tr>
                                        <th className="row-number-col">#</th>
                                        {dataResponse.columns?.map((col, idx) => (
                                            <th
                                                key={idx}
                                                onClick={() => handleSort(col)}
                                                className="sortable-header"
                                            >
                                                <div className="header-content">
                                                    {col}
                                                    {sortColumn === col && (
                                                        <span className="sort-indicator">
                                                            {sortDirection === 'asc' ? (
                                                                <ChevronUp size={14} />
                                                            ) : (
                                                                <ChevronDown size={14} />
                                                            )}
                                                        </span>
                                                    )}
                                                </div>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {dataResponse.rows.map((row, rowIdx) => (
                                        <tr key={rowIdx}>
                                            <td className="row-number-col">
                                                {(page - 1) * pageSize + rowIdx + 1}
                                            </td>
                                            {row.map((cell, cellIdx) => {
                                                const columnName = dataResponse.columns?.[cellIdx];
                                                const isAmount = isAmountColumn(columnName);
                                                const isNegative = isAmount && isNegativeAmount(cell);
                                                return (
                                                    <td
                                                        key={cellIdx}
                                                        className={isNegative ? 'amount-negative' : (isAmount ? 'amount-cell' : '')}
                                                    >
                                                        {formatCellValue(cell, columnName)}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {totalPages > 1 && (
                            <div className="pagination">
                                <button
                                    className="btn-secondary pagination-btn"
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                >
                                    <ChevronLeft size={16} />
                                    Previous
                                </button>
                                <span className="pagination-info">
                                    Page {page} of {totalPages} ({dataResponse.total.toLocaleString()} rows)
                                </span>
                                <button
                                    className="btn-secondary pagination-btn"
                                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                    disabled={page === totalPages}
                                >
                                    Next
                                    <ChevronRight size={16} />
                                </button>
                            </div>
                        )}
                    </>
                ) : syncing ? (
                    <div className="status-message">
                        <Loader size={20} className="spinning" />
                        <span>Loading data from folder...</span>
                    </div>
                ) : (
                    <p className="empty-state-inline">No data available.</p>
                )}
            </div>

            {dataset.status === 'syncing' && !syncing && (
                <div className="status-message">
                    <RefreshCw size={20} className="spinning" />
                    <span>Syncing dataset...</span>
                </div>
            )}

            {dataset.status === 'pending' && (
                <div className="status-message">
                    <span>Dataset is pending initial sync.</span>
                </div>
            )}
        </div>
    );
}
