import React from 'react';
import { Edit, History, LogIn, LogOut, RefreshCw } from 'lucide-react';
import { Badge, ModuleToolbar } from '../../ui/Common';
import { Pagination } from '../../ui/Pagination';
import { LoadingState } from '../../ui/Loading';
import type { InventoryItem, Member } from '../../../types';
import { formatCurrency } from '../../../utils/formatUtils';

interface InventoryItemsTabProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  loading: boolean;
  error: string | null;
  filteredItems: InventoryItem[];
  paginatedItems: InventoryItem[];
  members: Member[];
  canOperateFinance: boolean;
  currentPage: number;
  totalPages: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  onCheckIn: (itemId: string) => void;
  onCheckOut: (item: InventoryItem) => void;
  onAdjustStock: (item: InventoryItem) => void;
  onEdit: (item: InventoryItem) => void;
  onOpenStockCard: (item: InventoryItem) => void;
}

const getStatusBadgeVariant = (status: InventoryItem['status']) =>
  status === 'Available' ? 'success' : status === 'Out of Stock' ? 'error' : 'warning';

const getCustodianName = (item: InventoryItem, members: Member[], fallback: string | null) => {
  if (!item.custodian) return fallback;
  return members.find(m => m.id === item.custodian)?.general?.name || item.custodian;
};

