import React from 'react';
import { CreditCard, Plus, RefreshCw } from 'lucide-react';
import { Badge, Button } from '../../ui/Common';
import { CreateBillForm } from '../../shared/toyyib/CreateBillForm';
import { BillPaymentLink } from '../../shared/toyyib/BillPaymentLink';
import type { ToyyibBillRecord, ToyyibCategory } from '../../../services/toyyibService';
import { billStatusBadge, linkedLabel } from './toyyibUi';

type BillFilter = 'all' | '1' | '2' | '3';

interface ToyyibBillsTabProps {
  bills: ToyyibBillRecord[];
  categories: ToyyibCategory[];
  billFilter: BillFilter;
  showCreateBill: boolean;
  billCategoryCode: string;
  syncingBill: string | null;
  isRefreshing: boolean;
  onBillFilterChange: (filter: BillFilter) => void;
  onToggleCreateBill: () => void;
  onBillCategoryCodeChange: (categoryCode: string) => void;
  onRefresh: () => void;
  onSyncBillStatus: (billCode: string) => void;
  onCreateBillSuccess: () => void;
  onCreateBillError: (error: Error) => void;
}

const FILTERS: { key: BillFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: '2', label: 'Pending' },
  { key: '1', label: 'Paid' },
  { key: '3', label: 'Failed' },
];

