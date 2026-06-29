import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check, Search, X } from 'lucide-react';

interface MultiSelectProps {
  options: readonly string[] | string[] | { label: string; value: string }[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  className?: string;
}

export const MultiSelectDropdown: React.FC<MultiSelectProps> = ({ 
  options, 
  selected, 
  onChange, 
  placeholder = "Select...", 
  className = "" 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dropdownCoords, setDropdownCoords] = useState<{ top: number | 'auto'; bottom: number | 'auto'; left: number; width: number }>({ top: 0, bottom: 'auto', left: 0, width: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const clickedInContainer = containerRef.current && containerRef.current.contains(e.target as Node);
      const clickedInDropdown = dropdownRef.current && dropdownRef.current.contains(e.target as Node);
      if (!clickedInContainer && !clickedInDropdown) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const updateCoords = useCallback(() => {
    if (containerRef.current && isOpen) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const dropdownHeight = 280; // max-h-72 is 280px
      
      if (spaceBelow < dropdownHeight && spaceAbove > spaceBelow) {
        setDropdownCoords({
          top: 'auto',
          bottom: window.innerHeight - rect.top,
          left: rect.left,
          width: rect.width
        });
      } else {
        setDropdownCoords({
          top: rect.bottom,
          bottom: 'auto',
          left: rect.left,
          width: rect.width
        });
      }
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
    } else {
      updateCoords();
      window.addEventListener('resize', updateCoords);
      window.addEventListener('scroll', updateCoords, true);
    }
    return () => {
      window.removeEventListener('resize', updateCoords);
      window.removeEventListener('scroll', updateCoords, true);
    };
  }, [isOpen, updateCoords]);

  const toggleOption = (opt: string) => {
    if (selected.includes(opt)) {
      onChange(selected.filter(s => s !== opt));
    } else {
      onChange([...selected, opt]);
    }
  };

  const clearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([]);
  };

  const renderDropdown = () => {
    if (!isOpen) return null;

    return createPortal(
      <div 
        ref={dropdownRef}
        className={`fixed z-[9999] w-full flex flex-col overflow-hidden rounded border border-slate-200 bg-white shadow-lg max-h-72 animate-in fade-in slide-in-from-top-1 duration-150 ${dropdownCoords.top === 'auto' ? 'mb-1' : 'mt-1'}`}
        style={{
          top: dropdownCoords.top,
          bottom: dropdownCoords.bottom,
          left: dropdownCoords.left,
          width: dropdownCoords.width
        }}
      >
        <div className="p-2 border-b border-slate-100 shrink-0 bg-slate-50/30">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-7 pr-2.5 py-1 text-xs bg-white border border-slate-200 rounded focus:outline-none focus:border-slate-300 focus:ring-1 focus:ring-slate-100 transition-all"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
        <div className="overflow-auto py-1 flex-1 max-h-[220px] custom-scrollbar">
          {options.filter(option => {
            if (!searchQuery) return true;
            const optLabel = typeof option === 'object' ? option.label : option;
            return optLabel.toLowerCase().includes(searchQuery.toLowerCase());
          }).map((option) => {
            const isObject = typeof option === 'object';
            const optValue = isObject ? (option as any).value : option;
            const optLabel = isObject ? (option as any).label : option;
            const isSelected = selected.includes(optValue);
            return (
              <div 
                key={optValue}
                className={`flex items-center justify-between px-3 py-1.5 cursor-pointer transition-all text-xs ${
                  isSelected 
                    ? 'bg-slate-50 text-slate-900 font-medium' 
                    : 'text-slate-600 hover:bg-slate-50/50 hover:text-slate-900'
                }`}
                onClick={() => toggleOption(optValue)}
              >
                <span className="truncate pr-4">{optLabel}</span>
                {isSelected && <Check size={12} className="text-slate-800 stroke-[2.5]" />}
              </div>
            );
          })}
          {options.filter(option => {
            if (!searchQuery) return true;
            const optLabel = typeof option === 'object' ? option.label : option;
            return optLabel.toLowerCase().includes(searchQuery.toLowerCase());
          }).length === 0 && (
            <div className="py-4 text-center text-xs text-slate-500">
              No matching options found
            </div>
          )}
        </div>
      </div>,
      document.body
    );
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <div 
        className="flex min-h-[34px] w-full items-center justify-between rounded border border-slate-200 bg-white px-2.5 py-1 text-xs cursor-pointer transition-all hover:border-slate-300 hover:shadow-[0_1px_2px_rgba(0,0,0,0.02)] focus-within:border-slate-400 focus-within:ring-1 focus-within:ring-slate-100"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex flex-wrap gap-1 items-center flex-1 min-w-0 py-0.5">
          {selected.length === 0 ? (
            <span className="text-slate-400 select-none truncate">{placeholder}</span>
          ) : (
            selected.map(val => {
              const opt = options.find(o => (typeof o === 'object' ? o.value : o) === val);
              const label = typeof opt === 'object' ? opt.label : val;
              return (
                <span 
                  key={val} 
                  className="inline-flex items-center gap-1 bg-slate-50 text-slate-600 text-[11px] font-medium px-2 py-0.5 rounded border border-slate-100 transition-all hover:bg-slate-100 hover:text-slate-900"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleOption(val);
                  }}
                >
                  <span className="truncate max-w-[120px]">{label}</span>
                  <X size={10} className="hover:text-red-500 transition-colors shrink-0 ml-0.5 stroke-[2.5]" />
                </span>
              );
            })
          )}
        </div>
        <div className="flex items-center shrink-0 ml-2 gap-1">
          {selected.length > 0 && (
            <button
              onClick={clearAll}
              className="text-slate-400 hover:text-slate-600 transition-colors p-0.5 rounded hover:bg-slate-50"
              title="Clear all"
            >
              <X size={12} className="stroke-[2.5]" />
            </button>
          )}
          <ChevronDown size={14} className={`text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {renderDropdown()}
    </div>
  );
};
