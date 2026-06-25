import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Search } from 'lucide-react';

interface MultiSelectProps {
  options: readonly string[] | string[] | { label: string; value: string }[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  className?: string;
}

export const MultiSelectDropdown: React.FC<MultiSelectProps> = ({ options, selected, onChange, placeholder = "Select...", className = "" }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dropdownPosition, setDropdownPosition] = useState<'bottom' | 'top'>('bottom');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
    } else if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const dropdownHeight = 320; // max-h-80 is 320px
      
      if (spaceBelow < dropdownHeight && spaceAbove > spaceBelow) {
        setDropdownPosition('top');
      } else {
        setDropdownPosition('bottom');
      }
    }
  }, [isOpen]);

  const toggleOption = (opt: string) => {
    if (selected.includes(opt)) {
      onChange(selected.filter(s => s !== opt));
    } else {
      onChange([...selected, opt]);
    }
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <div 
        className="flex min-h-[38px] w-full items-center justify-between rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm cursor-pointer focus-within:border-jci-blue focus-within:ring-2 focus-within:ring-jci-blue/20"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex flex-wrap gap-1 items-center flex-1 min-w-0">
          {selected.length === 0 ? (
            <span className="text-slate-400 truncate">{placeholder}</span>
          ) : (
            <span className="text-slate-800 truncate">
              {(() => {
                const labels = selected.map(val => {
                  const opt = options.find(o => (typeof o === 'object' ? o.value : o) === val);
                  return typeof opt === 'object' ? opt.label : val;
                });
                if (labels.length <= 1) return labels.join(', ');
                return `${labels[0]} +${labels.length - 1}`;
              })()}
            </span>
          )}
        </div>
        <ChevronDown size={16} className="text-slate-400 shrink-0 ml-2" />
      </div>

      {isOpen && (
        <div className={`absolute z-50 w-full flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg max-h-80 ${dropdownPosition === 'top' ? 'bottom-full mb-1' : 'top-full mt-1'}`}>
          <div className="p-2 border-b border-slate-100 shrink-0">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-jci-blue/20 focus:border-jci-blue"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>
          <div className="overflow-auto py-1 flex-1">
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
                  className="flex items-center px-3 py-2 cursor-pointer hover:bg-slate-50 text-sm text-slate-700"
                  onClick={() => toggleOption(optValue)}
                >
                  <div className={`mr-2 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${isSelected ? 'bg-jci-blue border-jci-blue' : 'border-slate-300'}`}>
                    {isSelected && <Check size={12} className="text-white" />}
                  </div>
                  <span className="truncate">{optLabel}</span>
                </div>
              );
            })}
            {options.filter(option => {
              if (!searchQuery) return true;
              const optLabel = typeof option === 'object' ? option.label : option;
              return optLabel.toLowerCase().includes(searchQuery.toLowerCase());
            }).length === 0 && (
              <div className="py-3 text-center text-sm text-slate-500">
                No matching options found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
