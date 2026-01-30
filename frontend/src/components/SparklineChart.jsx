import {
  AreaChart,
  Area,
  Tooltip,
  ResponsiveContainer,
  ReferenceDot,
} from 'recharts';

export default function SparklineChart({ history, height = 100 }) {
  if (!history || history.length === 0) {
    return null;
  }

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
        <div className="sparkline-tooltip">
          <p className="sparkline-tooltip-date">{data.fullDate}</p>
          <p className="sparkline-tooltip-balance">{formatCurrency(data.balance)}</p>
        </div>
      );
    }
    return null;
  };

  // Get the last data point for the endpoint dot
  const lastPoint = chartData[chartData.length - 1];

  return (
    <div className="sparkline-container">
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
          <defs>
            <linearGradient id="sparklineGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10B981" stopOpacity={0.35} />
              <stop offset="70%" stopColor="#10B981" stopOpacity={0.05} />
              <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
            </linearGradient>
            <filter id="sparklineGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <Tooltip content={<CustomTooltip />} cursor={false} />
          <Area
            type="monotone"
            dataKey="balance"
            stroke="#10B981"
            strokeWidth={2.5}
            fill="url(#sparklineGradient)"
            filter="url(#sparklineGlow)"
            dot={false}
            activeDot={{
              r: 6,
              fill: '#FFFFFF',
              stroke: '#10B981',
              strokeWidth: 3,
            }}
          />
          {lastPoint && (
            <ReferenceDot
              x={lastPoint.date}
              y={lastPoint.balance}
              r={6}
              fill="#FFFFFF"
              stroke="#10B981"
              strokeWidth={3}
              className="sparkline-endpoint"
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
