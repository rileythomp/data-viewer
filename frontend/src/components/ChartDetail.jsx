import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Pencil, Trash2, Check } from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { chartsApi, accountsApi, groupsApi } from '../services/api';
import InlineEditableText from './InlineEditableText';

const RADIAN = Math.PI / 180;
const MIN_LABEL_PERCENT = 0.05; // 5% minimum to show label

const renderCustomizedLabel = ({
  cx,
  cy,
  midAngle,
  outerRadius,
  percent,
  name,
}) => {
  if (percent < MIN_LABEL_PERCENT) {
    return null;
  }

  const radius = outerRadius + 25;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  const textAnchor = x > cx ? 'start' : 'end';

  return (
    <text
      x={x}
      y={y}
      fill="var(--color-text-primary)"
      textAnchor={textAnchor}
      dominantBaseline="central"
      fontSize={12}
    >
      {`${name}: ${(percent * 100).toFixed(1)}%`}
    </text>
  );
};

export default function ChartDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [chart, setChart] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);
  const [allAccounts, setAllAccounts] = useState([]);
  const [allGroups, setAllGroups] = useState([]);
  const [selectedAccounts, setSelectedAccounts] = useState([]);
  const [selectedGroups, setSelectedGroups] = useState([]);

  const fetchChart = async () => {
    try {
      setError('');
      const data = await chartsApi.getById(id);
      setChart(data);

      // Extract current account and group IDs from items
      const accountIds = data.items
        ?.filter(item => item.type === 'account')
        .map(item => item.account.id) || [];
      const groupIds = data.items
        ?.filter(item => item.type === 'group')
        .map(item => item.group.id) || [];
      setSelectedAccounts(accountIds);
      setSelectedGroups(groupIds);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchSelectionData = async () => {
    try {
      const [accountsData, groupsData] = await Promise.all([
        accountsApi.getAll(),
        groupsApi.getAll(),
      ]);
      setAllAccounts(accountsData || []);
      setAllGroups(groupsData || []);
    } catch (err) {
      // Silently fail - selection will just be empty
    }
  };

  useEffect(() => {
    fetchChart();
    fetchSelectionData();
  }, [id]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const handleSaveName = async (name) => {
    if (!name.trim()) throw new Error('Chart name is required');
    await chartsApi.update(id, name.trim(), chart.description, selectedAccounts, selectedGroups);
    await fetchChart();
  };

  const handleSaveDescription = async (description) => {
    await chartsApi.update(id, chart.name, description || '', selectedAccounts, selectedGroups);
    await fetchChart();
  };

  const handleAccountToggle = async (accountId) => {
    const newSelection = selectedAccounts.includes(accountId)
      ? selectedAccounts.filter(aid => aid !== accountId)
      : [...selectedAccounts, accountId];
    setSelectedAccounts(newSelection);
    await chartsApi.update(id, chart.name, chart.description, newSelection, selectedGroups);
    await fetchChart();
  };

  const handleGroupToggle = async (groupId) => {
    const newSelection = selectedGroups.includes(groupId)
      ? selectedGroups.filter(gid => gid !== groupId)
      : [...selectedGroups, groupId];
    setSelectedGroups(newSelection);
    await chartsApi.update(id, chart.name, chart.description, selectedAccounts, newSelection);
    await fetchChart();
  };

  const handleDelete = async () => {
    if (window.confirm(`Are you sure you want to delete "${chart.name}"?`)) {
      await chartsApi.delete(id);
      navigate('/charts');
    }
  };

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="chart-tooltip">
          <p className="chart-tooltip-date">{data.name}</p>
          <p className="chart-tooltip-balance">{formatCurrency(data.value)}</p>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return <div className="loading">Loading chart...</div>;
  }

  if (error) {
    return (
      <div className="app">
        <div className="error">{error}</div>
        <button onClick={() => navigate('/charts')} className="btn-secondary">
          <ArrowLeft size={16} /> Back
        </button>
      </div>
    );
  }

  if (!chart) {
    return (
      <div className="app">
        <div className="error">Chart not found</div>
        <button onClick={() => navigate('/charts')} className="btn-secondary">
          <ArrowLeft size={16} /> Back
        </button>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="header">
        <div className="header-content">
          <div className="dashboard-header-row">
            <button onClick={() => navigate('/charts')} className="btn-back">
              <ArrowLeft size={18} />
              <span>Back</span>
            </button>
            <div className="detail-actions">
              <button
                onClick={() => setIsEditMode(!isEditMode)}
                className={`btn-icon ${isEditMode ? 'btn-icon-active' : ''}`}
                title={isEditMode ? "Done editing" : "Edit"}
              >
                {isEditMode ? <Check size={18} /> : <Pencil size={18} />}
              </button>
              <button onClick={handleDelete} className="btn-icon btn-icon-danger" title="Delete">
                <Trash2 size={18} />
              </button>
            </div>
          </div>
          {isEditMode ? (
            <InlineEditableText
              value={chart.name}
              onSave={handleSaveName}
              type="input"
              className="dashboard-title-input"
              required
              autoFocus
            />
          ) : (
            <h1>{chart.name}</h1>
          )}
          <p className="total-balance">Total: {formatCurrency(chart.total_balance)}</p>
          {chart.description && !isEditMode && (
            <p className="dashboard-description">{chart.description}</p>
          )}
        </div>
      </div>

      {isEditMode && (
        <div className="dashboard-edit-panel">
          <div className="form-group">
            <label>Description</label>
            <InlineEditableText
              value={chart.description || ''}
              onSave={handleSaveDescription}
              type="textarea"
              className="detail-info-textarea"
              placeholder="Add description..."
              rows={3}
            />
          </div>

          <div className="form-group">
            <label>Accounts</label>
            <div className="item-selection">
              {allAccounts.map((account) => (
                <label key={account.id} className="item-checkbox">
                  <input
                    type="checkbox"
                    checked={selectedAccounts.includes(account.id)}
                    onChange={() => handleAccountToggle(account.id)}
                  />
                  <span className="item-checkbox-name">{account.account_name}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Groups</label>
            <div className="item-selection">
              {allGroups.map((group) => (
                <label key={group.id} className="item-checkbox">
                  <input
                    type="checkbox"
                    checked={selectedGroups.includes(group.id)}
                    onChange={() => handleGroupToggle(group.id)}
                  />
                  <div
                    className="group-color-dot"
                    style={{ backgroundColor: group.color }}
                  />
                  <span className="item-checkbox-name">{group.group_name}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {chart.pie_data && chart.pie_data.length > 0 ? (
        <div className="chart-container">
          <ResponsiveContainer width="100%" height={400}>
            <PieChart>
              <Pie
                data={chart.pie_data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={120}
                label={renderCustomizedLabel}
                labelLine={(props) => {
                  if (props.percent < MIN_LABEL_PERCENT) return null;
                  return (
                    <path
                      d={`M${props.points[0].x},${props.points[0].y}L${props.points[1].x},${props.points[1].y}`}
                      stroke="var(--color-text-muted)"
                      fill="none"
                    />
                  );
                }}
              >
                {chart.pie_data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ paddingTop: 20 }}
                formatter={(value) => <span style={{ marginRight: 16 }}>{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="empty-state">No items in this chart yet. Click edit to add accounts and groups.</p>
      )}
    </div>
  );
}
