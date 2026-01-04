import { useState, useRef, useEffect } from 'react';
import { ChevronDown, X, Search } from 'lucide-react';
import './MultiSelectDropdown.css';

export default function MultiSelectDropdown({
    items,
    selectedIds,
    onChange,
    placeholder = 'Select items...',
    labelKey = 'name',
    idKey = 'id',
    renderOption,
    renderChip,
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const containerRef = useRef(null);
    const searchInputRef = useRef(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
                setSearchQuery('');
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Focus search input when dropdown opens
    useEffect(() => {
        if (isOpen && searchInputRef.current) {
            searchInputRef.current.focus();
        }
    }, [isOpen]);

    const filteredItems = items.filter((item) => {
        const label = item[labelKey] || '';
        return label.toLowerCase().includes(searchQuery.toLowerCase());
    });

    const handleToggle = (itemId) => {
        const newSelection = selectedIds.includes(itemId)
            ? selectedIds.filter((id) => id !== itemId)
            : [...selectedIds, itemId];
        onChange(newSelection);
    };

    const handleRemove = (e, itemId) => {
        e.stopPropagation();
        onChange(selectedIds.filter((id) => id !== itemId));
    };

    const selectedItems = items.filter((item) => selectedIds.includes(item[idKey]));

    const defaultRenderOption = (item) => (
        <span className="multi-select-option-label">{item[labelKey]}</span>
    );

    const defaultRenderChip = (item) => (
        <span className="multi-select-chip-label">{item[labelKey]}</span>
    );

    return (
        <div className="multi-select-dropdown" ref={containerRef}>
            {/* Trigger button */}
            <button
                type="button"
                className={`multi-select-trigger ${isOpen ? 'open' : ''}`}
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="multi-select-trigger-content">
                    {selectedItems.length === 0 ? (
                        <span className="multi-select-placeholder">{placeholder}</span>
                    ) : (
                        <span className="multi-select-count">
                            {selectedItems.length} selected
                        </span>
                    )}
                </div>
                <ChevronDown
                    size={18}
                    className={`multi-select-chevron ${isOpen ? 'rotated' : ''}`}
                />
            </button>

            {/* Selected chips */}
            {selectedItems.length > 0 && (
                <div className="multi-select-chips">
                    {selectedItems.map((item) => (
                        <div key={item[idKey]} className="multi-select-chip">
                            {renderChip ? renderChip(item) : defaultRenderChip(item)}
                            <button
                                type="button"
                                className="multi-select-chip-remove"
                                onClick={(e) => handleRemove(e, item[idKey])}
                            >
                                <X size={14} />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Dropdown panel */}
            {isOpen && (
                <div className="multi-select-panel">
                    {/* Search input */}
                    <div className="multi-select-search">
                        <Search size={16} className="multi-select-search-icon" />
                        <input
                            ref={searchInputRef}
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search..."
                            className="multi-select-search-input"
                        />
                    </div>

                    {/* Options list */}
                    <div className="multi-select-options">
                        {filteredItems.length === 0 ? (
                            <div className="multi-select-no-results">No items found</div>
                        ) : (
                            filteredItems.map((item) => {
                                const isSelected = selectedIds.includes(item[idKey]);
                                return (
                                    <div
                                        key={item[idKey]}
                                        className={`multi-select-option ${isSelected ? 'selected' : ''}`}
                                        onClick={() => handleToggle(item[idKey])}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => { }}
                                            className="multi-select-option-checkbox"
                                        />
                                        {renderOption ? renderOption(item) : defaultRenderOption(item)}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
