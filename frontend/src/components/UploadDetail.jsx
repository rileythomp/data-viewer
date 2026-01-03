import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2, ChevronLeft, ChevronRight, FileSpreadsheet, FileJson } from 'lucide-react';
import { uploadsApi } from '../services/api';

export default function UploadDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [upload, setUpload] = useState(null);
    const [dataResponse, setDataResponse] = useState(null);
    const [loading, setLoading] = useState(true);
    const [dataLoading, setDataLoading] = useState(false);
    const [error, setError] = useState('');
    const [page, setPage] = useState(1);
    const pageSize = 50;

    const fetchUpload = async () => {
        try {
            setError('');
            const data = await uploadsApi.getById(id);
            setUpload(data);
        } catch (err) {
            setError(err.message);
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

    useEffect(() => {
        fetchUpload();
    }, [id]);

    useEffect(() => {
        if (upload) {
            fetchData();
        }
    }, [upload, page]);

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
                            <button onClick={handleDelete} className="btn-icon btn-icon-danger" title="Delete">
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
                    </div>
                    {upload.description && (
                        <p className="dashboard-description">{upload.description}</p>
                    )}
                </div>
            </div>

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

            {error && <div className="error">{error}</div>}

            <div className="upload-data-section">
                <h2>Data Preview</h2>

                {dataLoading ? (
                    <div className="loading">Loading data...</div>
                ) : dataResponse && dataResponse.data && dataResponse.data.length > 0 ? (
                    <>
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
