import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function DatasetLineChartView({ data }) {
  if (!data || !data.x_values || data.x_values.length === 0) {
    return <p className="empty-state">No data to display.</p>;
  }

  // Transform data for Recharts
  // Create array of objects with x value and all y values
  const chartData = data.x_values.map((x, idx) => {
    const point = { x };
    data.series.forEach(series => {
      point[series.column] = series.values[idx];
    });
    return point;
  });

  const formatValue = (value) => {
    if (typeof value !== 'number') return value;
    return new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 2,
    }).format(value);
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="chart-tooltip">
          <p className="chart-tooltip-date">{label}</p>
          {payload.map((entry, idx) => (
            <p key={idx} style={{ color: entry.color }}>
              {entry.name}: {formatValue(entry.value)}
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
        <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
          <XAxis
            dataKey="x"
            tick={{ fill: 'var(--color-text-secondary)', fontSize: 12 }}
            tickLine={{ stroke: 'var(--color-border)' }}
            axisLine={{ stroke: 'var(--color-border)' }}
            label={{ value: data.x_column, position: 'insideBottom', offset: -10, fill: 'var(--color-text-secondary)', fontSize: 13, fontWeight: 500 }}
          />
          <YAxis
            tickFormatter={formatValue}
            tick={{ fill: 'var(--color-text-secondary)', fontSize: 12 }}
            tickLine={{ stroke: 'var(--color-border)' }}
            axisLine={{ stroke: 'var(--color-border)' }}
            width={100}
            label={data.series.length === 1 ? { value: data.series[0].column, angle: -90, position: 'insideLeft', dx: 25, fill: 'var(--color-text-secondary)', fontSize: 13, fontWeight: 500 } : undefined}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{ paddingTop: 25 }} />
          {data.series.map((series) => (
            <Line
              key={series.column}
              type="monotone"
              dataKey={series.column}
              name={series.column}
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
