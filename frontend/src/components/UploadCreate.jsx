import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, X } from 'lucide-react';
import { uploadsApi } from '../services/api';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export default function UploadCreate() {
    const navigate = useNavigate();
    const fileInputRef = useRef(null);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [selectedFile, setSelectedFile] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [isDragging, setIsDragging] = useState(false);

    const validateAndSetFile = (file) => {
        // Validate file type
        const validTypes = ['text/csv', 'application/json'];
        const validExtensions = ['.csv', '.json'];
        const hasValidExtension = validExtensions.some(ext =>
            file.name.toLowerCase().endsWith(ext)
        );

        if (!validTypes.includes(file.type) && !hasValidExtension) {
            setError('Invalid file type. Please upload a CSV or JSON file.');
            return;
        }

        // Validate file size
        if (file.size > MAX_FILE_SIZE) {
            setError('File too large. Maximum size is 10MB.');
            return;
        }

        setSelectedFile(file);
        setError('');

        // Auto-fill name if empty
        if (!name) {
            const baseName = file.name.replace(/\.(csv|json)$/i, '');
            setName(baseName);
        }
    };

    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        validateAndSetFile(file);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDragEnter = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        const file = e.dataTransfer.files[0];
        if (file) {
            validateAndSetFile(file);
        }
    };

    const handleRemoveFile = () => {
        setSelectedFile(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!name.trim()) {
            setError('Name is required');
            return;
        }

        if (!selectedFile) {
            setError('Please select a file to upload');
            return;
        }

        setSubmitting(true);
        setError('');

        try {
            const formData = new FormData();
            formData.append('name', name.trim());
            formData.append('description', description.trim());
            formData.append('file', selectedFile);

            const upload = await uploadsApi.create(formData);
            navigate(`/uploads/${upload.id}`);
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

    return (
        <div className="app">
            <div className="detail-header">
                <button onClick={() => navigate('/uploads')} className="btn-back">
                    <ArrowLeft size={18} />
                    <span>Back</span>
                </button>
            </div>

            <div className="detail-main">
                <h1 className="detail-title">Upload Data</h1>

                {error && <div className="error">{error}</div>}

                <form onSubmit={handleSubmit} className="dashboard-form">
                    <div className="form-group">
                        <label htmlFor="name">Name *</label>
                        <input
                            id="name"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="My Data"
                            autoFocus
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
                        />
                    </div>

                    <div className="form-group">
                        <label>File *</label>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".csv,.json"
                            onChange={handleFileSelect}
                            className="file-input-hidden"
                            id="file-input"
                        />

                        {!selectedFile ? (
                            <label
                                htmlFor="file-input"
                                className={`file-upload-area ${isDragging ? 'dragging' : ''}`}
                                onDragOver={handleDragOver}
                                onDragEnter={handleDragEnter}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                            >
                                <Upload size={32} className="file-upload-icon" />
                                <span className="file-upload-text">
                                    Click to select or drag and drop
                                </span>
                                <span className="file-upload-hint">
                                    CSV or JSON files up to 10MB
                                </span>
                            </label>
                        ) : (
                            <div className="file-selected">
                                <div className="file-selected-info">
                                    <span className="file-selected-name">{selectedFile.name}</span>
                                    <span className="file-selected-size">
                                        {formatFileSize(selectedFile.size)}
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleRemoveFile}
                                    className="btn-icon"
                                    title="Remove file"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="form-actions">
                        <button
                            type="button"
                            onClick={() => navigate('/uploads')}
                            className="btn-secondary"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="btn-primary"
                            disabled={submitting || !selectedFile}
                        >
                            {submitting ? 'Uploading...' : 'Upload'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
