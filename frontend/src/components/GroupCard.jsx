import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronUp, History, GripVertical } from 'lucide-react';
import BalanceHistoryModal from './BalanceHistoryModal';
import AccountCard from './AccountCard';

export default function GroupCard({
  group,
  isExpanded,
  onToggleExpand,
  onUpdateBalance,
  onViewHistory,
  dragHandleProps,
  sortable = true,
}) {
  const navigate = useNavigate();
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const handleToggleExpand = (e) => {
    e.stopPropagation();
    onToggleExpand(group.id);
  };

  const handleNavigateToGroup = (e) => {
    e.stopPropagation();
    navigate(`/groups/${group.id}`);
  };

  const handleViewHistory = (e) => {
    e.stopPropagation();
    setShowHistoryModal(true);
  };

  return (
    <div className="group-card">
      <div
        className="group-color-indicator"
        style={{ backgroundColor: group.color }}
      />
      <div className="group-card-header" onClick={handleToggleExpand}>
        <div className="group-header-left">
          {sortable && (
            <div
              className="group-drag-handle"
              {...dragHandleProps}
              onClick={(e) => e.stopPropagation()}
            >
              <GripVertical size={18} />
            </div>
          )}
          <button
            className="btn-icon btn-expand"
            onClick={handleToggleExpand}
            aria-label={isExpanded ? 'Collapse group' : 'Expand group'}
          >
            {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>
          <h3 className="group-name" onClick={handleNavigateToGroup} title="View group details">
            {group.name}
          </h3>
          <span className="group-account-count">
            ({group.accounts?.length || 0} accounts)
          </span>
        </div>
        <div className="group-header-right">
          <span className="group-total">{formatCurrency(group.total_balance)}</span>
          <button
            onClick={handleViewHistory}
            className="btn-icon"
            aria-label="View balance history"
            title="History"
          >
            <History size={16} />
          </button>
        </div>
      </div>
      {isExpanded && (
        <div className="group-content group-content-expanded">
          {group.accounts && group.accounts.length > 0 ? (
            <div className="group-accounts">
              {group.accounts.map((account) => (
                <AccountCard
                  key={`${group.id}-${account.id}`}
                  account={account}
                  onUpdateBalance={onUpdateBalance}
                  onViewHistory={onViewHistory}
                />
              ))}
            </div>
          ) : (
            <p className="group-empty">No accounts in this group.</p>
          )}
        </div>
      )}

      {showHistoryModal && (
        <BalanceHistoryModal
          entityType="group"
          entityId={group.id}
          entityName={group.name}
          onClose={() => setShowHistoryModal(false)}
        />
      )}
    </div>
  );
}

export function GroupCardPreview({ group }) {
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  return (
    <div className="group-card group-card-preview">
      <div className="group-color-indicator" style={{ backgroundColor: group.color }} />
      <div className="group-card-header">
        <div className="group-header-left">
          <h3 className="group-name">{group.name}</h3>
          <span className="group-account-count">
            ({group.accounts?.length || 0} accounts)
          </span>
        </div>
        <div className="group-header-right">
          <span className="group-total">{formatCurrency(group.total_balance)}</span>
        </div>
      </div>
    </div>
  );
}
