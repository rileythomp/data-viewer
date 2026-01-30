import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { accountsApi, dashboardsApi } from '../services/api';
import BalanceHistoryModal from './BalanceHistoryModal';
import BalanceHistoryTable from './BalanceHistoryTable';
import SparklineChart from './SparklineChart';

export default function AccountList() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewingHistory, setViewingHistory] = useState(null);
  const [mainDashboard, setMainDashboard] = useState(null);
  const [dashboardHistory, setDashboardHistory] = useState([]);
  const [balanceSheetDashboard, setBalanceSheetDashboard] = useState(null);
  const [expandedItems, setExpandedItems] = useState(new Set());

  const fetchData = async (isInitialLoad = false) => {
    try {
      setError('');
      const mainDashboardResponse = await dashboardsApi.getMain();
      setMainDashboard(mainDashboardResponse);

      // Fetch dashboard history for sparkline
      if (mainDashboardResponse?.id) {
        try {
          const historyData = await dashboardsApi.getHistory(mainDashboardResponse.id);
          setDashboardHistory(historyData || []);
        } catch (err) {
          // History might not exist yet
        }
      }

      // Fetch all dashboards to find "Balance Sheet"
      try {
        const allDashboards = await dashboardsApi.getAll(1, 100);
        const balanceSheet = allDashboards.dashboards?.find(
          d => d.name.toLowerCase() === 'balance sheet'
        );
        if (balanceSheet) {
          // Fetch full details to get items with balances
          const fullBalanceSheet = await dashboardsApi.getById(balanceSheet.id);
          setBalanceSheetDashboard(fullBalanceSheet);
        }
      } catch (err) {
        // Balance sheet might not exist
      }

      // On initial load, expand all groups/institutions
      if (isInitialLoad && mainDashboardResponse) {
        const dashboardGroupIds = mainDashboardResponse.items
          ?.filter(item => item.type === 'group')
          .map(item => `group-${item.group.id}`) || [];
        const dashboardInstitutionIds = mainDashboardResponse.items
          ?.filter(item => item.type === 'institution')
          .map(item => `inst-${item.institution.id}`) || [];
        setExpandedItems(new Set([...dashboardGroupIds, ...dashboardInstitutionIds]));
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

  const handleToggleExpand = (itemId) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
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

  const formatCurrencyShort = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getFormattedDate = () => {
    return new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getBalanceChange = () => {
    if (!dashboardHistory || dashboardHistory.length < 2) return null;
    const current = dashboardHistory[0]?.balance || 0;
    const previous = dashboardHistory[1]?.balance || 0;
    return current - previous;
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  const balanceChange = getBalanceChange();

  return (
    <div className="overview-page">
      {error && <div className="error">{error}</div>}

      {/* Header */}
      <div className="overview-header">
        <h1>Overview</h1>
        <span className="header-date">{getFormattedDate()}</span>
      </div>

      {/* Net Worth Card */}
      {mainDashboard && (
        <div className="net-worth-card">
          <div className="net-worth-left">
            <div className="net-worth-main">
              <span className="net-worth-label">Net Worth</span>
              <div className="net-worth-value-row">
                <span className="net-worth-value">
                  {formatCurrency(mainDashboard.total_balance)}
                </span>
                {balanceChange !== null && (
                  <div className={`change-badge ${balanceChange < 0 ? 'change-badge-negative' : ''}`}>
                    {balanceChange >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                    <span className="change-text">
                      {balanceChange >= 0 ? '+' : ''}{formatCurrencyShort(balanceChange)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Balance Sheet Breakdown */}
            {balanceSheetDashboard && balanceSheetDashboard.items && (
              <div className="breakdown-row">
                {balanceSheetDashboard.items.map((item) => {
                  let name = '';
                  let balance = 0;
                  let colorClass = 'breakdown-value-green';
                  let itemKey = '';

                  if (item.type === 'group') {
                    name = item.group.group_name;
                    balance = item.group.total_balance;
                    itemKey = `group-${item.group.id}`;
                  } else if (item.type === 'institution') {
                    name = item.institution.name;
                    balance = item.institution.total_balance;
                    itemKey = `inst-${item.institution.id}`;
                  } else if (item.type === 'account') {
                    name = item.account.account_name;
                    balance = item.account.current_balance;
                    itemKey = `account-${item.account.id}`;
                  }

                  // Determine color based on name/type
                  const lowerName = name.toLowerCase();
                  if (lowerName.includes('debt') || lowerName.includes('liabilit') || balance < 0) {
                    colorClass = 'breakdown-value-red';
                  } else if (lowerName.includes('cash')) {
                    colorClass = 'breakdown-value-blue';
                  }

                  return (
                    <div key={`breakdown-${itemKey}`} className="breakdown-stat">
                      <span className="breakdown-label">{name}</span>
                      <span className={`breakdown-value ${colorClass}`}>
                        {formatCurrency(balance)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="net-worth-right">
            <SparklineChart history={dashboardHistory} height={106} />
          </div>
        </div>
      )}

      {/* Content Row: Accounts Panel + History Panel */}
      <div className="content-row">
        {/* Accounts Panel */}
        <div className="accounts-panel">
          <div className="accounts-panel-header">
            <h2 className="accounts-panel-title">Accounts</h2>
          </div>
          <div className="accounts-panel-content">
            {mainDashboard?.items?.map((item) => {
              if (item.type === 'institution') {
                const expandKey = `inst-${item.institution.id}`;
                const isExpanded = expandedItems.has(expandKey);

                return (
                  <div key={expandKey} className="panel-institution">
                    <div
                      className="panel-institution-header"
                      onClick={() => handleToggleExpand(expandKey)}
                      style={{ backgroundColor: `${item.institution.color || '#F59E0B'}15` }}
                    >
                      <div className="panel-institution-left">
                        <div
                          className="panel-color-bar"
                          style={{ backgroundColor: item.institution.color || '#F59E0B' }}
                        />
                        <div className="panel-institution-info">
                          <span
                            className="panel-institution-name"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/institutions/${item.institution.id}`);
                            }}
                          >
                            {item.institution.name}
                          </span>
                        </div>
                      </div>
                      <span className="panel-institution-total">
                        {formatCurrency(item.institution.total_balance)}
                      </span>
                    </div>
                    {isExpanded && item.institution.accounts?.map((account) => {
                      const isNegative = account.current_balance < 0;
                      return (
                        <div key={account.id} className="panel-account">
                          <div className="panel-account-left">
                            <span
                              className="panel-account-name"
                              onClick={() => navigate(`/accounts/${account.id}`)}
                            >
                              {account.account_name}
                            </span>
                          </div>
                          <span className={`panel-account-value ${isNegative ? 'panel-account-value-negative' : ''}`}>
                            {formatCurrency(account.current_balance)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              } else if (item.type === 'group') {
                const expandKey = `group-${item.group.id}`;
                const isExpanded = expandedItems.has(expandKey);

                return (
                  <div key={expandKey} className="panel-institution">
                    <div
                      className="panel-institution-header"
                      onClick={() => handleToggleExpand(expandKey)}
                      style={{ backgroundColor: `${item.group.color || '#8B5CF6'}15` }}
                    >
                      <div className="panel-institution-left">
                        <div
                          className="panel-color-bar"
                          style={{ backgroundColor: item.group.color || '#8B5CF6' }}
                        />
                        <div className="panel-institution-info">
                          <span
                            className="panel-institution-name"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/groups/${item.group.id}`);
                            }}
                          >
                            {item.group.group_name}
                          </span>
                        </div>
                      </div>
                      <span className="panel-institution-total">
                        {formatCurrency(item.group.total_balance)}
                      </span>
                    </div>
                    {isExpanded && item.group.accounts?.map((account) => {
                      const isNegative = account.current_balance < 0;
                      return (
                        <div key={account.id} className="panel-account">
                          <div className="panel-account-left">
                            <span
                              className="panel-account-name"
                              onClick={() => navigate(`/accounts/${account.id}`)}
                            >
                              {account.account_name}
                            </span>
                          </div>
                          <span className={`panel-account-value ${isNegative ? 'panel-account-value-negative' : ''}`}>
                            {formatCurrency(account.current_balance)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              } else if (item.type === 'account') {
                const isNegative = item.account.current_balance < 0;
                return (
                  <div key={`account-${item.account.id}`} className="panel-account" style={{ paddingLeft: 'var(--space-5)' }}>
                    <div className="panel-account-left">
                      <span
                        className="panel-account-name"
                        onClick={() => navigate(`/accounts/${item.account.id}`)}
                      >
                        {item.account.account_name}
                      </span>
                    </div>
                    <span className={`panel-account-value ${isNegative ? 'panel-account-value-negative' : ''}`}>
                      {formatCurrency(item.account.current_balance)}
                    </span>
                  </div>
                );
              }
              return null;
            })}
          </div>
        </div>

        {/* History Panel */}
        <div className="history-panel">
          <div className="history-panel-header">
            <div className="history-panel-header-left">
              <h2 className="history-panel-title">Net Worth History</h2>
              {dashboardHistory.length > 0 && (() => {
                // Calculate YTD change
                const currentYear = new Date().getFullYear();
                const currentBalance = dashboardHistory[0]?.balance || 0;
                const startOfYearEntry = dashboardHistory.find(entry => {
                  const date = new Date(entry.recorded_at);
                  return date.getFullYear() === currentYear && date.getMonth() === 0;
                });
                if (startOfYearEntry) {
                  const startBalance = startOfYearEntry.balance;
                  const percentChange = ((currentBalance - startBalance) / startBalance * 100).toFixed(0);
                  const isPositive = currentBalance >= startBalance;
                  return (
                    <span className="history-badge">
                      {isPositive ? '+' : ''}{percentChange}% YTD
                    </span>
                  );
                }
                return null;
              })()}
            </div>
          </div>
          <div className="history-panel-content">
            {dashboardHistory.length === 0 ? (
              <p className="empty-state-small" style={{ padding: 'var(--space-5)' }}>
                No history records yet.
              </p>
            ) : (
              <BalanceHistoryTable history={dashboardHistory} showAccountName={false} />
            )}
          </div>
        </div>
      </div>

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
