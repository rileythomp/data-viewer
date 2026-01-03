import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

export default function ChartLineView({ historyData }) {
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  // Early validation - check if we have valid series with history data
  if (!historyData?.series || historyData.series.length === 0) {
    return <p className="empty-state">No history data available for line chart.</p>;
  }

  const hasAnyHistory = historyData.series.some(s => s.history && s.history.length > 0);
  if (!hasAnyHistory) {
    return <p className="empty-state">No history data available for line chart.</p>;
  }

  // Build unified chart data with all series aligned by date
  const buildChartData = () => {
    const dateMap = new Map();

    // Collect all dates and their balances for each series
    historyData.series.forEach((series) => {
      if (!series.history) return; // Skip series without history
      series.history.forEach((entry) => {
        const dateStr = new Date(entry.date).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        });
        const fullDate = new Date(entry.date).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
        const timestamp = new Date(entry.date).getTime();

        if (!dateMap.has(timestamp)) {
          dateMap.set(timestamp, { date: dateStr, fullDate, timestamp });
        }
        dateMap.get(timestamp)[`${series.type}_${series.id}`] = entry.balance;
      });
    });

    // Sort by timestamp and return as array
    return Array.from(dateMap.values()).sort((a, b) => a.timestamp - b.timestamp);
  };

  const chartData = buildChartData();

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="chart-tooltip">
          <p className="chart-tooltip-date">{data.fullDate}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ color: entry.color }}>
              {entry.name}: {formatCurrency(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="balance-chart-container">
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
          <XAxis
            dataKey="date"
            tick={{ fill: 'var(--color-text-secondary)', fontSize: 12 }}
            tickLine={{ stroke: 'var(--color-border)' }}
            axisLine={{ stroke: 'var(--color-border)' }}
          />
          <YAxis
            tickFormatter={formatCurrency}
            tick={{ fill: 'var(--color-text-secondary)', fontSize: 12 }}
            tickLine={{ stroke: 'var(--color-border)' }}
            axisLine={{ stroke: 'var(--color-border)' }}
            width={100}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ paddingTop: 20 }}
            formatter={(value) => <span style={{ marginRight: 16 }}>{value}</span>}
          />
          {historyData.series.map((series) => (
            <Line
              key={`${series.type}_${series.id}`}
              type="monotone"
              dataKey={`${series.type}_${series.id}`}
              name={series.name}
              stroke={series.color}
              strokeWidth={2}
              dot={{ fill: series.color, strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, fill: series.color }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
