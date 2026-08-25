import React from 'react';
import { DollarSign, Package, TrendingDown } from 'lucide-react';
import { Badge } from '../../ui/Common';
import type { InventoryItem, Transaction } from '../../../types';
import { formatDate } from '../../../utils/dateUtils';
import { formatCurrency } from '../../../utils/formatUtils';

interface InventoryFinancialHistoryTabProps {
  transactions: Transaction[];
  items: InventoryItem[];
}

export const InventoryFinancialHistoryTab: React.FC<InventoryFinancialHistoryTabProps> = ({ transactions, items }) => {
  const linkedTransactions = React.useMemo(() => {
    return transactions.filter(tx => tx.inventoryLinkId).sort((a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [transactions]);

  const totalIn = linkedTransactions.filter(tx => tx.type === 'Expense').reduce((s, tx) => s + tx.amount, 0);
  const totalOut = linkedTransactions.filter(tx => tx.type === 'Income').reduce((s, tx) => s + tx.amount, 0);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base md:text-lg font-bold text-slate-900">Inventory Transaction History</h3>
        <p className="text-xs text-slate-500 mt-0.5">Financial transactions linked to inventory items</p>
      </div>

      {linkedTransactions.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 md:gap-3">
          {[
            { label: 'Total Transactions', value: String(linkedTransactions.length), icon: <Package size={16} />, color: 'blue' },
            { label: 'Total Restocked', value: formatCurrency(totalIn), icon: <TrendingDown size={16} />, color: 'green' },
            { label: 'Total Sales', value: formatCurrency(totalOut), icon: <DollarSign size={16} />, color: 'amber' },
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

      {linkedTransactions.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-100 py-12 text-center">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
            <Package size={22} className="text-slate-400" />
          </div>
          <p className="text-sm font-semibold text-slate-600">No linked transactions</p>
          <p className="text-xs text-slate-400 mt-1">Financial transactions linked to inventory items will appear here.</p>
        </div>
      ) : (
        <>
          <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
                <tr>
                  <th className="py-2.5 px-3 font-semibold text-xs whitespace-nowrap">Date</th>
                  <th className="py-2.5 px-3 font-semibold text-xs">Item</th>
                  <th className="py-2.5 px-3 font-semibold text-xs">Action</th>
                  <th className="py-2.5 px-3 font-semibold text-xs">Variant</th>
                  <th className="py-2.5 px-3 font-semibold text-xs text-center">Qty</th>
                  <th className="py-2.5 px-3 font-semibold text-xs text-right">Amount</th>
                  <th className="py-2.5 px-3 font-semibold text-xs text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {linkedTransactions.map(tx => {
                  const item = items.find(i => i.id === tx.inventoryLinkId);
                  const isStockIn = tx.type === 'Expense';
                  const rowColor = isStockIn ? 'border-l-green-400' : 'border-l-amber-400';
                  return (
                    <tr key={tx.id} className={`border-l-2 ${rowColor} hover:bg-slate-50/60 transition-colors`}>
                      <td className="py-2.5 px-3 text-xs text-slate-500 whitespace-nowrap">{formatDate(new Date(tx.date))}</td>
                      <td className="py-2.5 px-3 text-xs font-semibold text-slate-900 max-w-[160px] truncate">{item?.name || 'Unknown Item'}</td>
                      <td className="py-2.5 px-3">
                        <Badge variant={isStockIn ? 'success' : 'warning'} className="text-[10px]">
                          {isStockIn ? 'Restock' : 'Sale'}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 text-xs text-slate-400">{tx.inventoryVariant || '—'}</td>
                      <td className={`py-2.5 px-3 text-xs font-bold text-center tabular-nums ${isStockIn ? 'text-green-600' : 'text-amber-600'}`}>
                        {isStockIn ? '+' : '-'}{tx.inventoryQuantity || 0}
                      </td>
                      <td className="py-2.5 px-3 text-xs font-semibold text-slate-900 text-right tabular-nums">{formatCurrency(tx.amount)}</td>
                      <td className="py-2.5 px-3 text-right">
                        <Badge variant={tx.status === 'Cleared' ? 'success' : tx.status === 'Pending' ? 'warning' : 'neutral'} className="text-[10px]">
                          {tx.status}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="md:hidden space-y-2">
            {linkedTransactions.map(tx => {
              const item = items.find(i => i.id === tx.inventoryLinkId);
              const isStockIn = tx.type === 'Expense';
              const barColor = isStockIn ? 'bg-green-400' : 'bg-amber-400';
              return (
                <div key={tx.id} className="relative bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                  <div className={`absolute left-0 top-0 bottom-0 w-1 ${barColor}`} />
                  <div className="pl-4 pr-3 py-3">
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <p className="text-sm font-semibold text-slate-900 leading-tight truncate">{item?.name || 'Unknown Item'}</p>
                      <p className="text-sm font-bold text-slate-900 tabular-nums shrink-0">{formatCurrency(tx.amount)}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] text-slate-400">{formatDate(new Date(tx.date))}</span>
                      <Badge variant={isStockIn ? 'success' : 'warning'} className="text-[10px]">
                        {isStockIn ? 'Restock' : 'Sale'}
                      </Badge>
                      {tx.inventoryVariant && (
                        <span className="text-[11px] text-slate-400">{tx.inventoryVariant}</span>
                      )}
                      <span className={`text-[11px] font-bold tabular-nums ${isStockIn ? 'text-green-600' : 'text-amber-600'}`}>
                        {isStockIn ? '+' : '-'}{tx.inventoryQuantity || 0} units
                      </span>
                      <Badge variant={tx.status === 'Cleared' ? 'success' : tx.status === 'Pending' ? 'warning' : 'neutral'} className="text-[10px] ml-auto">
                        {tx.status}
                      </Badge>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};
