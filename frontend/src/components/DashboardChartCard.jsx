import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart2 } from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Legend,
  Tooltip,
} from 'recharts';
import { chartsApi } from '../services/api';

export default function DashboardChartCard({ chart }) {
  const navigate = useNavigate();
  const [historyData, setHistoryData] = useState(null);

  const handleClick = (e) => {
    // Prevent navigation when dragging
    if (e.defaultPrevented) return;
    navigate(`/charts/${chart.id}`);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      navigate(`/charts/${chart.id}`);
    }
  };

  // Determine if this is a dataset chart or accounts/groups chart
  const isDatasetChart = chart.data_source === 'dataset';

  // Get chart type - use default_chart_type for accounts/groups charts
  const chartType = isDatasetChart
    ? chart.dataset_config?.chart_type || 'line'
    : chart.default_chart_type || 'pie'; // Use default_chart_type if set, otherwise pie

  // Fetch history data for accounts/groups charts with line as default
  const needsHistoryData = !isDatasetChart && chartType === 'line';

  useEffect(() => {
    if (needsHistoryData && !historyData) {
      chartsApi.getHistory(chart.id)
        .then(data => setHistoryData(data))
        .catch(() => setHistoryData(null));
    }
  }, [chart.id, needsHistoryData, historyData]);

  // Get data for preview
  const getPieData = () => {
    if (isDatasetChart && chart.dataset_pie_data?.items) {
      return chart.dataset_pie_data.items.map(item => ({
        name: item.label,
        value: item.value,
        color: item.color,
      }));
    }
    if (!isDatasetChart && chart.pie_data) {
      return chart.pie_data.map(item => ({
        name: item.name,
        value: item.value,
        color: item.color,
      }));
    }
    return [];
  };

  const getLineData = () => {
    // For dataset charts
    if (isDatasetChart && chart.dataset_line_data) {
      const data = chart.dataset_line_data;
      return data.x_values.map((x, idx) => {
        const point = { x };
        data.series.forEach(series => {
          point[series.column] = series.values[idx];
        });
        return point;
      });
    }
    // For accounts/groups charts with history data
    if (!isDatasetChart && historyData?.series?.length > 0) {
      // Collect all unique dates
      const allDates = new Set();
      historyData.series.forEach(s => {
        s.history?.forEach(h => allDates.add(h.date));
      });
      const sortedDates = Array.from(allDates).sort();

      // Build data points
      return sortedDates.map(date => {
        const point = { x: date };
        historyData.series.forEach(s => {
          const entry = s.history?.find(h => h.date === date);
          point[s.name] = entry?.balance ?? null;
        });
        return point;
      });
    }
    return [];
  };

  const getLineSeries = () => {
    // For dataset charts
    if (isDatasetChart && chart.dataset_line_data?.series) {
      return chart.dataset_line_data.series.map(s => ({
        key: s.column,
        color: s.color,
      }));
    }
    // For accounts/groups charts with history data
    if (!isDatasetChart && historyData?.series?.length > 0) {
      return historyData.series.map(s => ({
        key: s.name,
        color: s.color,
      }));
    }
    return [];
  };

  // Get chart data based on type
  const pieData = getPieData();
  const lineData = chartType === 'line' ? getLineData() : [];
  const lineSeries = chartType === 'line' ? getLineSeries() : [];

  // Determine what to show in preview
  const showLinePreview = chartType === 'line' && lineData.length > 0;
  const hasData = showLinePreview ? lineData.length > 0 : pieData.length > 0;

  return (
    <div
      className="chart-card"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
    >
      <div className="chart-card-header">
        <div className="chart-card-icon-wrapper" title={chart.description || ''}>
          <BarChart2 size={18} className="chart-card-icon" />
        </div>
        <h3 className="chart-card-name">{chart.name}</h3>
      </div>

      <div className="chart-card-preview">
        {hasData ? (
          showLinePreview ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <XAxis
                  dataKey="x"
                  tick={{ fontSize: 10 }}
                  tickFormatter={(value) => {
                    // Format date if it looks like a date
                    if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}/)) {
                      const date = new Date(value);
                      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    }
                    // Truncate long labels
                    return String(value).length > 8 ? String(value).slice(0, 8) + '...' : value;
                  }}
                  interval="preserveStartEnd"
                  axisLine={{ stroke: 'var(--color-border)' }}
                  tickLine={{ stroke: 'var(--color-border)' }}
                />
                <YAxis
                  tick={{ fontSize: 10 }}
                  tickFormatter={(value) => {
                    if (Math.abs(value) >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
                    if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(1)}K`;
                    return value.toFixed(0);
                  }}
                  width={45}
                  axisLine={{ stroke: 'var(--color-border)' }}
                  tickLine={{ stroke: 'var(--color-border)' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '4px',
                    fontSize: '11px',
                  }}
                  formatter={(value) => {
                    if (typeof value === 'number') {
                      return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                    }
                    return value;
                  }}
                  labelFormatter={(label) => {
                    if (typeof label === 'string' && label.match(/^\d{4}-\d{2}-\d{2}/)) {
                      return new Date(label).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                    }
                    return label;
                  }}
                />
                {lineSeries.length <= 4 && (
                  <Legend
                    wrapperStyle={{ fontSize: '10px', paddingTop: '4px' }}
                    iconSize={8}
                    formatter={(value) => value.length > 12 ? value.slice(0, 12) + '...' : value}
                  />
                )}
                {lineSeries.map((series) => (
                  <Line
                    key={series.key}
                    type="monotone"
                    dataKey={series.key}
                    stroke={series.color}
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="35%"
                  cy="50%"
                  outerRadius={40}
                  innerRadius={15}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '4px',
                    fontSize: '11px',
                  }}
                  formatter={(value) => value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                />
                <Legend
                  layout="vertical"
                  align="right"
                  verticalAlign="middle"
                  wrapperStyle={{ fontSize: '10px', right: 0, width: '55%' }}
                  iconSize={8}
                  formatter={(value) => value.length > 15 ? value.slice(0, 15) + '...' : value}
                />
              </PieChart>
            </ResponsiveContainer>
          )
        ) : (
          <div className="chart-card-no-data">
            <BarChart2 size={32} className="chart-card-placeholder-icon" />
            <span>No data</span>
          </div>
        )}
      </div>

    </div>
  );
}
