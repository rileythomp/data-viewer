import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2, ChevronLeft, ChevronRight, Database, RefreshCw, Plus, X, ChevronUp, ChevronDown, FileSpreadsheet, FileJson } from 'lucide-react';
import { datasetsApi, uploadsApi } from '../services/api';

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
    const [rebuilding, setRebuilding] = useState(false);
    const [showAddSource, setShowAddSource] = useState(false);
    const [availableUploads, setAvailableUploads] = useState([]);
    const [addingSource, setAddingSource] = useState(false);
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
        if (!dataset || dataset.status !== 'ready') return;

        try {
            setDataLoading(true);
            const data = await datasetsApi.getData(id, page, pageSize, sortColumn, sortDirection);
            setDataResponse(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setDataLoading(false);
        }
    };

    const fetchAvailableUploads = async () => {
        try {
            const data = await uploadsApi.getAll(1, 100);
            // Filter out uploads already in dataset
            const sourceIds = dataset?.sources?.map(s => s.source_id) || [];
            const available = (data.uploads || []).filter(u => !sourceIds.includes(u.id));
            setAvailableUploads(available);
        } catch (err) {
            console.error('Failed to fetch uploads:', err);
        }
    };

    useEffect(() => {
        fetchDataset();
    }, [id]);

    useEffect(() => {
        if (dataset && dataset.status === 'ready') {
            fetchData();
        }
    }, [dataset, page, sortColumn, sortDirection]);

    useEffect(() => {
        if (showAddSource) {
            fetchAvailableUploads();
        }
    }, [showAddSource, dataset]);

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

    const handleRebuild = async () => {
        try {
            setRebuilding(true);
            setError('');
            await datasetsApi.rebuild(id);
            await fetchDataset();
            setPage(1);
        } catch (err) {
            setError(err.message);
        } finally {
            setRebuilding(false);
        }
    };

    const handleAddSource = async (uploadId) => {
        try {
            setAddingSource(true);
            await datasetsApi.addSource(id, 'upload', uploadId);
            await fetchDataset();
            setShowAddSource(false);
            setPage(1);
        } catch (err) {
            setError(err.message);
        } finally {
            setAddingSource(false);
        }
    };

    const handleRemoveSource = async (sourceId) => {
        if (!window.confirm('Are you sure you want to remove this source? The dataset will be rebuilt.')) {
            return;
        }
        try {
            await datasetsApi.removeSource(id, sourceId);
            await fetchDataset();
            setPage(1);
        } catch (err) {
            setError(err.message);
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
                                onClick={handleRebuild}
                                className="btn-icon"
                                title="Rebuild Dataset"
                                disabled={rebuilding}
                            >
                                <RefreshCw size={18} className={rebuilding ? 'spinning' : ''} />
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
                        {dataset.status.charAt(0).toUpperCase() + dataset.status.slice(1)}
                    </span>
                </div>
                <div className="upload-metadata-item">
                    <span className="upload-metadata-label">Rows</span>
                    <span className="upload-metadata-value">{dataset.row_count.toLocaleString()}</span>
                </div>
                <div className="upload-metadata-item">
                    <span className="upload-metadata-label">Columns</span>
                    <span className="upload-metadata-value">{dataset.columns?.length || 0}</span>
                </div>
                <div className="upload-metadata-item">
                    <span className="upload-metadata-label">Sources</span>
                    <span className="upload-metadata-value">{dataset.sources?.length || 0}</span>
                </div>
                <div className="upload-metadata-item">
                    <span className="upload-metadata-label">Created</span>
                    <span className="upload-metadata-value">{formatDate(dataset.created_at)}</span>
                </div>
                <div className="upload-metadata-item">
                    <span className="upload-metadata-label">Updated</span>
                    <span className="upload-metadata-value">{formatDate(dataset.updated_at)}</span>
                </div>
            </div>

            {dataset.error_message && (
                <div className="error">{dataset.error_message}</div>
            )}

            {error && <div className="error">{error}</div>}

            {/* Sources Section */}
            <div className="dataset-sources-section">
                <div className="section-header">
                    <h2>Data Sources</h2>
                    <button
                        onClick={() => setShowAddSource(!showAddSource)}
                        className="btn-secondary btn-small"
                    >
                        {showAddSource ? <X size={14} /> : <Plus size={14} />}
                        {showAddSource ? 'Cancel' : 'Add Source'}
                    </button>
                </div>

                {showAddSource && (
                    <div className="add-source-panel">
                        {availableUploads.length === 0 ? (
                            <p className="empty-state-inline">No more uploads available to add.</p>
                        ) : (
                            <div className="available-sources-list">
                                {availableUploads.map((upload) => (
                                    <div
                                        key={upload.id}
                                        className="available-source-item"
                                        onClick={() => !addingSource && handleAddSource(upload.id)}
                                    >
                                        <div className="source-item-icon">
                                            {upload.file_type === 'csv' ? (
                                                <FileSpreadsheet size={16} />
                                            ) : (
                                                <FileJson size={16} />
                                            )}
                                        </div>
                                        <span className="source-item-name">{upload.name}</span>
                                        <span className="source-item-meta">{upload.row_count} rows</span>
                                        <Plus size={14} className="add-icon" />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {dataset.sources && dataset.sources.length > 0 ? (
                    <div className="sources-list">
                        {dataset.sources.map((source) => (
                            <div key={source.id} className="source-list-item">
                                <div
                                    className="source-item-clickable"
                                    onClick={() => navigate(`/uploads/${source.source_id}`)}
                                >
                                    <div className="source-item-icon">
                                        <FileSpreadsheet size={16} />
                                    </div>
                                    <span className="source-item-name">
                                        {source.source_name || `Upload #${source.source_id}`}
                                    </span>
                                    <span className="source-type-badge">{source.source_type}</span>
                                </div>
                                <button
                                    onClick={() => handleRemoveSource(source.id)}
                                    className="btn-icon-small btn-icon-danger"
                                    title="Remove source"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="empty-state-inline">No sources configured.</p>
                )}
            </div>

            {/* Data Table Section */}
            {dataset.status === 'ready' && (
                <div className="upload-data-section">
                    <div className="upload-data-header">
                        <h2>Data Preview</h2>
                    </div>

                    {dataLoading ? (
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
                    ) : (
                        <p className="empty-state-inline">No data available.</p>
                    )}
                </div>
            )}

            {dataset.status === 'building' && (
                <div className="status-message">
                    <RefreshCw size={20} className="spinning" />
                    <span>Building dataset...</span>
                </div>
            )}

            {dataset.status === 'pending' && (
                <div className="status-message">
                    <span>Dataset is pending. Add sources and rebuild to populate data.</span>
                </div>
            )}
        </div>
    );
}
