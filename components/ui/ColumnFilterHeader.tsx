import React, { useEffect, useRef, useState } from 'react';
import { Filter } from 'lucide-react';

export interface ColumnFilterOption {
  value: string;
  label: string;
  count?: number;
}

interface ColumnFilterHeaderProps {
  label: string;
  options: ColumnFilterOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  className?: string;
}

/** Minimal table column filter: ghost icon + light dropdown. */
export const ColumnFilterHeader: React.FC<ColumnFilterHeaderProps> = ({
  label,
  options,
  selected,
  onChange,
  className = '',
}) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const active = selected.length > 0;

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const toggle = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  return (
    <div ref={rootRef} className={`relative inline-flex items-center gap-1 ${className}`}>
      <span className="text-sm font-semibold text-slate-500">{label}</span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className={`relative inline-flex items-center justify-center rounded p-0.5 transition-colors ${
          open
            ? 'text-slate-800 bg-slate-100'
            : active
              ? 'text-slate-800'
              : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
        }`}
        aria-label={`Filter ${label}`}
        aria-expanded={open}
      >
        <Filter size={13} strokeWidth={2} />
        {active && (
          <span
            className="absolute -top-px -right-px h-1.5 w-1.5 rounded-full bg-slate-800"
            aria-hidden
          />
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1.5 min-w-[180px] rounded-md border border-slate-200/90 bg-white py-1 shadow-sm">
          {active && (
            <div className="px-2.5 py-1.5 border-b border-slate-100 flex justify-end">
              <button
                type="button"
                className="text-xs text-slate-500 hover:text-slate-800"
                onClick={() => onChange([])}
              >
                Clear
              </button>
            </div>
          )}
          <div className="max-h-52 overflow-y-auto">
            {options.map((opt) => (
              <label
                key={opt.value}
                className="flex items-center gap-2.5 px-2.5 py-1.5 hover:bg-slate-50 cursor-pointer text-sm text-slate-600"
              >
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 rounded border-slate-300 text-slate-800 focus:ring-slate-400 focus:ring-offset-0"
                  checked={selected.includes(opt.value)}
                  onChange={() => toggle(opt.value)}
                />
                <span className="leading-tight flex-1">{opt.label}</span>
                {opt.count !== undefined && (
                  <span className="text-xs text-slate-400 tabular-nums">{opt.count}</span>
                )}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ColumnFilterHeader;
