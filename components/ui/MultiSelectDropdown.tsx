import React, { useState, useRef, useEffect } from 'react';
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

  const clearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([]);
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <div 
        className="flex min-h-[42px] w-full items-center justify-between rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm cursor-pointer transition-all hover:border-slate-400 focus-within:border-jci-blue focus-within:ring-2 focus-within:ring-jci-blue/20"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex flex-wrap gap-1.5 items-center flex-1 min-w-0 py-0.5">
          {selected.length === 0 ? (
            <span className="text-slate-400 select-none truncate">{placeholder}</span>
          ) : (
            selected.map(val => {
              const opt = options.find(o => (typeof o === 'object' ? o.value : o) === val);
              const label = typeof opt === 'object' ? opt.label : val;
              return (
                <span 
                  key={val} 
                  className="inline-flex items-center gap-1 bg-jci-blue/10 text-jci-blue text-xs font-semibold px-2.5 py-1 rounded-full border border-jci-blue/20 transition-all hover:bg-jci-blue/20"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleOption(val);
                  }}
                >
                  {label}
                  <X size={10} className="hover:text-red-500 transition-colors shrink-0 ml-0.5 stroke-[3]" />
                </span>
              );
            })
          )}
        </div>
        <div className="flex items-center shrink-0 ml-2 gap-1.5">
          {selected.length > 0 && (
            <button
              onClick={clearAll}
              className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-full hover:bg-slate-100"
              title="Clear all"
            >
              <X size={14} className="stroke-[2.5]" />
            </button>
          )}
          <ChevronDown size={16} className={`text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {isOpen && (
        <div className={`absolute z-50 w-full flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl max-h-80 animate-in fade-in slide-in-from-top-2 duration-200 ${dropdownPosition === 'top' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'}`}>
          <div className="p-2.5 border-b border-slate-100 shrink-0 bg-slate-50/50">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input
                type="text"
                placeholder="Search options..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-jci-blue/20 focus:border-jci-blue transition-all"
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
                  className={`flex items-center justify-between px-3.5 py-2.5 cursor-pointer transition-all text-sm ${
                    isSelected 
                      ? 'bg-jci-blue/5 text-jci-blue font-semibold' 
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                  onClick={() => toggleOption(optValue)}
                >
                  <span className="truncate pr-4">{optLabel}</span>
                  <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-all ${
                    isSelected 
                      ? 'bg-jci-blue border-jci-blue scale-110 shadow-sm shadow-jci-blue/20' 
                      : 'border-slate-300 bg-white hover:border-slate-400'
                  }`}>
                    {isSelected && <Check size={11} className="text-white stroke-[3]" />}
                  </div>
                </div>
              );
            })}
            {options.filter(option => {
              if (!searchQuery) return true;
              const optLabel = typeof option === 'object' ? option.label : option;
              return optLabel.toLowerCase().includes(searchQuery.toLowerCase());
            }).length === 0 && (
              <div className="py-6 text-center text-sm text-slate-500">
                No matching options found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
