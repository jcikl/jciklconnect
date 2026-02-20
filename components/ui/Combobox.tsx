import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, X } from 'lucide-react';

export interface ComboboxProps {
    options?: string[];
    groupedOptions?: { label: string; options: string[] }[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
    disabled?: boolean;
}

export const Combobox: React.FC<ComboboxProps> = ({
    options = [],
    groupedOptions,
    value,
    onChange,
    placeholder = 'Select or type...',
    className = '',
    disabled = false,
}) => {
    const [open, setOpen] = useState(false);
    const [inputValue, setInputValue] = useState(value);
    const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null); // 新增：下拉菜单引用

    const isGrouped = !!groupedOptions;

    useEffect(() => {
        setInputValue(value);
    }, [value]);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            const clickedInContainer = containerRef.current && containerRef.current.contains(e.target as Node);
            const clickedInDropdown = dropdownRef.current && dropdownRef.current.contains(e.target as Node);
            
            if (!clickedInContainer && !clickedInDropdown) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const updateDropdownPosition = useCallback(() => {
        if (inputRef.current && open) {
            const rect = inputRef.current.getBoundingClientRect();
            setDropdownPosition({
                top: rect.bottom + window.scrollY,
                left: rect.left + window.scrollX,
                width: rect.width
            });
        }
    }, [open]);

    useEffect(() => {
        if (open) {
            updateDropdownPosition();
            window.addEventListener('resize', updateDropdownPosition);
            window.addEventListener('scroll', updateDropdownPosition, true);
        }
        return () => {
            window.removeEventListener('resize', updateDropdownPosition);
            window.removeEventListener('scroll', updateDropdownPosition, true);
        };
    }, [open, updateDropdownPosition]);

    const filteredOptions = useMemo(() => {
        if (!inputValue) {
            return isGrouped ? groupedOptions : options;
        }

        if (isGrouped && groupedOptions) {
            const filtered: { label: string; options: string[] }[] = [];
            groupedOptions.forEach(group => {
                const matchingOptions = group.options.filter(opt =>
                    opt.toLowerCase().includes(inputValue.toLowerCase())
                );
                if (matchingOptions.length > 0) {
                    filtered.push({ label: group.label, options: matchingOptions });
                }
            });
            return filtered;
        }

        return options.filter(opt =>
            opt.toLowerCase().includes(inputValue.toLowerCase())
        );
    }, [inputValue, options, groupedOptions, isGrouped]);

    const getDisplayValue = () => {
        if (!value) return '';
        
        if (isGrouped && groupedOptions) {
            for (const group of groupedOptions) {
                const found = group.options.find(opt => opt === value);
                if (found) return value;
            }
        }
        
        return value;
    };

    const handleSelect = (e: React.MouseEvent, val: string) => {
        e.stopPropagation();
        setInputValue(val);
        onChange(val);
        setOpen(false);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setInputValue(val);
        onChange(val);
        setOpen(true);
    };

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation();
        setInputValue('');
        onChange('');
        setOpen(false);
    };

    const flatOptions = isGrouped && groupedOptions 
        ? groupedOptions.flatMap(g => g.options) 
        : options;
    
    const hasValue = !!getDisplayValue();

    const renderDropdown = () => {
        if (!open) return null;

        return createPortal(
            <div 
                ref={dropdownRef}
                className="fixed z-[9999] mt-1 rounded-lg border border-slate-200 bg-white shadow-xl py-1 animate-in fade-in zoom-in-95 duration-100"
                style={{ 
                    top: dropdownPosition.top, 
                    left: dropdownPosition.left,
                    width: dropdownPosition.width,
                    maxHeight: '240px',
                    overflow: 'auto'
                }}
            >
                {filteredOptions && filteredOptions.length === 0 ? (
                    <div className="px-3 py-4 text-center">
                        <p className="text-sm text-slate-400 italic">No matches found</p>
                        {inputValue && !flatOptions.includes(inputValue) && (
                            <p className="text-xs text-slate-300 mt-1 cursor-pointer hover:text-jci-blue" onClick={() => setOpen(false)}>
                                Using custom value: "{inputValue}"
                            </p>
                        )}
                    </div>
                ) : isGrouped && filteredOptions && (filteredOptions as { label: string; options: string[] }[]).length > 0 ? (
                    (filteredOptions as { label: string; options: string[] }[]).map((group, groupIndex) => (
                        <div key={groupIndex}>
                            <div className="px-3 py-1 text-xs font-semibold text-slate-500 bg-slate-50 sticky top-0">
                                {group.label}
                            </div>
                            {group.options.map((opt, optIndex) => (
                                <div
                                    key={`${groupIndex}-${optIndex}`}
                                    onClick={(e) => handleSelect(e, opt)}
                                    className={`
                        px-3 py-2 text-sm cursor-pointer transition-colors
                        ${value === opt
                                            ? 'bg-jci-blue/10 text-jci-blue font-semibold'
                                            : 'text-slate-700 hover:bg-slate-50'}
                      `}
                                >
                                    {opt}
                                </div>
                            ))}
                        </div>
                    ))
                ) : (
                    (filteredOptions as string[]).map((opt, i) => (
                        <div
                            key={i}
                            onClick={(e) => handleSelect(e, opt)}
                            className={`
              px-3 py-2 text-sm cursor-pointer transition-colors
              ${value === opt
                                ? 'bg-jci-blue/10 text-jci-blue font-semibold'
                                : 'text-slate-700 hover:bg-slate-50'}
            `}
                        >
                            {opt}
                        </div>
                    ))
                )}
            </div>,
            document.body
        );
    };

    return (
        <div ref={containerRef} className={`relative ${className}`}>
            <div className="relative group">
                <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={handleInputChange}
                    onFocus={() => setOpen(true)}
                    placeholder={placeholder}
                    disabled={disabled}
                    className={`
          block w-full rounded-lg border-slate-300 shadow-sm py-2 px-3
          focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20 sm:text-sm
          disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed
          transition-colors
          border-slate-300
          
          `}
                />
                <div className="absolute inset-y-0 right-0 flex items-center">
                    <button
                        type="button"
                        onClick={() => setOpen(!open)}
                        className="text-slate-400 hover:text-slate-600"
                    >
                        <ChevronDown size={14} className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
                    </button>
                </div>
            </div>

            {renderDropdown()}
        </div>
    );
};
