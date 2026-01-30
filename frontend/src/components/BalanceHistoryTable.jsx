export default function BalanceHistoryTable({ history, showAccountName = false }) {
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const datePart = date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const timePart = date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).replace(' ', '');
    return `${datePart}, ${timePart}`;
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getChange = (index) => {
    if (index === history.length - 1) return null;
    const current = history[index].balance;
    const previous = history[index + 1].balance;
    return current - previous;
  };

  const formatChange = (change) => {
    if (change === null) return { text: '-', className: 'change-neutral' };
    const formatted = formatCurrency(Math.abs(change));
    if (change > 0) {
      return { text: `+${formatted}`, className: 'change-positive' };
    } else if (change < 0) {
      return { text: `-${formatted}`, className: 'change-negative' };
    }
    return { text: formatted, className: 'change-neutral' };
  };

  if (history.length === 0) {
    return null;
  }

  return (
    <table className="history-table">
      <thead>
        <tr>
          <th>Date</th>
          {showAccountName && <th>Account Name</th>}
          <th>Balance</th>
          <th>Change</th>
        </tr>
      </thead>
      <tbody>
        {history.map((record, index) => {
          const change = getChange(index);
          const { text: changeText, className: changeClass } = formatChange(change);
          return (
            <tr key={record.id}>
              <td>{formatDate(record.recorded_at)}</td>
              {showAccountName && <td>{record.account_name_snapshot}</td>}
              <td>{formatCurrency(record.balance)}</td>
              <td className={changeClass}>{changeText}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
