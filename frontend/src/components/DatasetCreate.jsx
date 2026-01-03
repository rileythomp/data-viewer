import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, FileSpreadsheet, FileJson } from 'lucide-react';
import { datasetsApi, uploadsApi } from '../services/api';

export default function DatasetCreate() {
    const navigate = useNavigate();
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [selectedUploadIds, setSelectedUploadIds] = useState([]);
    const [uploads, setUploads] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchUploads();
    }, []);

    const fetchUploads = async () => {
        try {
            // Fetch all uploads (up to 100 for now)
            const data = await uploadsApi.getAll(1, 100);
            setUploads(data.uploads || []);
        } catch (err) {
            setError('Failed to load uploads: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const toggleUpload = (uploadId) => {
        setSelectedUploadIds(prev => {
            if (prev.includes(uploadId)) {
                return prev.filter(id => id !== uploadId);
            }
            return [...prev, uploadId];
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!name.trim()) {
            setError('Name is required');
            return;
        }

        if (selectedUploadIds.length === 0) {
            setError('Please select at least one upload as a data source');
            return;
        }

        try {
            setSubmitting(true);
            setError('');
            const dataset = await datasetsApi.create(name.trim(), description.trim(), selectedUploadIds);
            navigate(`/datasets/${dataset.id}`);
        } catch (err) {
            setError(err.message);
            setSubmitting(false);
        }
    };

    const formatFileSize = (bytes) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    if (loading) {
        return <div className="loading">Loading uploads...</div>;
    }

    return (
        <div className="app">
            <div className="header">
                <div className="header-content">
                    <div className="dashboard-header-row">
                        <button onClick={() => navigate('/datasets')} className="btn-back">
                            <ArrowLeft size={18} />
                            <span>Back</span>
                        </button>
                    </div>
                    <h1>Create Dataset</h1>
                    <p className="dashboard-description">
                        A dataset combines data from one or more uploads into a single queryable table.
                    </p>
                </div>
            </div>

            {error && <div className="error">{error}</div>}

            <form onSubmit={handleSubmit} className="form-container">
                <div className="form-group">
                    <label htmlFor="name">Name *</label>
                    <input
                        type="text"
                        id="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="My Dataset"
                        disabled={submitting}
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="description">Description</label>
                    <textarea
                        id="description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Optional description..."
                        rows={3}
                        disabled={submitting}
                    />
                </div>

                <div className="form-group">
                    <label>Data Sources *</label>
                    <p className="form-help-text">
                        Select uploads to include in this dataset. All selected uploads must have matching column names.
                    </p>

                    {uploads.length === 0 ? (
                        <div className="empty-state-inline">
                            <p>No uploads available. <a href="/uploads/new">Upload some data first</a>.</p>
                        </div>
                    ) : (
                        <div className="source-selector">
                            {uploads.map((upload) => {
                                const isSelected = selectedUploadIds.includes(upload.id);
                                return (
                                    <div
                                        key={upload.id}
                                        className={`source-item ${isSelected ? 'selected' : ''}`}
                                        onClick={() => toggleUpload(upload.id)}
                                    >
                                        <div className="source-item-checkbox">
                                            {isSelected && <Check size={14} />}
                                        </div>
                                        <div className="source-item-icon">
                                            {upload.file_type === 'csv' ? (
                                                <FileSpreadsheet size={18} />
                                            ) : (
                                                <FileJson size={18} />
                                            )}
                                        </div>
                                        <div className="source-item-info">
                                            <span className="source-item-name">{upload.name}</span>
                                            <span className="source-item-meta">
                                                {upload.row_count.toLocaleString()} rows • {formatFileSize(upload.file_size)}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {selectedUploadIds.length > 0 && (
                    <div className="selection-summary">
                        {selectedUploadIds.length} upload{selectedUploadIds.length !== 1 ? 's' : ''} selected
                    </div>
                )}

                <div className="form-actions">
                    <button
                        type="button"
                        onClick={() => navigate('/datasets')}
                        className="btn-secondary"
                        disabled={submitting}
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        className="btn-primary"
                        disabled={submitting || selectedUploadIds.length === 0}
                    >
                        {submitting ? 'Creating...' : 'Create Dataset'}
                    </button>
                </div>
            </form>
        </div>
    );
}
