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
import { chartsApi, accountsApi, groupsApi, datasetsApi } from '../services/api';
import InlineEditableText from './InlineEditableText';
import ChartLineView from './ChartLineView';
import DatasetPieChartView from './DatasetPieChartView';
import DatasetLineChartView from './DatasetLineChartView';
import MultiSelectDropdown from './MultiSelectDropdown';

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
  const [viewMode, setViewMode] = useState('pie');
  const [defaultChartType, setDefaultChartType] = useState('pie');
  const [historyData, setHistoryData] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Dataset edit state
  const [datasets, setDatasets] = useState([]);
  const [datasetColumns, setDatasetColumns] = useState([]);
  const [selectedDataset, setSelectedDataset] = useState(null);
  const [chartType, setChartType] = useState('line');
  const [xColumn, setXColumn] = useState('');
  const [yColumns, setYColumns] = useState([]);
  const [aggregationField, setAggregationField] = useState('');
  const [aggregationValue, setAggregationValue] = useState('');
  const [aggregationOperator, setAggregationOperator] = useState('SUM');

  const fetchChart = async () => {
    try {
      setError('');
      const data = await chartsApi.getById(id);
      setChart(data);

      // Extract data based on chart mode
      if (data.data_source === 'accounts_groups') {
        const accountIds = data.items
          ?.filter(item => item.type === 'account')
          .map(item => item.account.id) || [];
        const groupIds = data.items
          ?.filter(item => item.type === 'group')
          .map(item => item.group.id) || [];
        setSelectedAccounts(accountIds);
        setSelectedGroups(groupIds);
        // Set default chart type and use it as initial view mode
        const chartDefaultType = data.default_chart_type || 'pie';
        setDefaultChartType(chartDefaultType);
        setViewMode(chartDefaultType);
      } else if (data.data_source === 'dataset' && data.dataset_config) {
        // Initialize dataset edit state from chart config
        setSelectedDataset(data.dataset_config.dataset_id);
        setChartType(data.dataset_config.chart_type || 'line');
        setXColumn(data.dataset_config.x_column || '');
        setYColumns(data.dataset_config.y_columns || []);
        setAggregationField(data.dataset_config.aggregation_field || '');
        setAggregationValue(data.dataset_config.aggregation_value || '');
        setAggregationOperator(data.dataset_config.aggregation_operator || 'SUM');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchSelectionData = async () => {
    try {
      const [accountsData, groupsData, datasetsData] = await Promise.all([
        accountsApi.getAll(),
        groupsApi.getAll(),
        datasetsApi.getAll(),
      ]);
      setAllAccounts(accountsData || []);
      setAllGroups(groupsData || []);
      // Filter to only ready datasets
      setDatasets((datasetsData.datasets || []).filter(d => d.status === 'ready'));
    } catch (err) {
      // Silently fail - selection will just be empty
    }
  };

  const fetchHistory = async () => {
    try {
      setHistoryLoading(true);
      const data = await chartsApi.getHistory(id);
      setHistoryData(data);
    } catch (err) {
      // Silently fail - history will just show empty state
      setHistoryData({ series: [] });
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    fetchChart();
    fetchSelectionData();
    fetchHistory();
  }, [id]);

  // Fetch dataset columns when selectedDataset changes
  useEffect(() => {
    if (selectedDataset) {
      datasetsApi.getById(selectedDataset).then(data => {
        setDatasetColumns(data.columns || []);
      }).catch(() => {
        setDatasetColumns([]);
      });
    } else {
      setDatasetColumns([]);
    }
  }, [selectedDataset]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const handleSaveName = async (name) => {
    if (!name.trim()) throw new Error('Chart name is required');

    if (chart.data_source === 'dataset') {
      // For dataset charts, keep the dataset config when updating
      await chartsApi.update(id, name.trim(), chart.description, [], [], chart.dataset_config);
    } else {
      await chartsApi.update(id, name.trim(), chart.description, selectedAccounts, selectedGroups, null, defaultChartType);
    }
    await fetchChart();
  };

  const handleSaveDescription = async (description) => {
    if (chart.data_source === 'dataset') {
      await chartsApi.update(id, chart.name, description || '', [], [], chart.dataset_config);
    } else {
      await chartsApi.update(id, chart.name, description || '', selectedAccounts, selectedGroups, null, defaultChartType);
    }
    await fetchChart();
  };

  const handleAccountsChange = async (newSelection) => {
    setSelectedAccounts(newSelection);
    await chartsApi.update(id, chart.name, chart.description, newSelection, selectedGroups, null, defaultChartType);
    await fetchChart();
    await fetchHistory();
  };

  const handleGroupsChange = async (newSelection) => {
    setSelectedGroups(newSelection);
    await chartsApi.update(id, chart.name, chart.description, selectedAccounts, newSelection, null, defaultChartType);
    await fetchChart();
    await fetchHistory();
  };

  const handleDefaultChartTypeChange = async (newType) => {
    setDefaultChartType(newType);
    await chartsApi.update(id, chart.name, chart.description, selectedAccounts, selectedGroups, null, newType);
    await fetchChart();
  };

  // Dataset config update helpers
  const buildDatasetConfig = (overrides = {}) => {
    const config = {
      dataset_id: overrides.dataset_id ?? selectedDataset,
      chart_type: overrides.chart_type ?? chartType,
    };

    const type = config.chart_type;
    if (type === 'line') {
      config.x_column = overrides.x_column ?? xColumn;
      config.y_columns = overrides.y_columns ?? yColumns;
    } else {
      config.aggregation_field = overrides.aggregation_field ?? aggregationField;
      config.aggregation_value = overrides.aggregation_value ?? aggregationValue;
      config.aggregation_operator = overrides.aggregation_operator ?? aggregationOperator;
    }

    return config;
  };

  const handleDatasetChange = async (newDatasetId) => {
    setSelectedDataset(newDatasetId);
    // Reset columns when dataset changes
    setXColumn('');
    setYColumns([]);
    setAggregationField('');
    setAggregationValue('');
    // Note: Don't save yet - user needs to configure columns first
  };

  const handleChartTypeChange = async (newType) => {
    setChartType(newType);
    // Reset column selections when switching chart type
    setXColumn('');
    setYColumns([]);
    setAggregationField('');
    setAggregationValue('');
    // Note: Don't save yet - user needs to configure columns first
  };

  const handleXColumnChange = async (column) => {
    setXColumn(column);
    if (column && yColumns.length > 0) {
      const config = buildDatasetConfig({ x_column: column });
      await chartsApi.update(id, chart.name, chart.description, [], [], config);
      await fetchChart();
    }
  };

  const handleYColumnsChange = async (columns) => {
    setYColumns(columns);
    if (xColumn && columns.length > 0) {
      const config = buildDatasetConfig({ y_columns: columns });
      await chartsApi.update(id, chart.name, chart.description, [], [], config);
      await fetchChart();
    }
  };

  const handleAggregationFieldChange = async (field) => {
    setAggregationField(field);
    if (field && aggregationValue) {
      const config = buildDatasetConfig({ aggregation_field: field });
      await chartsApi.update(id, chart.name, chart.description, [], [], config);
      await fetchChart();
    }
  };

  const handleAggregationValueChange = async (value) => {
    setAggregationValue(value);
    if (aggregationField && value) {
      const config = buildDatasetConfig({ aggregation_value: value });
      await chartsApi.update(id, chart.name, chart.description, [], [], config);
      await fetchChart();
    }
  };

  const handleAggregationOperatorChange = async (op) => {
    setAggregationOperator(op);
    if (aggregationField && aggregationValue) {
      const config = buildDatasetConfig({ aggregation_operator: op });
      await chartsApi.update(id, chart.name, chart.description, [], [], config);
      await fetchChart();
    }
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

  const isDatasetChart = chart.data_source === 'dataset';

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

          {/* Show dataset info badge for dataset charts (hide in edit mode) */}
          {isDatasetChart && !isEditMode && (
            <div className="chart-info-badges">
              <span className="info-badge">Dataset: {chart.dataset_name}</span>
              <span className="info-badge">{chart.dataset_config?.chart_type === 'pie' ? 'Pie Chart' : 'Line Chart'}</span>
            </div>
          )}

          {!isDatasetChart && (
            <p className="total-balance">Total: {formatCurrency(chart.total_balance)}</p>
          )}
          {chart.description && !isEditMode && (
            <p className="dashboard-description">{chart.description}</p>
          )}
        </div>
      </div>

      {isEditMode && !isDatasetChart && (
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
            <MultiSelectDropdown
              items={allAccounts}
              selectedIds={selectedAccounts}
              onChange={handleAccountsChange}
              placeholder="Select accounts..."
              labelKey="account_name"
            />
          </div>

          <div className="form-group">
            <label>Groups</label>
            <MultiSelectDropdown
              items={allGroups}
              selectedIds={selectedGroups}
              onChange={handleGroupsChange}
              placeholder="Select groups..."
              labelKey="group_name"
              renderOption={(group) => (
                <>
                  <div
                    className="group-color-dot"
                    style={{ backgroundColor: group.color }}
                  />
                  <span>{group.group_name}</span>
                </>
              )}
              renderChip={(group) => (
                <>
                  <div
                    className="group-color-dot"
                    style={{ backgroundColor: group.color }}
                  />
                  <span>{group.group_name}</span>
                </>
              )}
            />
          </div>

          <div className="form-group">
            <label>Default View</label>
            <div className="toggle-group">
              <button
                type="button"
                className={`toggle-btn ${defaultChartType === 'pie' ? 'active' : ''}`}
                onClick={() => handleDefaultChartTypeChange('pie')}
              >
                Pie Chart
              </button>
              <button
                type="button"
                className={`toggle-btn ${defaultChartType === 'line' ? 'active' : ''}`}
                onClick={() => handleDefaultChartTypeChange('line')}
              >
                Line Chart
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dataset chart edit panel */}
      {isEditMode && isDatasetChart && (
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
            <label>Dataset</label>
            <select
              value={selectedDataset || ''}
              onChange={(e) => handleDatasetChange(e.target.value ? parseInt(e.target.value) : null)}
            >
              <option value="">Select a dataset...</option>
              {datasets.map((dataset) => (
                <option key={dataset.id} value={dataset.id}>
                  {dataset.name} ({dataset.row_count} rows)
                </option>
              ))}
            </select>
          </div>

          {selectedDataset && (
            <>
              <div className="form-group">
                <label>Chart Type</label>
                <div className="toggle-group">
                  <button
                    type="button"
                    className={`toggle-btn ${chartType === 'line' ? 'active' : ''}`}
                    onClick={() => handleChartTypeChange('line')}
                  >
                    Line Chart
                  </button>
                  <button
                    type="button"
                    className={`toggle-btn ${chartType === 'pie' ? 'active' : ''}`}
                    onClick={() => handleChartTypeChange('pie')}
                  >
                    Pie Chart
                  </button>
                </div>
              </div>

              {chartType === 'line' ? (
                <>
                  <div className="form-group">
                    <label>X-Axis Column</label>
                    <select value={xColumn} onChange={(e) => handleXColumnChange(e.target.value)}>
                      <option value="">Select column...</option>
                      {datasetColumns.map((col) => (
                        <option key={col.id} value={col.name}>{col.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Y-Axis Columns (select one or more)</label>
                    <div className="item-selection">
                      {datasetColumns.map((col) => (
                        <label key={col.id} className="item-checkbox">
                          <input
                            type="checkbox"
                            checked={yColumns.includes(col.name)}
                            onChange={() => {
                              const newColumns = yColumns.includes(col.name)
                                ? yColumns.filter(c => c !== col.name)
                                : [...yColumns, col.name];
                              handleYColumnsChange(newColumns);
                            }}
                          />
                          <span className="item-checkbox-name">{col.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="form-group">
                    <label>Group By Column</label>
                    <select value={aggregationField} onChange={(e) => handleAggregationFieldChange(e.target.value)}>
                      <option value="">Select column...</option>
                      {datasetColumns.map((col) => (
                        <option key={col.id} value={col.name}>{col.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Value Column</label>
                    <select value={aggregationValue} onChange={(e) => handleAggregationValueChange(e.target.value)}>
                      <option value="">Select column...</option>
                      {datasetColumns.map((col) => (
                        <option key={col.id} value={col.name}>{col.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Aggregation</label>
                    <select value={aggregationOperator} onChange={(e) => handleAggregationOperatorChange(e.target.value)}>
                      <option value="SUM">Sum</option>
                      <option value="COUNT">Count</option>
                    </select>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* Dataset-based chart rendering */}
      {isDatasetChart ? (
        <>
          {chart.dataset_config?.chart_type === 'pie' && chart.dataset_pie_data ? (
            <DatasetPieChartView data={chart.dataset_pie_data} />
          ) : chart.dataset_config?.chart_type === 'line' && chart.dataset_line_data ? (
            <DatasetLineChartView data={chart.dataset_line_data} />
          ) : (
            <p className="empty-state">No chart data available.</p>
          )}
        </>
      ) : (
        // Accounts/Groups chart rendering (existing)
        <>
          {chart.pie_data && chart.pie_data.length > 0 ? (
            <>
              <div className="chart-view-toggle">
                <div className="view-toggle">
                  <button
                    className={`view-toggle-btn ${viewMode === 'pie' ? 'active' : ''}`}
                    onClick={() => setViewMode('pie')}
                  >
                    Pie
                  </button>
                  <button
                    className={`view-toggle-btn ${viewMode === 'line' ? 'active' : ''}`}
                    onClick={() => setViewMode('line')}
                  >
                    Line
                  </button>
                </div>
              </div>

              {viewMode === 'pie' ? (
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
              ) : historyLoading ? (
                <div className="loading">Loading history data...</div>
              ) : historyData ? (
                <ChartLineView historyData={historyData} />
              ) : (
                <p className="empty-state">No history data available for line chart.</p>
              )}
            </>
          ) : (
            <p className="empty-state">No items in this chart yet. Click edit to add accounts and groups.</p>
          )}
        </>
      )}
    </div>
  );
}
