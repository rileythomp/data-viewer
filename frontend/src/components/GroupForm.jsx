import { useState } from 'react';

const COLOR_PRESETS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
];

export default function GroupForm({ onSubmit, onCancel, initialData = null }) {
  const [groupName, setGroupName] = useState(initialData?.group_name || '');
  const [groupDescription, setGroupDescription] = useState(initialData?.group_description || '');
  const [color, setColor] = useState(initialData?.color || COLOR_PRESETS[0]);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!groupName.trim()) {
      setError('Group name is required');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await onSubmit(groupName.trim(), groupDescription.trim(), color);
    } catch (err) {
      setError(err.message);
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="group-form">
      <h3>{initialData ? 'Edit Group' : 'Create New Group'}</h3>

      {error && <div className="error">{error}</div>}

      <div className="form-group">
        <label htmlFor="groupName">Group Name *</label>
        <input
          id="groupName"
          type="text"
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
          placeholder="e.g., Savings, Investments"
          autoFocus
        />
      </div>

      <div className="form-group">
        <label htmlFor="groupDescription">Description</label>
        <textarea
          id="groupDescription"
          value={groupDescription}
          onChange={(e) => setGroupDescription(e.target.value)}
          placeholder="Optional description for this group"
          rows={2}
        />
      </div>

      <div className="form-group">
        <label>Color</label>
        <div className="color-presets">
          {COLOR_PRESETS.map((presetColor) => (
            <button
              key={presetColor}
              type="button"
              className={`color-preset ${color === presetColor ? 'selected' : ''}`}
              style={{ backgroundColor: presetColor }}
              onClick={() => setColor(presetColor)}
              aria-label={`Select color ${presetColor}`}
            />
          ))}
        </div>
      </div>

      <div className="form-actions">
        <button type="button" onClick={onCancel} className="btn-secondary" disabled={isSubmitting}>
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : initialData ? 'Save Changes' : 'Create Group'}
        </button>
      </div>
    </form>
  );
}