export const InventoryItemsTab: React.FC<InventoryItemsTabProps> = ({
  searchTerm,
  onSearchChange,
  loading,
  error,
  filteredItems,
  paginatedItems,
  members,
  canOperateFinance,
  currentPage,
  totalPages,
  itemsPerPage,
  onPageChange,
  onCheckIn,
  onCheckOut,
  onAdjustStock,
  onEdit,
  onOpenStockCard,
}) => (
  <div className="space-y-3">
    <ModuleToolbar
      searchValue={searchTerm}
      searchPlaceholder="Search by name, category, location…"
      onSearchChange={onSearchChange}
    />

    <LoadingState loading={loading} error={error} empty={filteredItems.length === 0} emptyMessage="No inventory items found">
      <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-100">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
            <tr>
              <th className="py-2.5 px-3 font-semibold text-xs">Item</th>
              <th className="py-2.5 px-3 font-semibold text-xs whitespace-nowrap">Category</th>
              <th className="py-2.5 px-3 font-semibold text-xs whitespace-nowrap">Location</th>
              <th className="py-2.5 px-3 font-semibold text-xs text-center whitespace-nowrap">Qty</th>
              <th className="py-2.5 px-3 font-semibold text-xs whitespace-nowrap">Status</th>
              <th className="py-2.5 px-3 font-semibold text-xs whitespace-nowrap">Custodian</th>
              <th className="py-2.5 px-3 font-semibold text-xs whitespace-nowrap">Value</th>
              <th className="py-2.5 px-3 font-semibold text-xs text-right whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginatedItems.map(item => {
              const rowColor = item.status === 'Available' ? 'border-l-green-400' : item.status === 'Checked Out' ? 'border-l-amber-400' : 'border-l-red-400';
              const custodianName = getCustodianName(item, members, '—');
              return (
                <tr key={item.id} className={`border-l-2 ${rowColor} hover:bg-slate-50/60 transition-colors`}>
                  <td className="py-2.5 px-3 max-w-[200px]">
                    <div className="font-semibold text-xs text-slate-900 truncate">{item.name}</div>
                    {item.variants && item.variants.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {item.variants.map((v, idx) => (
                          <span key={idx} className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                            {v.size}: {v.quantity}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-xs text-slate-500 whitespace-nowrap">{item.category}</td>
                  <td className="py-2.5 px-3 text-xs text-slate-500 whitespace-nowrap">{item.location || '—'}</td>
                  <td className="py-2.5 px-3 text-xs font-semibold text-slate-700 text-center">{item.quantity ?? 1}</td>
                  <td className="py-2.5 px-3">
                    <Badge variant={getStatusBadgeVariant(item.status)} className="text-[10px]">
                      {item.status}
                    </Badge>
                  </td>
                  <td className="py-2.5 px-3 text-xs text-slate-500 whitespace-nowrap max-w-[120px] truncate">{custodianName}</td>
                  <td className="py-2.5 px-3">
                    {item.currentValue !== undefined && item.purchasePrice !== undefined ? (
                      <div>
                        <div className="text-xs font-semibold text-green-600">{formatCurrency(item.currentValue)}</div>
                        <div className="text-[10px] text-slate-400">of {formatCurrency(item.purchasePrice)}</div>
                      </div>
                    ) : item.purchasePrice !== undefined ? (
                      <span className="text-xs text-slate-500">{formatCurrency(item.purchasePrice)}</span>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="flex justify-end items-center gap-0.5">
                      {canOperateFinance && item.status === 'Available' ? (
                        <button onClick={() => onCheckOut(item)} className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors whitespace-nowrap">
                          <LogOut size={11} /> Out
                        </button>
                      ) : canOperateFinance && item.status === 'Checked Out' ? (
                        <button onClick={() => onCheckIn(item.id)} className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg text-green-700 bg-green-50 hover:bg-green-100 transition-colors whitespace-nowrap">
                          <LogIn size={11} /> In
                        </button>
                      ) : null}
                      <button title="Stock Card" onClick={() => onOpenStockCard(item)} className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                        <History size={13} />
                      </button>
                      {canOperateFinance && (
                        <>
                          <button title="Adjust Stock" onClick={() => onAdjustStock(item)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
                            <RefreshCw size={13} />
                          </button>
                          <button title="Edit" onClick={() => onEdit(item)} className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                            <Edit size={13} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="md:hidden space-y-2">
        {paginatedItems.map(item => {
          const barColor = item.status === 'Available' ? 'bg-green-400' : item.status === 'Checked Out' ? 'bg-amber-400' : 'bg-red-400';
          const custodianName = getCustodianName(item, members, null);
          return (
            <div key={item.id} className="relative bg-white border border-slate-100 rounded-xl overflow-hidden shadow-sm">
              <div className={`absolute left-0 top-0 bottom-0 w-1 ${barColor}`} />
              <div className="pl-4 pr-3 pt-3 pb-3">
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <span className="font-semibold text-slate-900 text-sm leading-snug">{item.name}</span>
                  <Badge variant={getStatusBadgeVariant(item.status)} className="text-[10px] shrink-0">
                    {item.status}
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500 mb-1.5">
                  <span>{item.category}</span>
                  {item.location && <><span className="text-slate-300">·</span><span>{item.location}</span></>}
                  <span className="text-slate-300">·</span>
                  <span>Qty <span className="font-semibold text-slate-700">{item.quantity ?? 1}</span></span>
                  {item.purchasePrice !== undefined && (
                    <><span className="text-slate-300">·</span><span className="font-medium text-slate-600">{formatCurrency(item.currentValue ?? item.purchasePrice)}</span></>
                  )}
                </div>
                {item.variants && item.variants.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {item.variants.map((v, idx) => (
                      <span key={idx} className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                        {v.size}: {v.quantity}
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex items-center justify-between gap-2 mt-2">
                  <span className="text-[11px] text-slate-400 truncate">{custodianName || ''}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    {canOperateFinance && item.status === 'Available' ? (
                      <button onClick={() => onCheckOut(item)} className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 transition-colors">
                        <LogOut size={11} /> Out
                      </button>
                    ) : canOperateFinance && item.status === 'Checked Out' ? (
                      <button onClick={() => onCheckIn(item.id)} className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg text-green-700 bg-green-50 border border-green-200 hover:bg-green-100 transition-colors">
                        <LogIn size={11} /> In
                      </button>
                    ) : null}
                    <button title="Stock Card" onClick={() => onOpenStockCard(item)} className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                      <History size={13} />
                    </button>
                    {canOperateFinance && (
                      <>
                        <button title="Adjust" onClick={() => onAdjustStock(item)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
                          <RefreshCw size={13} />
                        </button>
                        <button title="Edit" onClick={() => onEdit(item)} className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                          <Edit size={13} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div className="mt-4">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredItems.length}
            itemsPerPage={itemsPerPage}
            onPageChange={onPageChange}
          />
        </div>
      )}
    </LoadingState>
  </div>
);