export const ToyyibBillsTab: React.FC<ToyyibBillsTabProps> = ({
  bills,
  categories,
  billFilter,
  showCreateBill,
  billCategoryCode,
  syncingBill,
  isRefreshing,
  onBillFilterChange,
  onToggleCreateBill,
  onBillCategoryCodeChange,
  onRefresh,
  onSyncBillStatus,
  onCreateBillSuccess,
  onCreateBillError,
}) => {
  const filteredBills = billFilter === 'all'
    ? bills
    : bills.filter(b => {
      const s = b.billpaymentStatus ?? '2';
      if (billFilter === '1') return s === '1';
      if (billFilter === '3') return s === '3';
      return s === '2' || s === '4';
    });

  const catMap = Object.fromEntries(categories.map(c => [c.categoryCode, c]));
  const totalBillAmount = bills.reduce((sum, bill) => sum + (bill.billAmount || 0), 0);
  const paidBills = bills.filter(bill => bill.billpaymentStatus === '1');
  const failedBillCount = bills.filter(bill => bill.billpaymentStatus === '3').length;
  const pendingBillCount = bills.filter(bill => !bill.billpaymentStatus || bill.billpaymentStatus === '2' || bill.billpaymentStatus === '4').length;
  const createBillCat = categories.find(c => c.categoryCode === billCategoryCode);
  const createBillCatTag = createBillCat ? linkedLabel(createBillCat) : null;

  const filterCount = (filter: BillFilter) => {
    if (filter === '1') return paidBills.length;
    if (filter === '3') return failedBillCount;
    if (filter === '2') return pendingBillCount;
    return bills.length;
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2 md:gap-3">
        {[
          { label: 'Total Bills', value: String(bills.length) },
          { label: 'Total Amount', value: `RM ${totalBillAmount.toFixed(2)}` },
          { label: 'Paid', value: bills.length ? `${Math.round(paidBills.length / bills.length * 100)}%` : '0%' },
        ].map(stat => (
          <div key={stat.label} className="bg-white border border-slate-100 rounded-xl px-3 py-3 shadow-sm text-center">
            <p className="text-[10px] text-slate-400 uppercase font-semibold tracking-wide leading-tight">{stat.label}</p>
            <p className="font-bold text-slate-900 text-sm md:text-base mt-1 leading-tight">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <button
          className="w-full px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors"
          onClick={onToggleCreateBill}
        >
          <div className="flex items-center gap-3">
            <div className="h-7 w-7 rounded-lg bg-jci-blue/10 flex items-center justify-center flex-shrink-0">
              <Plus size={14} className="text-jci-blue" />
            </div>
            <div className="text-left">
              <p className="font-bold text-slate-900 text-sm leading-tight">Manual Bill</p>
              <p className="text-[11px] text-slate-400 leading-tight">Generate a payment link manually</p>
            </div>
          </div>
          <span className={`text-slate-400 text-xs font-medium transition-transform duration-200 ${showCreateBill ? 'rotate-180' : ''}`}>▾</span>
        </button>

        {showCreateBill && (
          <div className="border-t border-slate-100 p-5 space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Category</label>
              <select
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-jci-blue/30 focus:bg-white transition-colors"
                value={billCategoryCode}
                onChange={e => onBillCategoryCodeChange(e.target.value)}
              >
                <option value="">— Select a category —</option>
                {categories.map(category => {
                  const suffix = category.linkedType === 'membership'
                    ? ` · Membership`
                    : category.linkedProjectName ? ` · ${category.linkedProjectName}` : '';
                  return <option key={category.categoryCode} value={category.categoryCode}>{category.categoryName}{suffix}</option>;
                })}
              </select>
              {createBillCat && (
                <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${createBillCatTag ? createBillCatTag.color : 'bg-slate-50 text-slate-500'}`}>
                  {createBillCatTag ? <>{createBillCatTag.icon}<span>{createBillCatTag.text}</span></> : <span className="text-slate-400">No activity linked</span>}
                  <span className="mx-1 opacity-30">·</span>
                  <span className="font-mono opacity-60">{createBillCat.categoryCode}</span>
                </div>
              )}
            </div>

            {billCategoryCode ? (
              <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                <CreateBillForm
                  key={billCategoryCode}
                  categoryCode={billCategoryCode}
                  defaultBillName={createBillCat?.linkedType === 'membership'
                    ? `${new Date().getFullYear()} Renewal Membership`
                    : createBillCat?.linkedProjectName}
                  onSuccess={onCreateBillSuccess}
                  onError={onCreateBillError}
                />
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 py-6 text-center">
                <p className="text-xs text-slate-400">Select a category above to fill in bill details</p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-4 md:px-5 py-3.5 border-b border-slate-100 flex items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-slate-800 text-sm">Bills</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {filteredBills.length}{billFilter !== 'all' ? ` of ${bills.length}` : ''} bill{bills.length !== 1 ? 's' : ''}
            </p>
          </div>
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 border border-slate-200 rounded-lg flex-shrink-0" onClick={onRefresh} isLoading={isRefreshing} title="Refresh">
            <RefreshCw size={14} className="text-slate-500" />
          </Button>
        </div>

        <div className="px-4 md:px-5 py-2.5 border-b border-slate-100 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          {FILTERS.map(filter => (
            <button
              key={filter.key}
              onClick={() => onBillFilterChange(filter.key)}
              className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-semibold transition-colors ${billFilter === filter.key ? 'bg-jci-blue text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
            >
              {filter.label}
              {filter.key !== 'all' && <span className="ml-1 opacity-70">{filterCount(filter.key)}</span>}
            </button>
          ))}
        </div>

        <div className="md:hidden divide-y divide-slate-50">
          {isRefreshing ? (
            [1, 2, 3].map(i => <div key={i} className="px-4 py-3"><div className="h-16 bg-slate-100 rounded-lg animate-pulse" /></div>)
          ) : filteredBills.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <CreditCard size={28} className="mx-auto text-slate-200" />
              <p className="text-sm text-slate-400">{billFilter === 'all' ? 'No bills yet' : 'No bills in this filter'}</p>
            </div>
          ) : filteredBills.slice(0, 30).map((bill: ToyyibBillRecord, i) => {
            const cat = catMap[bill.categoryCode];
            const catTag = cat ? linkedLabel(cat) : null;
            const statusBadge = billStatusBadge(bill.billpaymentStatus ?? '2');
            return (
              <div key={bill.billCode || i} className="px-4 py-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900 text-sm leading-tight truncate">{bill.billTo || bill.billName}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5 truncate">{bill.billName}</p>
                    {bill.billDescription && (
                      <p className="text-[10px] text-slate-400 truncate">{bill.billDescription}</p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0 space-y-0.5">
                    <p className="font-bold text-slate-900 text-sm">RM {(bill.billAmount || 0).toFixed(2)}</p>
                    <Badge variant={statusBadge.variant} className="text-[10px]">{statusBadge.label}</Badge>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {catTag ? (
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium flex-shrink-0 ${catTag.color}`}>
                        {catTag.icon}{cat?.categoryName}
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono text-slate-300 truncate">{bill.categoryCode}</span>
                    )}
                    {bill.billPaymentDate && typeof bill.billPaymentDate !== 'object' && (
                      <span className="text-[10px] text-slate-400 truncate">{bill.billPaymentDate}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {bill.billCode && bill.billpaymentStatus !== '1' && (
                      <button
                        className="text-[11px] text-slate-400 hover:text-jci-blue disabled:opacity-40 transition-colors"
                        disabled={syncingBill === bill.billCode}
                        onClick={() => onSyncBillStatus(bill.billCode)}
                      >
                        {syncingBill === bill.billCode ? '…' : 'Sync'}
                      </button>
                    )}
                    {bill.billCode && <BillPaymentLink billCode={bill.billCode} variant="link" label="Open" className="text-[11px]" />}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-400 uppercase tracking-wide border-b border-slate-100">
                <th className="px-5 py-3 font-medium">Payer / Bill</th>
                <th className="px-5 py-3 font-medium">Category</th>
                <th className="px-5 py-3 font-medium">Code</th>
                <th className="px-5 py-3 font-medium text-right">Amount</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {isRefreshing ? (
                [1, 2, 3].map(i => (
                  <tr key={i}>
                    {[1, 2, 3, 4, 5, 6].map(j => <td key={j} className="px-5 py-4"><div className="h-3 bg-slate-100 rounded animate-pulse" /></td>)}
                  </tr>
                ))
              ) : filteredBills.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center">
                    <CreditCard size={28} className="mx-auto text-slate-200 mb-2" />
                    <p className="text-slate-400 text-sm">{billFilter === 'all' ? 'No bills yet — create one above' : 'No bills in this filter'}</p>
                  </td>
                </tr>
              ) : filteredBills.slice(0, 50).map((bill: ToyyibBillRecord, i) => {
                const cat = catMap[bill.categoryCode];
                const catTag = cat ? linkedLabel(cat) : null;
                const statusBadge = billStatusBadge(bill.billpaymentStatus ?? '2');
                return (
                  <tr key={bill.billCode || i} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-slate-900">{bill.billTo || '—'}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{bill.billName}</p>
                      {bill.billDescription && (
                        <p className="text-[10px] text-slate-300 mt-0.5 max-w-xs truncate">{bill.billDescription}</p>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      {catTag ? (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${catTag.color}`}>
                          {catTag.icon}{cat?.categoryName}
                        </span>
                      ) : (
                        <span className="text-xs font-mono text-slate-300">{bill.categoryCode || '—'}</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs text-slate-400">{bill.billCode}</td>
                    <td className="px-5 py-3.5 text-right font-bold text-slate-900">RM {(bill.billAmount || 0).toFixed(2)}</td>
                    <td className="px-5 py-3.5">
                      <Badge variant={statusBadge.variant} className="text-[10px]">{statusBadge.label}</Badge>
                      {bill.billPaymentDate && typeof bill.billPaymentDate !== 'object' && (
                        <p className="text-[10px] text-slate-400 mt-0.5">{bill.billPaymentDate}</p>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-3">
                        {bill.billCode && bill.billpaymentStatus !== '1' && (
                          <button
                            className="text-xs text-slate-400 hover:text-jci-blue disabled:opacity-40 transition-colors whitespace-nowrap"
                            disabled={syncingBill === bill.billCode}
                            onClick={() => onSyncBillStatus(bill.billCode)}
                          >
                            {syncingBill === bill.billCode ? 'Syncing…' : 'Sync'}
                          </button>
                        )}
                        {bill.billCode && <BillPaymentLink billCode={bill.billCode} variant="link" label="Open" />}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
