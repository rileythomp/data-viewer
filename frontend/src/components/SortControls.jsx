import { ArrowUpDown } from 'lucide-react';

const SORT_OPTIONS = [
  { value: 'custom', label: 'Custom Order' },
  { value: 'name-asc', label: 'Name (A-Z)' },
  { value: 'name-desc', label: 'Name (Z-A)' },
  { value: 'value-asc', label: 'Value (Low to High)' },
  { value: 'value-desc', label: 'Value (High to Low)' },
];

export default function SortControls({ sortOrder, onSortChange }) {
  return (
    <div className="sort-controls">
      <ArrowUpDown size={16} className="sort-icon" />
      <select
        value={sortOrder}
        onChange={(e) => onSortChange(e.target.value)}
        className="sort-select"
        aria-label="Sort groups by"
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
