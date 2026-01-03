import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

export default function BalanceHistoryChart({ history }) {
  // Reverse history to get chronological order (oldest first)
  const chartData = [...history].reverse().map((entry) => ({
    date: new Date(entry.recorded_at).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    }),
    balance: entry.balance,
    fullDate: new Date(entry.recorded_at).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
  }));

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="chart-tooltip">
          <p className="chart-tooltip-date">{data.fullDate}</p>
          <p className="chart-tooltip-balance">{formatCurrency(data.balance)}</p>
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
          <Line
            type="monotone"
            dataKey="balance"
            stroke="var(--color-primary)"
            strokeWidth={2}
            dot={{ fill: 'var(--color-primary)', strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6, fill: 'var(--color-primary)' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
