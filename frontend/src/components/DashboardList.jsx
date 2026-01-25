import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Star, History } from 'lucide-react';
import { dashboardsApi } from '../services/api';
import BalanceHistoryModal from './BalanceHistoryModal';

export default function DashboardList() {
  const navigate = useNavigate();
  const [dashboards, setDashboards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [historyDashboard, setHistoryDashboard] = useState(null);
  const pageSize = 20;

  const fetchDashboards = async () => {
    try {
      setError('');
      const data = await dashboardsApi.getAll(page, pageSize);
      setDashboards(data.dashboards || []);
      setTotal(data.total);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboards();
  }, [page]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const handleToggleMain = async (id, isMain) => {
    try {
      setError('');
      await dashboardsApi.setMain(id, isMain);
      // Refresh the list to reflect the change
      await fetchDashboards();
    } catch (err) {
      setError(err.message);
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  if (loading) {
    return <div className="loading">Loading dashboards...</div>;
  }

  return (
    <div className="app">
      <div className="header">
        <div className="header-content">
          <h1>Dashboards</h1>
        </div>
        <div className="header-actions">
          <button
            onClick={() => navigate('/dashboards/new')}
            className="btn-primary"
          >
            + Create Dashboard
          </button>
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      {dashboards.length === 0 ? (
        <p className="empty-state">No dashboards yet. Create your first one to get started!</p>
      ) : (
        <>
          <div className="dashboard-list">
            {dashboards.map((dashboard) => (
              <div
                key={dashboard.id}
                className="dashboard-card"
                onClick={() => navigate(`/dashboards/${dashboard.id}`)}
              >
                <div className="dashboard-card-header">
                  <h3 className="dashboard-card-name">{dashboard.name}</h3>
                  <div className="dashboard-card-actions">
                    <button
                      className="btn-icon-small"
                      onClick={(e) => {
                        e.stopPropagation();
                        setHistoryDashboard(dashboard);
                      }}
                      aria-label="View history"
                      title="History"
                    >
                      <History size={16} />
                    </button>
                    <button
                      className={`btn-icon-small star-button ${dashboard.is_main ? 'starred' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleMain(dashboard.id, !dashboard.is_main);
                      }}
                      aria-label={dashboard.is_main ? 'Unpin as main dashboard' : 'Pin as main dashboard'}
                      title={dashboard.is_main ? 'Unpin as main dashboard' : 'Pin as main dashboard'}
                    >
                      <Star size={18} fill={dashboard.is_main ? 'currentColor' : 'none'} />
                    </button>
                    <span className="dashboard-card-balance">
                      {formatCurrency(dashboard.total_balance)}
                    </span>
                  </div>
                </div>
                {dashboard.description && (
                  <p className="dashboard-card-description">{dashboard.description}</p>
                )}
                <div className="dashboard-card-meta">
                  <span className="dashboard-card-count">
                    {dashboard.items?.length || 0} items
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

      {historyDashboard && (
        <BalanceHistoryModal
          entityType="dashboard"
          entityId={historyDashboard.id}
          entityName={historyDashboard.name}
          onClose={() => setHistoryDashboard(null)}
        />
      )}
    </div>
  );
}
