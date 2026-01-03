import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, FileSpreadsheet, FileJson } from 'lucide-react';
import { uploadsApi } from '../services/api';

export default function UploadList() {
    const navigate = useNavigate();
    const [uploads, setUploads] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const pageSize = 20;

    const fetchUploads = async () => {
        try {
            setError('');
            const data = await uploadsApi.getAll(page, pageSize);
            setUploads(data.uploads || []);
            setTotal(data.total);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUploads();
    }, [page]);

    const formatFileSize = (bytes) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const totalPages = Math.ceil(total / pageSize);

    if (loading) {
        return <div className="loading">Loading uploads...</div>;
    }

    return (
        <div className="app">
            <div className="header">
                <div className="header-content">
                    <h1>Uploads</h1>
                </div>
                <div className="header-actions">
                    <button
                        onClick={() => navigate('/uploads/new')}
                        className="btn-primary"
                    >
                        + Upload Data
                    </button>
                </div>
            </div>

            {error && <div className="error">{error}</div>}

            {uploads.length === 0 ? (
                <p className="empty-state">No uploads yet. Upload your first CSV or JSON file to get started!</p>
            ) : (
                <>
                    <div className="dashboard-list">
                        {uploads.map((upload) => (
                            <div
                                key={upload.id}
                                className="dashboard-card"
                                onClick={() => navigate(`/uploads/${upload.id}`)}
                            >
                                <div className="dashboard-card-header">
                                    <div className="upload-card-title">
                                        {upload.file_type === 'csv' ? (
                                            <FileSpreadsheet size={20} className="upload-icon" />
                                        ) : (
                                            <FileJson size={20} className="upload-icon" />
                                        )}
                                        <h3 className="dashboard-card-name">{upload.name}</h3>
                                    </div>
                                    <span className="upload-card-type">
                                        {upload.file_type.toUpperCase()}
                                    </span>
                                </div>
                                {upload.description && (
                                    <p className="dashboard-card-description">{upload.description}</p>
                                )}
                                <div className="dashboard-card-meta">
                                    <span className="upload-card-info">
                                        {upload.row_count.toLocaleString()} rows • {formatFileSize(upload.file_size)}
                                    </span>
                                    <span className="upload-card-date">
                                        {formatDate(upload.created_at)}
                                    </span>
                                </div>
                            </div>
                        ))}
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
                                Page {page} of {totalPages}
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
            )}
        </div>
    );
}
