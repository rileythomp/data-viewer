import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { accountsApi, dashboardsApi } from '../services/api';
import AccountCard from './AccountCard';
import BalanceHistoryModal from './BalanceHistoryModal';
import DashboardChartCard from './DashboardChartCard';

export default function AccountList() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewingHistory, setViewingHistory] = useState(null);
  const [mainDashboard, setMainDashboard] = useState(null);
  const [expandedDashboardGroups, setExpandedDashboardGroups] = useState(new Set());

  const fetchData = async (isInitialLoad = false) => {
    try {
      setError('');
      const mainDashboardResponse = await dashboardsApi.getMain();
      setMainDashboard(mainDashboardResponse);

      // On initial load, expand all groups/institutions in main dashboard
      if (isInitialLoad && mainDashboardResponse) {
        const dashboardGroupIds = mainDashboardResponse.items
          ?.filter(item => item.type === 'group')
          .map(item => item.group.id) || [];
        const dashboardInstitutionIds = mainDashboardResponse.items
          ?.filter(item => item.type === 'institution')
          .map(item => `inst-${item.institution.id}`) || [];
        setExpandedDashboardGroups(new Set([...dashboardGroupIds, ...dashboardInstitutionIds]));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(true);
  }, []);

  const handleToggleDashboardExpand = (groupId) => {
    setExpandedDashboardGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const handleUpdateBalance = async (id, balance) => {
    await accountsApi.updateBalance(id, balance);
    await fetchData();
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="app">
      {error && <div className="error">{error}</div>}

      {mainDashboard && (
        <div className="main-dashboard-section">
          <div className="main-dashboard-header">
            <h2
              className="main-dashboard-title"
              onClick={() => navigate(`/dashboards/${mainDashboard.id}`)}
              title="View dashboard details"
            >
              {mainDashboard.name}
            </h2>
            <span className="main-dashboard-balance">
              {formatCurrency(mainDashboard.total_balance)}
            </span>
          </div>
          {mainDashboard.description && (
            <p className="main-dashboard-description">{mainDashboard.description}</p>
          )}
          {mainDashboard.items && mainDashboard.items.length > 0 && (
            <div className="main-dashboard-items">
              {mainDashboard.items.map((item) => {
                if (item.type === 'account') {
                  return (
                    <AccountCard
                      key={`main-account-${item.account.id}`}
                      account={item.account}
                      onUpdateBalance={handleUpdateBalance}
                      onViewHistory={setViewingHistory}
                    />
                  );
                } else if (item.type === 'group') {
                  return (
                    <div key={`main-group-${item.group.id}`} className="group-card">
                      <div
                        className="group-color-indicator"
                        style={{ backgroundColor: item.group.color }}
                      />
                      <div
                        className="group-card-header"
                        onClick={() => handleToggleDashboardExpand(item.group.id)}
                      >
                        <div className="group-header-left">
                          <button
                            className="btn-icon btn-expand"
                            aria-label={expandedDashboardGroups.has(item.group.id) ? 'Collapse group' : 'Expand group'}
                          >
                            {expandedDashboardGroups.has(item.group.id) ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                          </button>
                          <h3
                            className="group-name"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/groups/${item.group.id}`);
                            }}
                            title="View group details"
                          >
                            {item.group.group_name}
                          </h3>
                          <span className="group-account-count">
                            ({item.group.accounts?.length || 0} accounts)
                          </span>
                        </div>
                        <div className="group-header-right">
                          <span className="group-total">{formatCurrency(item.group.total_balance)}</span>
                        </div>
                      </div>
                      {expandedDashboardGroups.has(item.group.id) && (
                        <div className="group-content group-content-expanded">
                          {item.group.accounts && item.group.accounts.length > 0 ? (
                            <div className="group-accounts">
                              {item.group.accounts.map((account) => (
                                <AccountCard
                                  key={account.id}
                                  account={account}
                                  onUpdateBalance={handleUpdateBalance}
                                  onViewHistory={setViewingHistory}
                                />
                              ))}
                            </div>
                          ) : (
                            <p className="group-empty">No accounts in this group.</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                } else if (item.type === 'institution') {
                  const expandKey = `inst-${item.institution.id}`;
                  return (
                    <div key={`main-institution-${item.institution.id}`} className="group-card">
                      <div
                        className="group-color-indicator"
                        style={{ backgroundColor: item.institution.color }}
                      />
                      <div
                        className="group-card-header"
                        onClick={() => handleToggleDashboardExpand(expandKey)}
                      >
                        <div className="group-header-left">
                          <button
                            className="btn-icon btn-expand"
                            aria-label={expandedDashboardGroups.has(expandKey) ? 'Collapse institution' : 'Expand institution'}
                          >
                            {expandedDashboardGroups.has(expandKey) ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                          </button>
                          <h3
                            className="group-name"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/institutions/${item.institution.id}`);
                            }}
                            title="View institution details"
                          >
                            {item.institution.name}
                          </h3>
                          <span className="group-account-count">
                            ({item.institution.accounts?.length || 0} accounts)
                          </span>
                        </div>
                        <div className="group-header-right">
                          <span className="group-total">{formatCurrency(item.institution.total_balance)}</span>
                        </div>
                      </div>
                      {expandedDashboardGroups.has(expandKey) && (
                        <div className="group-content group-content-expanded">
                          {item.institution.accounts && item.institution.accounts.length > 0 ? (
                            <div className="group-accounts">
                              {item.institution.accounts.map((account) => (
                                <AccountCard
                                  key={account.id}
                                  account={account}
                                  onUpdateBalance={handleUpdateBalance}
                                  onViewHistory={setViewingHistory}
                                />
                              ))}
                            </div>
                          ) : (
                            <p className="group-empty">No accounts in this institution.</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                } else if (item.type === 'chart') {
                  return (
                    <DashboardChartCard
                      key={`main-chart-${item.chart.id}`}
                      chart={item.chart}
                    />
                  );
                }
                return null;
              })}
            </div>
          )}
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
