import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Database, AlertCircle, CheckCircle, Loader, Clock } from 'lucide-react';
import { datasetsApi } from '../services/api';

export default function DatasetList() {
    const navigate = useNavigate();
    const [datasets, setDatasets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const pageSize = 20;

    const fetchDatasets = async () => {
        try {
            setError('');
            const data = await datasetsApi.getAll(page, pageSize);
            setDatasets(data.datasets || []);
            setTotal(data.total);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDatasets();
    }, [page]);

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'ready':
                return <CheckCircle size={16} className="status-icon status-ready" />;
            case 'building':
                return <Loader size={16} className="status-icon status-building" />;
            case 'error':
                return <AlertCircle size={16} className="status-icon status-error" />;
            case 'pending':
            default:
                return <Clock size={16} className="status-icon status-pending" />;
        }
    };

    const getStatusClass = (status) => {
        return `dataset-status dataset-status-${status}`;
    };

    const totalPages = Math.ceil(total / pageSize);

    if (loading) {
        return <div className="loading">Loading datasets...</div>;
    }

    return (
        <div className="app">
            <div className="header">
                <div className="header-content">
                    <h1>Datasets</h1>
                </div>
                <div className="header-actions">
                    <button
                        onClick={() => navigate('/datasets/new')}
                        className="btn-primary"
                    >
                        + Create Dataset
                    </button>
                </div>
            </div>

            {error && <div className="error">{error}</div>}

            {datasets.length === 0 ? (
                <p className="empty-state">No datasets yet. Create your first dataset from uploaded data!</p>
            ) : (
                <>
                    <div className="dashboard-list">
                        {datasets.map((dataset) => (
                            <div
                                key={dataset.id}
                                className="dashboard-card"
                                onClick={() => navigate(`/datasets/${dataset.id}`)}
                            >
                                <div className="dashboard-card-header">
                                    <div className="upload-card-title">
                                        <Database size={20} className="dataset-icon" />
                                        <h3 className="dashboard-card-name">{dataset.name}</h3>
                                    </div>
                                    <span className={getStatusClass(dataset.status)}>
                                        {getStatusIcon(dataset.status)}
                                        {dataset.status.charAt(0).toUpperCase() + dataset.status.slice(1)}
                                    </span>
                                </div>
                                {dataset.description && (
                                    <p className="dashboard-card-description">{dataset.description}</p>
                                )}
                                {dataset.error_message && (
                                    <p className="dataset-error-message">{dataset.error_message}</p>
                                )}
                                <div className="dashboard-card-meta">
                                    <span className="upload-card-info">
                                        {dataset.row_count.toLocaleString()} rows
                                    </span>
                                    <span className="upload-card-date">
                                        {formatDate(dataset.created_at)}
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
