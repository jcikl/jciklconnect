// Reusable Data Table Component
import React, { useMemo, useState } from 'react';
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

  const paginatedData = useMemo(() => {
    if (!pagination) return data;
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return data.slice(startIndex, endIndex);
  }, [data, currentPage, itemsPerPage, pagination]);

  const totalPages = useMemo(() => {
    if (!pagination) return 1;
    return Math.ceil(data.length / itemsPerPage);
  }, [data.length, itemsPerPage, pagination]);

  // Reset to page 1 when data changes or items per page changes
  React.useEffect(() => {
    if (pagination && currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [data.length, itemsPerPage, totalPages, pagination, currentPage]);

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
                    {column.header}
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
      
      {pagination && data.length > 0 && (
        <div className="mt-4">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={data.length}
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

