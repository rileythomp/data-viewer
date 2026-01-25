import { useState, useEffect } from 'react';
import { institutionsApi, accountsApi } from '../services/api';
import InstitutionForm from './InstitutionForm';
import InstitutionCard from './InstitutionCard';
import BalanceHistoryModal from './BalanceHistoryModal';

export default function InstitutionList() {
  const [institutions, setInstitutions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [expandedInstitutions, setExpandedInstitutions] = useState(new Set());
  const [viewingHistory, setViewingHistory] = useState(null);

  const fetchInstitutions = async (isInitialLoad = false) => {
    try {
      setError('');
      const data = await institutionsApi.getAll();
      setInstitutions(data || []);

      // On initial load, expand all institutions by default
      if (isInitialLoad) {
        const allInstitutionIds = (data || []).map((inst) => inst.id);
        setExpandedInstitutions(new Set(allInstitutionIds));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInstitutions(true);
  }, []);

  const handleToggleExpand = (institutionId) => {
    setExpandedInstitutions((prev) => {
      const next = new Set(prev);
      if (next.has(institutionId)) {
        next.delete(institutionId);
      } else {
        next.add(institutionId);
      }
      return next;
    });
  };

  const handleCreate = async (name, description, color, isCalculated, formula) => {
    await institutionsApi.create(name, description, color, isCalculated, formula);
    setShowForm(false);
    await fetchInstitutions();
  };

  const handleUpdateBalance = async (id, balance) => {
    await accountsApi.updateBalance(id, balance);
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
        <div className="list-container">
          {institutions.map((institution) => (
            <InstitutionCard
              key={institution.id}
              institution={institution}
              isExpanded={expandedInstitutions.has(institution.id)}
              onToggleExpand={handleToggleExpand}
              onUpdateBalance={handleUpdateBalance}
              onViewHistory={setViewingHistory}
            />
          ))}
        </div>
      )}

      {viewingHistory && (
        <BalanceHistoryModal
          entityType="account"
          entityId={viewingHistory.id}
          entityName={viewingHistory.account_name}
          onClose={() => setViewingHistory(null)}
        />
      )}
    </div>
  );
}
