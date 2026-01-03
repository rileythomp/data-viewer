import { useState, useRef, useEffect } from 'react';

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

export default function InlineColorPicker({ value, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleColorSelect = async (color) => {
    setIsOpen(false);
    if (color !== value) {
      await onChange(color);
    }
  };

  return (
    <div className="inline-color-picker" ref={containerRef}>
      <button
        type="button"
        className="color-picker-trigger"
        style={{ backgroundColor: value }}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Change color"
      />
      {isOpen && (
        <div className="color-picker-dropdown">
          {COLOR_PRESETS.map((color) => (
            <button
              key={color}
              type="button"
              className={`color-preset ${value === color ? 'selected' : ''}`}
              style={{ backgroundColor: color }}
              onClick={() => handleColorSelect(color)}
              aria-label={`Select color ${color}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
