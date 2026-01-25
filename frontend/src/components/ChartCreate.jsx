import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { chartsApi, accountsApi, groupsApi, datasetsApi } from '../services/api';
import MultiSelectDropdown from './MultiSelectDropdown';

export default function ChartCreate() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  // Data source mode
  const [dataSource, setDataSource] = useState('accounts_groups'); // or 'dataset'

  // Accounts/Groups mode state (existing)
  const [selectedAccounts, setSelectedAccounts] = useState([]);
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [groups, setGroups] = useState([]);
  const [defaultChartType, setDefaultChartType] = useState('pie'); // Default view type for accounts/groups charts

  // Dataset mode state (new)
  const [datasets, setDatasets] = useState([]);
  const [selectedDataset, setSelectedDataset] = useState(null);
  const [datasetColumns, setDatasetColumns] = useState([]);
  const [chartType, setChartType] = useState('line');

  // Line chart config
  const [xColumn, setXColumn] = useState('');
  const [yColumns, setYColumns] = useState([]);

  // Pie chart config
  const [aggregationField, setAggregationField] = useState('');
  const [aggregationValue, setAggregationValue] = useState('');
  const [aggregationOperator, setAggregationOperator] = useState('SUM');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [accountsData, groupsData, datasetsData] = await Promise.all([
          accountsApi.getAll(),
          groupsApi.getAll(),
          datasetsApi.getAll(),
        ]);
        setAccounts(accountsData || []);
        setGroups(groupsData || []);
        // Filter to only ready datasets
        setDatasets((datasetsData.datasets || []).filter(d => d.status === 'ready'));
      } catch (err) {
        setError('Failed to load data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Load dataset columns when dataset is selected
  useEffect(() => {
    if (selectedDataset) {
      // Fetch full dataset details to get columns
      datasetsApi.getById(selectedDataset).then(data => {
        setDatasetColumns(data.columns || []);
      }).catch(() => {
        setDatasetColumns([]);
      });
    } else {
      setDatasetColumns([]);
    }
    // Reset column selections when dataset changes
    setXColumn('');
    setYColumns([]);
    setAggregationField('');
    setAggregationValue('');
  }, [selectedDataset]);

  const handleAccountToggle = (accountId) => {
    setSelectedAccounts(prev =>
      prev.includes(accountId)
        ? prev.filter(id => id !== accountId)
        : [...prev, accountId]
    );
  };

  const handleGroupToggle = (groupId) => {
    setSelectedGroups(prev =>
      prev.includes(groupId)
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    );
  };

  const handleYColumnToggle = (columnName) => {
    setYColumns(prev =>
      prev.includes(columnName)
        ? prev.filter(c => c !== columnName)
        : [...prev, columnName]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Chart name is required');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      let chart;

      if (dataSource === 'dataset') {
        // Validate dataset configuration
        if (!selectedDataset) {
          setError('Please select a dataset');
          setSubmitting(false);
          return;
        }

        const datasetConfig = {
          dataset_id: selectedDataset,
          chart_type: chartType,
        };

        if (chartType === 'line') {
          if (!xColumn || yColumns.length === 0) {
            setError('Line charts require X-axis column and at least one Y-axis column');
            setSubmitting(false);
            return;
          }
          datasetConfig.x_column = xColumn;
          datasetConfig.y_columns = yColumns;
        } else {
          if (!aggregationField || !aggregationValue) {
            setError('Pie charts require Group By and Value columns');
            setSubmitting(false);
            return;
          }
          datasetConfig.aggregation_field = aggregationField;
          datasetConfig.aggregation_value = aggregationValue;
          datasetConfig.aggregation_operator = aggregationOperator;
        }

        chart = await chartsApi.create(name.trim(), description.trim(), [], [], datasetConfig);
      } else {
        chart = await chartsApi.create(
          name.trim(),
          description.trim(),
          selectedAccounts,
          selectedGroups,
          null,
          defaultChartType
        );
      }

      navigate(`/charts/${chart.id}`);
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="app">
      <div className="detail-header">
        <button onClick={() => navigate('/charts')} className="btn-back">
          <ArrowLeft size={18} />
          <span>Back</span>
        </button>
      </div>

      <div className="detail-main">
        <h1 className="detail-title">Create Chart</h1>

        {error && <div className="error">{error}</div>}

        <form onSubmit={handleSubmit} className="dashboard-form">
          <div className="form-group">
            <label htmlFor="name">Name *</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Chart"
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

          {/* Data Source Toggle */}
          <div className="form-group">
            <label>Data Source</label>
            <div className="toggle-group">
              <button
                type="button"
                className={`toggle-btn ${dataSource === 'accounts_groups' ? 'active' : ''}`}
                onClick={() => setDataSource('accounts_groups')}
              >
                Accounts & Groups
              </button>
              <button
                type="button"
                className={`toggle-btn ${dataSource === 'dataset' ? 'active' : ''}`}
                onClick={() => setDataSource('dataset')}
              >
                Dataset
              </button>
            </div>
          </div>

          {dataSource === 'accounts_groups' ? (
            <>
              {accounts.length > 0 && (
                <div className="form-group">
                  <label>Accounts</label>
                  <MultiSelectDropdown
                    items={accounts}
                    selectedIds={selectedAccounts}
                    onChange={setSelectedAccounts}
                    placeholder="Select accounts..."
                    labelKey="account_name"
                  />
                </div>
              )}

              {groups.length > 0 && (
                <div className="form-group">
                  <label>Groups</label>
                  <MultiSelectDropdown
                    items={groups}
                    selectedIds={selectedGroups}
                    onChange={setSelectedGroups}
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
              )}

              <div className="form-group">
                <label>Default View</label>
                <div className="toggle-group">
                  <button
                    type="button"
                    className={`toggle-btn ${defaultChartType === 'pie' ? 'active' : ''}`}
                    onClick={() => setDefaultChartType('pie')}
                  >
                    Pie Chart
                  </button>
                  <button
                    type="button"
                    className={`toggle-btn ${defaultChartType === 'line' ? 'active' : ''}`}
                    onClick={() => setDefaultChartType('line')}
                  >
                    Line Chart
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Dataset selection */}
              <div className="form-group">
                <label>Dataset</label>
                <select
                  value={selectedDataset || ''}
                  onChange={(e) => setSelectedDataset(e.target.value ? parseInt(e.target.value) : null)}
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
                  {/* Chart Type Selection */}
                  <div className="form-group">
                    <label>Chart Type</label>
                    <div className="toggle-group">
                      <button
                        type="button"
                        className={`toggle-btn ${chartType === 'line' ? 'active' : ''}`}
                        onClick={() => setChartType('line')}
                      >
                        Line Chart
                      </button>
                      <button
                        type="button"
                        className={`toggle-btn ${chartType === 'pie' ? 'active' : ''}`}
                        onClick={() => setChartType('pie')}
                      >
                        Pie Chart
                      </button>
                    </div>
                  </div>

                  {chartType === 'line' ? (
                    <>
                      {/* X-Axis Column */}
                      <div className="form-group">
                        <label>X-Axis Column</label>
                        <select value={xColumn} onChange={(e) => setXColumn(e.target.value)}>
                          <option value="">Select column...</option>
                          {datasetColumns.map((col) => (
                            <option key={col.id} value={col.name}>{col.name}</option>
                          ))}
                        </select>
                      </div>

                      {/* Y-Axis Columns (multi-select) */}
                      <div className="form-group">
                        <label>Y-Axis Columns (select one or more)</label>
                        <div className="item-selection">
                          {datasetColumns.map((col) => (
                            <label key={col.id} className="item-checkbox">
                              <input
                                type="checkbox"
                                checked={yColumns.includes(col.name)}
                                onChange={() => handleYColumnToggle(col.name)}
                              />
                              <span className="item-checkbox-name">{col.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Aggregation Field (GROUP BY) */}
                      <div className="form-group">
                        <label>Group By Column</label>
                        <select value={aggregationField} onChange={(e) => setAggregationField(e.target.value)}>
                          <option value="">Select column...</option>
                          {datasetColumns.map((col) => (
                            <option key={col.id} value={col.name}>{col.name}</option>
                          ))}
                        </select>
                      </div>

                      {/* Aggregation Value */}
                      <div className="form-group">
                        <label>Value Column</label>
                        <select value={aggregationValue} onChange={(e) => setAggregationValue(e.target.value)}>
                          <option value="">Select column...</option>
                          {datasetColumns.map((col) => (
                            <option key={col.id} value={col.name}>{col.name}</option>
                          ))}
                        </select>
                      </div>

                      {/* Aggregation Operator */}
                      <div className="form-group">
                        <label>Aggregation</label>
                        <select value={aggregationOperator} onChange={(e) => setAggregationOperator(e.target.value)}>
                          <option value="SUM">Sum</option>
                          <option value="COUNT">Count</option>
                        </select>
                      </div>
                    </>
                  )}
                </>
              )}
            </>
          )}

          <div className="form-actions">
            <button
              type="button"
              onClick={() => navigate('/charts')}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={submitting}
            >
              {submitting ? 'Creating...' : 'Create Chart'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
