import React, { useMemo, useState } from 'react';
import { DollarSign, RefreshCw, TrendingDown } from 'lucide-react';
import { Badge, Button, useToast } from '../../ui/Common';
import { LoadingState } from '../../ui/Loading';
import type { InventoryItem } from '../../../types';
import { formatDate } from '../../../utils/dateUtils';
import { formatCurrency } from '../../../utils/formatUtils';

interface InventoryDepreciationTabProps {
  items: InventoryItem[];
  loading: boolean;
  canOperateFinance: boolean;
  onUpdateDepreciation: (itemId: string) => Promise<void>;
}

export const InventoryDepreciationTab: React.FC<InventoryDepreciationTabProps> = ({
  items,
  loading,
  canOperateFinance,
  onUpdateDepreciation,
}) => {
  const { showToast } = useToast();
  const [updatingItems, setUpdatingItems] = useState<Set<string>>(new Set());

  const itemsWithDepreciation = useMemo(() => {
    return items.filter(item => item.purchasePrice && item.purchaseDate);
  }, [items]);

  const handleUpdateDepreciation = async (itemId: string) => {
    setUpdatingItems(prev => new Set(prev).add(itemId));
    try {
      await onUpdateDepreciation(itemId);
    } catch (err) {
      showToast('Failed to update depreciation', 'error');
    } finally {
      setUpdatingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });
    }
  };

  const handleUpdateAllDepreciation = async () => {
    setUpdatingItems(new Set(itemsWithDepreciation.map(item => item.id)));
    try {
      await Promise.all(itemsWithDepreciation.map(item => onUpdateDepreciation(item.id)));
      showToast('All depreciation values updated successfully', 'success');
    } catch (err) {
      showToast('Failed to update some depreciation values', 'error');
    } finally {
      setUpdatingItems(new Set());
    }
  };

  const totalPurchaseValue = itemsWithDepreciation.reduce((sum, item) => sum + (item.purchasePrice || 0), 0);
  const totalCurrentValue = itemsWithDepreciation.reduce((sum, item) => sum + (item.currentValue || item.purchasePrice || 0), 0);
  const totalDepreciation = totalPurchaseValue - totalCurrentValue;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base md:text-lg font-bold text-slate-900">Depreciation Tracking</h3>
          <p className="text-xs text-slate-500 mt-0.5">Track asset depreciation and current book values</p>
        </div>
        {canOperateFinance && itemsWithDepreciation.length > 0 && (
          <Button variant="outline" size="sm" onClick={handleUpdateAllDepreciation} disabled={updatingItems.size > 0}>
            <RefreshCw size={14} className={`mr-1.5 ${updatingItems.size > 0 ? 'animate-spin' : ''}`} />
            {updatingItems.size > 0 ? 'Updating...' : 'Update All'}
          </Button>
        )}
      </div>

      {itemsWithDepreciation.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 md:gap-3">
          {[
            { label: 'Purchase Value', value: formatCurrency(totalPurchaseValue), icon: <DollarSign size={16} />, color: 'blue' },
            { label: 'Current Value', value: formatCurrency(totalCurrentValue), icon: <TrendingDown size={16} />, color: 'green' },
            { label: 'Depreciated', value: formatCurrency(totalDepreciation), icon: <TrendingDown size={16} />, color: totalDepreciation > 0 ? 'red' : 'slate' },
          ].map(({ label, value, icon, color }) => (
            <div key={label} className="bg-white rounded-xl border border-slate-100 shadow-sm p-2.5 md:p-3.5">
              <div className="flex items-center gap-2 md:gap-3">
                <div className={`w-8 h-8 md:w-9 md:h-9 rounded-lg bg-${color}-50 border border-${color}-100 flex items-center justify-center text-${color}-600 shrink-0`}>
                  {icon}
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] md:text-[10px] text-slate-500 font-semibold uppercase tracking-wide leading-none">{label}</p>
                  <p className="text-sm md:text-base font-bold text-slate-900 leading-tight mt-0.5 tabular-nums truncate">{value}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <LoadingState loading={loading} error={null} empty={false}>
        {itemsWithDepreciation.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-100 py-12 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
              <TrendingDown size={22} className="text-slate-400" />
            </div>
            <p className="text-sm font-semibold text-slate-600">No depreciation data</p>
            <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">Add a purchase price and purchase date to an inventory item to start tracking its depreciation.</p>
          </div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-100">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
                  <tr>
                    <th className="py-2.5 px-3 font-semibold text-xs">Item</th>
                    <th className="py-2.5 px-3 font-semibold text-xs whitespace-nowrap">Purchase Date</th>
                    <th className="py-2.5 px-3 font-semibold text-xs whitespace-nowrap">Purchase Price</th>
                    <th className="py-2.5 px-3 font-semibold text-xs">Method</th>
                    <th className="py-2.5 px-3 font-semibold text-xs whitespace-nowrap">Current Value</th>
                    <th className="py-2.5 px-3 font-semibold text-xs">Depreciated</th>
                    <th className="py-2.5 px-3 font-semibold text-xs text-center">Loss %</th>
                    <th className="py-2.5 px-3 font-semibold text-xs text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {itemsWithDepreciation.map(item => {
                    const depreciationAmount = (item.purchasePrice || 0) - (item.currentValue || item.purchasePrice || 0);
                    const depreciationPercent = item.purchasePrice ? (depreciationAmount / item.purchasePrice) * 100 : 0;
                    const isUpdating = updatingItems.has(item.id);
                    const pctColor = depreciationPercent > 50 ? 'text-red-600' : depreciationPercent > 25 ? 'text-amber-600' : 'text-green-600';
                    const barColor = depreciationPercent > 50 ? 'bg-red-400' : depreciationPercent > 25 ? 'bg-amber-400' : 'bg-green-400';
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-2.5 px-3 font-semibold text-xs text-slate-900">{item.name}</td>
                        <td className="py-2.5 px-3 text-xs text-slate-500 whitespace-nowrap">{item.purchaseDate ? formatDate(new Date(item.purchaseDate)) : '—'}</td>
                        <td className="py-2.5 px-3 text-xs font-semibold text-slate-700 tabular-nums">{formatCurrency(item.purchasePrice || 0)}</td>
                        <td className="py-2.5 px-3">
                          <Badge variant="neutral" className="text-[10px]">{item.depreciationMethod || 'None'}</Badge>
                        </td>
                        <td className="py-2.5 px-3 text-xs font-semibold text-green-600 tabular-nums">{formatCurrency(item.currentValue || item.purchasePrice || 0)}</td>
                        <td className="py-2.5 px-3 text-xs text-red-600 tabular-nums">{formatCurrency(depreciationAmount)}</td>
                        <td className="py-2.5 px-3">
                          <div className="flex flex-col items-center gap-1">
                            <span className={`text-xs font-bold tabular-nums ${pctColor}`}>{depreciationPercent.toFixed(1)}%</span>
                            <div className="w-14 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.min(depreciationPercent, 100)}%` }} />
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {canOperateFinance && (
                            <button
                              onClick={() => handleUpdateDepreciation(item.id)}
                              disabled={isUpdating}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-40 transition-colors"
                              title="Recalculate depreciation"
                            >
                              <RefreshCw size={13} className={isUpdating ? 'animate-spin' : ''} />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="md:hidden space-y-2">
              {itemsWithDepreciation.map(item => {
                const depreciationAmount = (item.purchasePrice || 0) - (item.currentValue || item.purchasePrice || 0);
                const depreciationPercent = item.purchasePrice ? (depreciationAmount / item.purchasePrice) * 100 : 0;
                const isUpdating = updatingItems.has(item.id);
                const pctColor = depreciationPercent > 50 ? 'text-red-600' : depreciationPercent > 25 ? 'text-amber-600' : 'text-green-600';
                const barColor = depreciationPercent > 50 ? 'bg-red-400' : depreciationPercent > 25 ? 'bg-amber-400' : 'bg-green-400';
                return (
                  <div key={item.id} className="relative bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${barColor}`} />
                    <div className="pl-4 pr-3 py-3">
                      <div className="flex items-start justify-between gap-2 mb-2.5">
                        <div>
                          <p className="text-sm font-semibold text-slate-900 leading-tight">{item.name}</p>
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            <Badge variant="neutral" className="text-[10px]">{item.depreciationMethod || 'None'}</Badge>
                            {item.purchaseDate && (
                              <span className="text-[10px] text-slate-400">Bought {formatDate(new Date(item.purchaseDate))}</span>
                            )}
                          </div>
                        </div>
                        {canOperateFinance && (
                          <button
                            onClick={() => handleUpdateDepreciation(item.id)}
                            disabled={isUpdating}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-40 transition-colors shrink-0"
                            title="Recalculate"
                          >
                            <RefreshCw size={13} className={isUpdating ? 'animate-spin' : ''} />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-center mb-2.5">
                        <div className="bg-slate-50 rounded-lg py-1.5 px-1">
                          <p className="text-[9px] text-slate-400 font-semibold uppercase tracking-wide">Purchase</p>
                          <p className="text-xs font-bold text-slate-700 tabular-nums">{formatCurrency(item.purchasePrice || 0)}</p>
                        </div>
                        <div className="bg-green-50 rounded-lg py-1.5 px-1">
                          <p className="text-[9px] text-green-500 font-semibold uppercase tracking-wide">Current</p>
                          <p className="text-xs font-bold text-green-700 tabular-nums">{formatCurrency(item.currentValue || item.purchasePrice || 0)}</p>
                        </div>
                        <div className="bg-red-50 rounded-lg py-1.5 px-1">
                          <p className="text-[9px] text-red-400 font-semibold uppercase tracking-wide">Lost</p>
                          <p className="text-xs font-bold text-red-600 tabular-nums">{formatCurrency(depreciationAmount)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.min(depreciationPercent, 100)}%` }} />
                        </div>
                        <span className={`text-[11px] font-bold tabular-nums ${pctColor}`}>{depreciationPercent.toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </LoadingState>
    </div>
  );
};
