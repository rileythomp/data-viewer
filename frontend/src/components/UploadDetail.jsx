import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2, ChevronLeft, ChevronRight, FileSpreadsheet, FileJson, Loader, AlertCircle, Database, Plus, X } from 'lucide-react';
import { uploadsApi, datasetsApi } from '../services/api';

export default function UploadDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [upload, setUpload] = useState(null);
    const [dataResponse, setDataResponse] = useState(null);
    const [loading, setLoading] = useState(true);
    const [dataLoading, setDataLoading] = useState(false);
    const [error, setError] = useState('');
    const [page, setPage] = useState(1);
    const [viewMode, setViewMode] = useState('table');
    const pageSize = 50;

    // Datasets state
    const [containingDatasets, setContainingDatasets] = useState([]);
    const [showAddToDataset, setShowAddToDataset] = useState(false);
    const [availableDatasets, setAvailableDatasets] = useState([]);
    const [addingToDataset, setAddingToDataset] = useState(false);
    const [datasetsLoading, setDatasetsLoading] = useState(false);

    const fetchUpload = async () => {
        try {
            setError('');
            const data = await uploadsApi.getById(id);
            setUpload(data);
            return data;
        } catch (err) {
            setError(err.message);
            return null;
        } finally {
            setLoading(false);
        }
    };

    const fetchData = async () => {
        try {
            setDataLoading(true);
            const data = await uploadsApi.getData(id, page, pageSize);
            setDataResponse(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setDataLoading(false);
        }
    };

    const fetchContainingDatasets = async () => {
        try {
            setDatasetsLoading(true);
            const data = await uploadsApi.getDatasets(id);
            setContainingDatasets(data.datasets || []);
        } catch (err) {
            console.error('Failed to fetch containing datasets:', err);
        } finally {
            setDatasetsLoading(false);
        }
    };

    const fetchAvailableDatasets = async () => {
        try {
            const data = await datasetsApi.getAll(1, 100);
            // Filter out datasets that already contain this upload
            const containingIds = containingDatasets.map(d => d.id);
            const available = (data.datasets || []).filter(d => !containingIds.includes(d.id));
            setAvailableDatasets(available);
        } catch (err) {
            console.error('Failed to fetch datasets:', err);
        }
    };

    const handleAddToDataset = async (datasetId) => {
        try {
            setAddingToDataset(true);
            await datasetsApi.addSource(datasetId, 'upload', parseInt(id));
            await fetchContainingDatasets();
            setShowAddToDataset(false);
        } catch (err) {
            setError(err.message);
        } finally {
            setAddingToDataset(false);
        }
    };

    const handleRemoveFromDataset = async (datasetId, sourceJunctionId) => {
        if (!window.confirm('Are you sure you want to remove this upload from the dataset? The dataset will be rebuilt.')) {
            return;
        }
        try {
            await datasetsApi.removeSource(datasetId, sourceJunctionId);
            await fetchContainingDatasets();
        } catch (err) {
            setError(err.message);
        }
    };

    useEffect(() => {
        fetchUpload();
    }, [id]);

    // Poll for status if upload is processing
    useEffect(() => {
        if (!upload || upload.status !== 'processing') return;

        const pollInterval = setInterval(async () => {
            const updated = await fetchUpload();
            if (updated && (updated.status === 'completed' || updated.status === 'failed')) {
                clearInterval(pollInterval);
            }
        }, 1000);

        return () => clearInterval(pollInterval);
    }, [upload?.status]);

    useEffect(() => {
        if (upload && upload.status === 'completed') {
            fetchData();
        }
    }, [upload, page]);

    // Fetch datasets containing this upload
    useEffect(() => {
        if (upload && upload.status === 'completed') {
            fetchContainingDatasets();
        }
    }, [upload]);

    // Fetch available datasets when panel is opened
    useEffect(() => {
        if (showAddToDataset) {
            fetchAvailableDatasets();
        }
    }, [showAddToDataset, containingDatasets]);

    const handleDelete = async () => {
        if (window.confirm(`Are you sure you want to delete "${upload.name}"?`)) {
            try {
                await uploadsApi.delete(id);
                navigate('/uploads');
            } catch (err) {
                setError(err.message);
            }
        }
    };

    const formatFileSize = (bytes) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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

    const formatAsCsv = (columns, data) => {
        const escapeCell = (value) => {
            if (value === null || value === undefined) return '';
            const str = String(value);
            // Escape quotes and wrap in quotes if contains comma, quote, or newline
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
        };

        const headerRow = columns.map(escapeCell).join(',');
        const dataRows = data.map(row => row.map(escapeCell).join(','));
        return [headerRow, ...dataRows].join('\n');
    };

    const formatAsJsonObjects = (columns, data) => {
        const objects = data.map(row => {
            const obj = {};
            columns.forEach((col, idx) => {
                obj[col] = row[idx];
            });
            return obj;
        });
        return JSON.stringify(objects, null, 2);
    };

    if (loading) {
        return <div className="loading">Loading upload...</div>;
    }

    if (error && !upload) {
        return (
            <div className="app">
                <div className="error">{error}</div>
                <button onClick={() => navigate('/uploads')} className="btn-secondary">
                    <ArrowLeft size={16} /> Back
                </button>
            </div>
        );
    }

    if (!upload) {
        return (
            <div className="app">
                <div className="error">Upload not found</div>
                <button onClick={() => navigate('/uploads')} className="btn-secondary">
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
                        <button onClick={() => navigate('/uploads')} className="btn-back">
                            <ArrowLeft size={18} />
                            <span>Back</span>
                        </button>
                        <div className="detail-actions">
                            <button onClick={handleDelete} className="btn-icon btn-icon-danger" title="Delete" disabled={upload.status === 'processing'}>
                                <Trash2 size={18} />
                            </button>
                        </div>
                    </div>
                    <div className="upload-detail-title">
                        {upload.file_type === 'csv' ? (
                            <FileSpreadsheet size={24} className="upload-icon" />
                        ) : (
                            <FileJson size={24} className="upload-icon" />
                        )}
                        <h1>{upload.name}</h1>
                        {upload.status === 'processing' && (
                            <span className="status-badge status-processing">
                                <Loader size={14} className="spin" /> Processing
                            </span>
                        )}
                        {upload.status === 'failed' && (
                            <span className="status-badge status-failed">
                                <AlertCircle size={14} /> Failed
                            </span>
                        )}
                    </div>
                    {upload.description && (
                        <p className="dashboard-description">{upload.description}</p>
                    )}
                </div>
            </div>

            {/* Show error message for failed uploads */}
            {upload.status === 'failed' && upload.error_message && (
                <div className="error upload-error">
                    <strong>Processing Error:</strong> {upload.error_message}
                </div>
            )}

            <div className="upload-metadata">
                <div className="upload-metadata-item">
                    <span className="upload-metadata-label">File</span>
                    <span className="upload-metadata-value">{upload.file_name}</span>
                </div>
                <div className="upload-metadata-item">
                    <span className="upload-metadata-label">Type</span>
                    <span className="upload-metadata-value">{upload.file_type.toUpperCase()}</span>
                </div>
                <div className="upload-metadata-item">
                    <span className="upload-metadata-label">Size</span>
                    <span className="upload-metadata-value">{formatFileSize(upload.file_size)}</span>
                </div>
                <div className="upload-metadata-item">
                    <span className="upload-metadata-label">Rows</span>
                    <span className="upload-metadata-value">{upload.row_count.toLocaleString()}</span>
                </div>
                <div className="upload-metadata-item">
                    <span className="upload-metadata-label">Columns</span>
                    <span className="upload-metadata-value">{upload.columns?.length || 0}</span>
                </div>
                <div className="upload-metadata-item">
                    <span className="upload-metadata-label">Uploaded</span>
                    <span className="upload-metadata-value">{formatDate(upload.created_at)}</span>
                </div>
            </div>

            {/* Datasets Section - only show for completed uploads */}
            {upload.status === 'completed' && (
                <div className="dataset-sources-section">
                    <div className="section-header">
                        <h2>Datasets</h2>
                        <button
                            onClick={() => setShowAddToDataset(!showAddToDataset)}
                            className="btn-secondary btn-small"
                        >
                            {showAddToDataset ? <X size={14} /> : <Plus size={14} />}
                            {showAddToDataset ? 'Cancel' : 'Add to Dataset'}
                        </button>
                    </div>

                    {showAddToDataset && (
                        <div className="add-source-panel">
                            {availableDatasets.length === 0 ? (
                                <p className="empty-state-inline">
                                    No datasets available. Create a dataset first.
                                </p>
                            ) : (
                                <div className="available-sources-list">
                                    {availableDatasets.map((dataset) => (
                                        <div
                                            key={dataset.id}
                                            className="available-source-item"
                                            onClick={() => !addingToDataset && handleAddToDataset(dataset.id)}
                                        >
                                            <div className="source-item-icon">
                                                <Database size={16} />
                                            </div>
                                            <span className="source-item-name">{dataset.name}</span>
                                            <span className="source-item-meta">
                                                {dataset.row_count} rows
                                            </span>
                                            <Plus size={14} className="add-icon" />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {datasetsLoading ? (
                        <div className="loading-inline">Loading datasets...</div>
                    ) : containingDatasets.length > 0 ? (
                        <div className="sources-list">
                            {containingDatasets.map((dataset) => (
                                <div key={dataset.id} className="source-list-item">
                                    <div
                                        className="source-item-clickable"
                                        onClick={() => navigate(`/datasets/${dataset.id}`)}
                                    >
                                        <div className="source-item-icon">
                                            <Database size={16} />
                                        </div>
                                        <span className="source-item-name">{dataset.name}</span>
                                        <span className="dataset-status-badge">
                                            {dataset.status}
                                        </span>
                                    </div>
                                    <button
                                        onClick={() => handleRemoveFromDataset(dataset.id, dataset.source_junction_id)}
                                        className="btn-icon-small btn-icon-danger"
                                        title="Remove from dataset"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="empty-state-inline">
                            This upload is not part of any dataset.
                        </p>
                    )}
                </div>
            )}

            {error && <div className="error">{error}</div>}

            <div className="upload-data-section">
                <div className="upload-data-header">
                    <h2>Data Preview</h2>
                    {upload.status === 'completed' && dataResponse && dataResponse.data && dataResponse.data.length > 0 && (
                        <div className="view-toggle">
                            <button
                                className={`view-toggle-btn ${viewMode === 'table' ? 'active' : ''}`}
                                onClick={() => setViewMode('table')}
                            >
                                Table
                            </button>
                            <button
                                className={`view-toggle-btn ${viewMode === 'raw' ? 'active' : ''}`}
                                onClick={() => setViewMode('raw')}
                            >
                                Raw Data
                            </button>
                        </div>
                    )}
                </div>

                {upload.status === 'processing' ? (
                    <div className="processing-placeholder">
                        <Loader size={32} className="spin" />
                        <p>Processing your file...</p>
                        <p className="processing-hint">This may take a moment for large files.</p>
                    </div>
                ) : upload.status === 'failed' ? (
                    <p className="empty-state">Data processing failed. Please try uploading again.</p>
                ) : dataLoading ? (
                    <div className="loading">Loading data...</div>
                ) : dataResponse && dataResponse.data && dataResponse.data.length > 0 ? (
                    <>
                        {viewMode === 'raw' ? (
                            <div className="upload-raw-data">
                                <pre>
                                    {upload.file_type === 'csv'
                                        ? formatAsCsv(dataResponse.columns, dataResponse.data)
                                        : formatAsJsonObjects(dataResponse.columns, dataResponse.data)}
                                </pre>
                            </div>
                        ) : (
                            <div className="upload-table-container">
                                <table className="upload-table">
                                    <thead>
                                        <tr>
                                            <th className="row-number-col">#</th>
                                            {dataResponse.columns?.map((col, idx) => (
                                                <th key={idx}>{col}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {dataResponse.data.map((row, rowIdx) => (
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
                        )}

                        {viewMode === 'table' && totalPages > 1 && (
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
                                    Showing {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, dataResponse.total)} of {dataResponse.total.toLocaleString()} rows
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
                    <p className="empty-state">No data available</p>
                )}
            </div>
        </div>
    );
}
