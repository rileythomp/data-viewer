import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const RADIAN = Math.PI / 180;
const MIN_LABEL_PERCENT = 0.05;

const renderCustomizedLabel = ({ cx, cy, midAngle, outerRadius, percent, name }) => {
  if (percent < MIN_LABEL_PERCENT) return null;

  const radius = outerRadius + 25;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text
      x={x}
      y={y}
      fill="var(--color-text-primary)"
      textAnchor={x > cx ? 'start' : 'end'}
      dominantBaseline="central"
      fontSize={12}
    >
      {`${name}: ${(percent * 100).toFixed(1)}%`}
    </text>
  );
};

export default function DatasetPieChartView({ data }) {
  const formatValue = (value) => {
    return new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 2,
    }).format(value);
  };

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      return (
        <div className="chart-tooltip">
          <p className="chart-tooltip-date">{item.label}</p>
          <p className="chart-tooltip-balance">{formatValue(item.value)}</p>
        </div>
      );
    }
    return null;
  };

  if (!data || !data.items || data.items.length === 0) {
    return <p className="empty-state">No data to display.</p>;
  }

  // Transform data for Recharts
  const chartData = data.items.map(item => ({
    name: item.label,
    value: item.value,
    color: item.color,
    label: item.label,
  }));

  return (
    <>
      <div className="chart-container">
        <ResponsiveContainer width="100%" height={400}>
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={120}
              label={renderCustomizedLabel}
              labelLine={false}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Data table */}
      <div className="aggregation-table">
        <table className="data-table">
          <thead>
            <tr>
              <th>Category</th>
              <th style={{ textAlign: 'right' }}>Value</th>
              <th style={{ textAlign: 'right' }}>Percentage</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item, idx) => (
              <tr key={idx}>
                <td>
                  <span
                    className="color-dot"
                    style={{
                      display: 'inline-block',
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      backgroundColor: item.color,
                      marginRight: '8px',
                    }}
                  />
                  {item.label}
                </td>
                <td style={{ textAlign: 'right' }}>{formatValue(item.value)}</td>
                <td style={{ textAlign: 'right' }}>{((item.value / data.total) * 100).toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ fontWeight: 'bold' }}>
              <td>Total</td>
              <td style={{ textAlign: 'right' }}>{formatValue(data.total)}</td>
              <td style={{ textAlign: 'right' }}>100%</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </>
  );
}
