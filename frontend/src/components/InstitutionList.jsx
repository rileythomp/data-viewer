import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { institutionsApi } from '../services/api';
import InstitutionForm from './InstitutionForm';

export default function InstitutionList() {
  const navigate = useNavigate();
  const [institutions, setInstitutions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);

  const fetchInstitutions = async () => {
    try {
      setError('');
      const data = await institutionsApi.getAll();
      setInstitutions(data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInstitutions();
  }, []);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const handleCreate = async (name, description, color, isCalculated, formula) => {
    await institutionsApi.create(name, description, color, isCalculated, formula);
    setShowForm(false);
    await fetchInstitutions();
  };

  if (loading) {
    return <div className="loading">Loading institutions...</div>;
  }

  return (
    <div className="app">
      <div className="header">
        <div className="header-content">
          <h1>Institutions</h1>
        </div>
        <div className="header-actions">
          <button
            onClick={() => setShowForm(true)}
            className="btn-primary"
          >
            + Create Institution
          </button>
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <InstitutionForm
              onSubmit={handleCreate}
              onCancel={() => setShowForm(false)}
            />
          </div>
        </div>
      )}

      {institutions.length === 0 ? (
        <p className="empty-state">No institutions yet. Create your first one to get started!</p>
      ) : (
        <div className="dashboard-list">
          {institutions.map((institution) => (
            <div
              key={institution.id}
              className="dashboard-card"
              onClick={() => navigate(`/institutions/${institution.id}`)}
            >
              <div className="dashboard-card-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div
                    className="group-color-dot"
                    style={{ backgroundColor: institution.color }}
                  />
                  <h3 className="dashboard-card-name">{institution.name}</h3>
                </div>
                <span className="dashboard-card-balance">
                  {formatCurrency(institution.total_balance || 0)}
                </span>
              </div>
              {institution.description && (
                <p className="dashboard-card-description">{institution.description}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
