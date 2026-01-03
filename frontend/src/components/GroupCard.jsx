import { useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import AccountCard from './AccountCard';

function SortableAccountInGroup({ account, onUpdateBalance, onViewHistory }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `account-${account.id}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
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
}) {
  const navigate = useNavigate();

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

  return (
    <div
      ref={setDroppableRef}
      className={`group-card ${isOver ? 'group-card-drop-target' : ''}`}
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
        </div>
      </div>
      {isExpanded && (
        <div className={`group-content group-content-expanded ${isOver ? 'group-content-over' : ''}`}>
          {group.accounts && group.accounts.length > 0 ? (
            <SortableContext
              items={group.accounts.map((a) => `account-${a.id}`)}
              strategy={verticalListSortingStrategy}
            >
              <div className="group-accounts">
                {group.accounts.map((account) => (
                  <SortableAccountInGroup
                    key={account.id}
                    account={account}
                    onUpdateBalance={onUpdateBalance}
                    onViewHistory={onViewHistory}
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
    </div>
  );
}
