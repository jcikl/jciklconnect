// Reusable Data Table Component
import React, { useMemo, useState } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { Card } from './Common';
import { Pagination, PaginationProps } from './Pagination';

interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => React.ReactNode;
  sortable?: boolean;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  onRowClick?: (item: T) => void;
  loading?: boolean;
  emptyMessage?: string;
  className?: string;
  pagination?: boolean;
  itemsPerPage?: number;
  showItemsPerPageSelector?: boolean;
}

export function DataTable<T extends { id: string }>({
  data,
  columns,
  onRowClick,
  loading = false,
  emptyMessage = 'No data available',
  className = '',
  pagination = false,
  itemsPerPage: initialItemsPerPage = 10,
  showItemsPerPageSelector = true,
}: DataTableProps<T>) {
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(initialItemsPerPage);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setCurrentPage(1);
  };

  const sortedData = useMemo(() => {
    if (!sortKey) return data;
    return [...data].sort((a, b) => {
      const av = (a as any)[sortKey];
      const bv = (b as any)[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [data, sortKey, sortDir]);

  const paginatedData = useMemo(() => {
    if (!pagination) return sortedData;
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return sortedData.slice(startIndex, endIndex);
  }, [sortedData, currentPage, itemsPerPage, pagination]);

  const totalPages = useMemo(() => {
    if (!pagination) return 1;
    return Math.ceil(sortedData.length / itemsPerPage);
  }, [sortedData.length, itemsPerPage, pagination]);

  // Reset to page 1 when data changes or items per page changes
  React.useEffect(() => {
    if (pagination && currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [sortedData.length, itemsPerPage, totalPages, pagination, currentPage]);

  if (loading) {
    return (
      <Card>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-jci-blue"></div>
        </div>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card>
        <div className="text-center py-12 text-slate-500">
          {emptyMessage}
        </div>
      </Card>
    );
  }

  return (
    <div className={className}>
      <Card noPadding>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/50">
                {columns.map((column) => (
                  <th
                    key={column.key}
                    className="px-6 py-4 text-sm font-semibold text-slate-500"
                  >
                    {column.sortable ? (
                      <button
                        type="button"
                        onClick={() => handleSort(column.key)}
                        className="flex items-center gap-1 hover:text-slate-700 transition-colors"
                      >
                        {column.header}
                        {sortKey === column.key ? (
                          sortDir === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                        ) : (
                          <ChevronDown size={14} className="opacity-30" />
                        )}
                      </button>
                    ) : column.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedData.map((item) => (
                <tr
                  key={item.id}
                  onClick={() => onRowClick?.(item)}
                  className={`hover:bg-slate-50 transition-colors ${
                    onRowClick ? 'cursor-pointer' : ''
                  }`}
                >
                  {columns.map((column) => (
                    <td key={column.key} className="px-6 py-4">
                      {column.render
                        ? column.render(item)
                        : (item as any)[column.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      
      {pagination && sortedData.length > 0 && (
        <div className="mt-4">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={sortedData.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={setItemsPerPage}
            showItemsPerPage={showItemsPerPageSelector}
          />
        </div>
      )}
    </div>
  );
}

