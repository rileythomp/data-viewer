import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FolderOpen } from 'lucide-react';
import { datasetsApi } from '../services/api';

export default function DatasetCreate() {
    const navigate = useNavigate();
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [folderPath, setFolderPath] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!name.trim()) {
            setError('Name is required');
            return;
        }

        if (!folderPath.trim()) {
            setError('Folder path is required');
            return;
        }

        try {
            setSubmitting(true);
            setError('');
            const dataset = await datasetsApi.create(name.trim(), description.trim(), folderPath.trim());
            navigate(`/datasets/${dataset.id}`);
        } catch (err) {
            setError(err.message);
            setSubmitting(false);
        }
    };

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
                        A dataset reads CSV files from a folder on disk. All CSV files in the folder will be combined into a single dataset.
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
                    <label htmlFor="folderPath">
                        <FolderOpen size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                        Folder Path *
                    </label>
                    <input
                        type="text"
                        id="folderPath"
                        value={folderPath}
                        onChange={(e) => setFolderPath(e.target.value)}
                        placeholder="/path/to/your/csv/folder"
                        disabled={submitting}
                    />
                    <p className="form-help-text">
                        Enter the absolute path to a folder containing CSV files. All CSV files in the folder will be combined.
                        Files must have matching column names. A git repository will be initialized to track changes.
                    </p>
                </div>

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
                        disabled={submitting || !folderPath.trim()}
                    >
                        {submitting ? 'Creating...' : 'Create Dataset'}
                    </button>
                </div>
            </form>
        </div>
    );
}
