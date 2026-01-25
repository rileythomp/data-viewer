import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronUp, History } from 'lucide-react';
import BalanceHistoryModal from './BalanceHistoryModal';
import AccountCard from './AccountCard';

export default function InstitutionCard({
  institution,
  isExpanded,
  onToggleExpand,
  onUpdateBalance,
  onViewHistory,
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
    onToggleExpand(institution.id);
  };

  const handleNavigateToInstitution = (e) => {
    e.stopPropagation();
    navigate(`/institutions/${institution.id}`);
  };

  const handleViewHistory = (e) => {
    e.stopPropagation();
    setShowHistoryModal(true);
  };

  return (
    <div className="group-card">
      <div
        className="group-color-indicator"
        style={{ backgroundColor: institution.color }}
      />
      <div className="group-card-header" onClick={handleToggleExpand}>
        <div className="group-header-left">
          <button
            className="btn-icon btn-expand"
            onClick={handleToggleExpand}
            aria-label={isExpanded ? 'Collapse institution' : 'Expand institution'}
          >
            {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>
          <h3 className="group-name" onClick={handleNavigateToInstitution} title="View institution details">
            {institution.name}
          </h3>
          <span className="group-account-count">
            ({institution.accounts?.length || 0} accounts)
          </span>
        </div>
        <div className="group-header-right">
          <span className="group-total">{formatCurrency(institution.total_balance)}</span>
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
          {institution.accounts && institution.accounts.length > 0 ? (
            <div className="group-accounts">
              {institution.accounts.map((account) => (
                <AccountCard
                  key={`${institution.id}-${account.id}`}
                  account={account}
                  onUpdateBalance={onUpdateBalance}
                  onViewHistory={onViewHistory}
                />
              ))}
            </div>
          ) : (
            <p className="group-empty">No accounts in this institution.</p>
          )}
        </div>
      )}

      {showHistoryModal && (
        <BalanceHistoryModal
          entityType="institution"
          entityId={institution.id}
          entityName={institution.name}
          onClose={() => setShowHistoryModal(false)}
        />
      )}
    </div>
  );
}
