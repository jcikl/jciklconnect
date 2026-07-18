import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Button } from './Common';

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  onItemsPerPageChange?: (itemsPerPage: number) => void;
  showItemsPerPage?: boolean;
  className?: string;
}

// ── Shared helpers ────────────────────────────────────────────────

const PER_PAGE_OPTIONS = [10, 20, 50, 100];

function buildPageNumbers(currentPage: number, totalPages: number): (number | '...')[] {
  const pages: (number | '...')[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (currentPage <= 3) {
      for (let i = 2; i <= 4; i++) pages.push(i);
      pages.push('...');
      pages.push(totalPages);
    } else if (currentPage >= totalPages - 2) {
      pages.push('...');
      for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push('...');
      for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
      pages.push('...');
      pages.push(totalPages);
    }
  }
  return pages;
}

interface NavButtonsProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (p: number) => void;
  iconSize?: number;
}

const NavButtons: React.FC<NavButtonsProps> = ({ currentPage, totalPages, onPageChange, iconSize = 16 }) => (
  <>
    <Button variant="ghost" size="sm" onClick={() => onPageChange(1)} disabled={currentPage === 1} className="px-2" title="First page">
      <ChevronsLeft size={iconSize} />
    </Button>
    <Button variant="ghost" size="sm" onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1} className="px-2" title="Previous page">
      <ChevronLeft size={iconSize} />
    </Button>
  </>
);

const NavButtonsRight: React.FC<NavButtonsProps> = ({ currentPage, totalPages, onPageChange, iconSize = 16 }) => (
  <>
    <Button variant="ghost" size="sm" onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages} className="px-2" title="Next page">
      <ChevronRight size={iconSize} />
    </Button>
    <Button variant="ghost" size="sm" onClick={() => onPageChange(totalPages)} disabled={currentPage === totalPages} className="px-2" title="Last page">
      <ChevronsRight size={iconSize} />
    </Button>
  </>
);

interface PerPageSelectProps {
  value: number;
  onChange: (v: number) => void;
  className?: string;
}

const PerPageSelect: React.FC<PerPageSelectProps> = ({ value, onChange, className = '' }) => (
  <select
    value={value}
    onChange={(e) => onChange(parseInt(e.target.value))}
    className={`border rounded-lg focus:outline-none focus:ring-2 focus:ring-jci-blue bg-white ${className}`}
  >
    {PER_PAGE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
  </select>
);

// ── Mobile layout ─────────────────────────────────────────────────

interface MobilePaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (p: number) => void;
  onItemsPerPageChange?: (v: number) => void;
  showItemsPerPage: boolean;
}

const MobilePagination: React.FC<MobilePaginationProps> = ({
  currentPage, totalPages, totalItems, itemsPerPage, onPageChange, onItemsPerPageChange, showItemsPerPage,
}) => (
  <div className="flex sm:hidden flex-col gap-2">
    <div className="flex items-center justify-between text-xs text-slate-500">
      <span><span className="font-semibold text-slate-800">{totalItems}</span> items</span>
      {showItemsPerPage && onItemsPerPageChange && (
        <div className="flex items-center gap-1.5">
          <span>Per page:</span>
          <PerPageSelect value={itemsPerPage} onChange={onItemsPerPageChange} className="px-2 py-1 text-xs border-slate-200" />
        </div>
      )}
    </div>
    {totalPages > 1 && (
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <NavButtons currentPage={currentPage} totalPages={totalPages} onPageChange={onPageChange} iconSize={15} />
        </div>
        <span className="text-sm font-semibold text-slate-700 tabular-nums">
          {currentPage} <span className="text-slate-400 font-normal">/ {totalPages}</span>
        </span>
        <div className="flex items-center gap-1">
          <NavButtonsRight currentPage={currentPage} totalPages={totalPages} onPageChange={onPageChange} iconSize={15} />
        </div>
      </div>
    )}
  </div>
);

// ── Desktop layout ────────────────────────────────────────────────

interface DesktopPaginationProps extends MobilePaginationProps {
  startItem: number;
  endItem: number;
}

const DesktopPagination: React.FC<DesktopPaginationProps> = ({
  currentPage, totalPages, totalItems, itemsPerPage, startItem, endItem,
  onPageChange, onItemsPerPageChange, showItemsPerPage,
}) => (
  <div className="hidden sm:flex items-center justify-between gap-4">
    <div className="flex items-center gap-2 text-sm text-slate-600">
      <span>
        Showing <span className="font-semibold text-slate-900">{startItem}</span> –{' '}
        <span className="font-semibold text-slate-900">{endItem}</span> of{' '}
        <span className="font-semibold text-slate-900">{totalItems}</span> items
      </span>
      {showItemsPerPage && onItemsPerPageChange && (
        <div className="flex items-center gap-2 ml-4">
          <span>Items per page:</span>
          <PerPageSelect value={itemsPerPage} onChange={onItemsPerPageChange} className="px-2 py-1 text-sm border-slate-300" />
        </div>
      )}
    </div>
    {totalPages > 1 && (
      <div className="flex items-center gap-1">
        <NavButtons currentPage={currentPage} totalPages={totalPages} onPageChange={onPageChange} />
        <div className="flex items-center gap-1 mx-2">
          {buildPageNumbers(currentPage, totalPages).map((page, i) =>
            page === '...'
              ? <span key={`e-${i}`} className="px-2 text-slate-400">...</span>
              : (
                <Button
                  key={page}
                  variant={currentPage === page ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => onPageChange(page)}
                  className={`min-w-[2.5rem] ${currentPage === page ? 'bg-jci-blue text-white' : 'text-slate-700 hover:bg-slate-100'}`}
                >
                  {page}
                </Button>
              )
          )}
        </div>
        <NavButtonsRight currentPage={currentPage} totalPages={totalPages} onPageChange={onPageChange} />
      </div>
    )}
  </div>
);

// ── Public component ──────────────────────────────────────────────

export const Pagination: React.FC<PaginationProps> = ({
  currentPage, totalPages, totalItems, itemsPerPage,
  onPageChange, onItemsPerPageChange, showItemsPerPage = true, className = '',
}) => {
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  if (totalPages <= 1 && !showItemsPerPage) return null;

  const shared = { currentPage, totalPages, totalItems, itemsPerPage, onPageChange, onItemsPerPageChange, showItemsPerPage };

  return (
    <div className={className}>
      <MobilePagination {...shared} />
      <DesktopPagination {...shared} startItem={startItem} endItem={endItem} />
    </div>
  );
};

