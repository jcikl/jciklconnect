import React from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { Button } from './Button';
import { Input } from './Form';

interface ModuleToolbarProps {
  searchValue?: string;
  searchPlaceholder?: string;
  onSearchChange?: (value: string) => void;
  onClearSearch?: () => void;
  leftContent?: React.ReactNode;
  actions?: React.ReactNode;
  filterLabel?: string;
  onFilterClick?: () => void;
  className?: string;
  searchClassName?: string;
}

export const ModuleToolbar: React.FC<ModuleToolbarProps> = ({
  searchValue,
  searchPlaceholder = 'Search...',
  onSearchChange,
  onClearSearch,
  leftContent,
  actions,
  filterLabel = 'Filters',
  onFilterClick,
  className = '',
  searchClassName = '',
}) => {
  const showSearch = typeof searchValue === 'string' && onSearchChange;

  return (
    <div className={`flex flex-col gap-3 md:flex-row md:items-center md:justify-between ${className}`}>
      <div className="flex min-w-0 flex-1 flex-col gap-3 md:flex-row md:items-center">
        {showSearch && (
          <div className={`relative min-w-0 md:max-w-md md:flex-1 ${searchClassName}`}>
            <Input
              icon={<Search size={14} />}
              placeholder={searchPlaceholder}
              value={searchValue}
              onChange={(event) => onSearchChange(event.target.value)}
              className={searchValue ? 'pr-10' : ''}
            />
            {searchValue && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={onClearSearch ?? (() => onSearchChange(''))}
                className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            )}
          </div>
        )}
        {leftContent}
      </div>

      {(onFilterClick || actions) && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {onFilterClick && (
            <Button type="button" variant="outline" size="sm" onClick={onFilterClick}>
              <SlidersHorizontal size={14} className="mr-1.5" />
              {filterLabel}
            </Button>
          )}
          {actions}
        </div>
      )}
    </div>
  );
};

export type { ModuleToolbarProps };
