import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronUp, History } from 'lucide-react';
import { useDroppable } from '@dnd-kit/core';
import BalanceHistoryModal from './BalanceHistoryModal';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import AccountCard from './AccountCard';

function SortableAccountInGroup({ account, groupId, onUpdateBalance, onViewHistory, crossGroupDragAccountId }) {
  // Use composite ID (groupId-accountId) so accounts in multiple groups have unique sortable IDs
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `group-${groupId}-account-${account.id}` });

  // Hide if this is the cross-group drag placeholder (account being dragged from another group)
  const isPlaceholder = account.id === crossGroupDragAccountId;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging || isPlaceholder ? 0 : 1,
    zIndex: isDragging ? 1000 : 'auto',
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <AccountCard
        account={account}
        onUpdateBalance={onUpdateBalance}
        onViewHistory={onViewHistory}
      />
    </div>
  );
}

export default function GroupCard({
  group,
  isExpanded,
  onToggleExpand,
  onUpdateBalance,
  onViewHistory,
  crossGroupDragAccountId,
}) {
  const navigate = useNavigate();
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // Make the group content a drop target
  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: `group-drop-${group.id}`,
    data: {
      type: 'group',
      groupId: group.id,
    },
  });

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
    <div
      ref={setDroppableRef}
      className="group-card"
    >
      <div
        className="group-color-indicator"
        style={{ backgroundColor: group.color }}
      />
      <div className="group-card-header" onClick={handleToggleExpand}>
        <div className="group-header-left">
          <button
            className="btn-icon btn-expand"
            onClick={handleToggleExpand}
            aria-label={isExpanded ? 'Collapse group' : 'Expand group'}
          >
            {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>
          <h3 className="group-name" onClick={handleNavigateToGroup} title="View group details">
            {group.group_name}
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
            <SortableContext
              items={group.accounts.map((a) => `group-${group.id}-account-${a.id}`)}
              strategy={verticalListSortingStrategy}
            >
              <div className="group-accounts">
                {group.accounts.map((account) => (
                  <SortableAccountInGroup
                    key={`${group.id}-${account.id}`}
                    account={account}
                    groupId={group.id}
                    onUpdateBalance={onUpdateBalance}
                    onViewHistory={onViewHistory}
                    crossGroupDragAccountId={crossGroupDragAccountId}
                  />
                ))}
              </div>
            </SortableContext>
          ) : (
            <p className="group-empty">No accounts in this group. Drag accounts here to add them.</p>
          )}
        </div>
      )}
      {isOver && !isExpanded && (
        <div className="group-content group-content-drop-hint">
          <p className="group-drop-hint">Drop here to add to group</p>
        </div>
      )}

      {showHistoryModal && (
        <BalanceHistoryModal
          entityType="group"
          entityId={group.id}
          entityName={group.group_name}
          onClose={() => setShowHistoryModal(false)}
        />
      )}
    </div>
  );
}
