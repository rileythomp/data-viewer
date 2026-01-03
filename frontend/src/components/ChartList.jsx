import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { chartsApi } from '../services/api';

export default function ChartList() {
  const navigate = useNavigate();
  const [charts, setCharts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 20;

  const fetchCharts = async () => {
    try {
      setError('');
      const data = await chartsApi.getAll(page, pageSize);
      setCharts(data.charts || []);
      setTotal(data.total);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCharts();
  }, [page]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const totalPages = Math.ceil(total / pageSize);

  if (loading) {
    return <div className="loading">Loading charts...</div>;
  }

  return (
    <div className="app">
      <div className="header">
        <div className="header-content">
          <h1>Charts</h1>
        </div>
        <div className="header-actions">
          <button
            onClick={() => navigate('/charts/new')}
            className="btn-primary"
          >
            + Create Chart
          </button>
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      {charts.length === 0 ? (
        <p className="empty-state">No charts yet. Create your first one to visualize your balances!</p>
      ) : (
        <>
          <div className="dashboard-list">
            {charts.map((chart) => (
              <div
                key={chart.id}
                className="dashboard-card"
                onClick={() => navigate(`/charts/${chart.id}`)}
              >
                <div className="dashboard-card-header">
                  <h3 className="dashboard-card-name">{chart.name}</h3>
                  <span className="dashboard-card-balance">
                    {formatCurrency(chart.total_balance)}
                  </span>
                </div>
                {chart.description && (
                  <p className="dashboard-card-description">{chart.description}</p>
                )}
                <div className="dashboard-card-meta">
                  <span className="dashboard-card-count">
                    {chart.items?.length || 0} items
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
