import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2, ChevronLeft, ChevronRight, Database, RefreshCw, FolderOpen, ChevronUp, ChevronDown, Loader } from 'lucide-react';
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
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const formatCellValue = (value) => {
        if (value === null || value === undefined) return '';
        if (typeof value === 'object') return JSON.stringify(value);
        return String(value);
    };

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
            <div className="header">
                <div className="header-content">
                    <div className="dashboard-header-row">
                        <button onClick={() => navigate('/datasets')} className="btn-back">
                            <ArrowLeft size={18} />
                            <span>Back</span>
                        </button>
                        <div className="detail-actions">
                            <button
                                onClick={handleSync}
                                className="btn-icon"
                                title="Sync Dataset"
                                disabled={syncing}
                            >
                                <RefreshCw size={18} className={syncing ? 'spinning' : ''} />
                            </button>
                            <button onClick={handleDelete} className="btn-icon btn-icon-danger" title="Delete">
                                <Trash2 size={18} />
                            </button>
                        </div>
                    </div>
                    <div className="upload-detail-title">
                        <Database size={24} className="dataset-icon" />
                        <h1>{dataset.name}</h1>
                    </div>
                    {dataset.description && (
                        <p className="dashboard-description">{dataset.description}</p>
                    )}
                </div>
            </div>

            <div className="upload-metadata">
                <div className="upload-metadata-item">
                    <span className="upload-metadata-label">Status</span>
                    <span className={getStatusClass(dataset.status)}>
                        {syncing ? 'Syncing' : dataset.status.charAt(0).toUpperCase() + dataset.status.slice(1)}
                    </span>
                </div>
                <div className="upload-metadata-item">
                    <span className="upload-metadata-label">Rows</span>
                    <span className="upload-metadata-value">{dataset.row_count.toLocaleString()}</span>
                </div>
                <div className="upload-metadata-item">
                    <span className="upload-metadata-label">Columns</span>
                    <span className="upload-metadata-value">{dataResponse?.columns?.length || 0}</span>
                </div>
                <div className="upload-metadata-item">
                    <span className="upload-metadata-label">Last Synced</span>
                    <span className="upload-metadata-value">{formatDate(dataset.last_synced_at)}</span>
                </div>
                <div className="upload-metadata-item">
                    <span className="upload-metadata-label">Created</span>
                    <span className="upload-metadata-value">{formatDate(dataset.created_at)}</span>
                </div>
            </div>

            {/* Folder Path Section */}
            <div className="dataset-sources-section">
                <div className="section-header">
                    <h2>
                        <FolderOpen size={18} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                        Data Source
                    </h2>
                </div>
                <div className="folder-path-display">
                    <code>{dataset.folder_path || 'No folder configured'}</code>
                </div>
                {dataset.last_commit_hash && (
                    <div className="commit-hash">
                        <span className="upload-metadata-label">Last Commit:</span>
                        <code>{dataset.last_commit_hash.substring(0, 8)}</code>
                    </div>
                )}
            </div>

            {dataset.error_message && (
                <div className="error">{dataset.error_message}</div>
            )}

            {error && <div className="error">{error}</div>}

            {/* Data Table Section */}
            <div className="upload-data-section">
                <div className="upload-data-header">
                    <h2>Data Preview</h2>
                    {syncing && (
                        <div className="sync-indicator">
                            <Loader size={16} className="spinning" />
                            <span>Syncing data...</span>
                        </div>
                    )}
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
                                            {row.map((cell, cellIdx) => (
                                                <td key={cellIdx}>{formatCellValue(cell)}</td>
                                            ))}
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
