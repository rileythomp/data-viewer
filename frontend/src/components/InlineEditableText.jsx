import { useState, useEffect, useRef } from 'react';

export default function InlineEditableText({
  value,
  onSave,
  type = 'input',
  placeholder = '',
  className = '',
  rows = 4,
  required = false,
  autoFocus = false,
}) {
  const [editValue, setEditValue] = useState(value);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);
  const originalValue = useRef(value);

  useEffect(() => {
    setEditValue(value);
    originalValue.current = value;
  }, [value]);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [autoFocus]);

  const handleSave = async () => {
    const trimmedValue = editValue.trim();

    if (required && !trimmedValue) {
      setError('This field is required');
      setEditValue(originalValue.current);
      return;
    }

    if (trimmedValue === originalValue.current) {
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      await onSave(trimmedValue);
      originalValue.current = trimmedValue;
    } catch (err) {
      setError(err.message);
      setEditValue(originalValue.current);
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setEditValue(originalValue.current);
      setError('');
      inputRef.current?.blur();
    } else if (e.key === 'Enter' && type === 'input') {
      handleSave();
      inputRef.current?.blur();
    }
  };

  const commonProps = {
    ref: inputRef,
    value: editValue,
    onChange: (e) => {
      setEditValue(e.target.value);
      setError('');
    },
    onBlur: handleSave,
    onKeyDown: handleKeyDown,
    placeholder,
    className: `${className} ${isSaving ? 'inline-edit-saving' : ''} ${error ? 'inline-edit-error-input' : ''}`,
    disabled: isSaving,
  };

  return (
    <div className="inline-editable-text">
      {type === 'textarea' ? (
        <textarea {...commonProps} rows={rows} />
      ) : (
        <input type="text" {...commonProps} />
      )}
      {error && <span className="inline-edit-error">{error}</span>}
    </div>
  );
}
