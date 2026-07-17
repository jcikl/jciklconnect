import React, { useState } from 'react';
import { Plus, Edit, Trash2, Briefcase, FileText, ChevronDown } from 'lucide-react';
import { Button, Badge, ConfirmDialog, CONFIRM_CLOSED } from '../../ui/Common';
import type { ConfirmState } from '../../ui/Common';
import { LoadingState } from '../../ui/Loading';
import { formatCurrency } from '../../../utils/formatUtils';
import { formatDate } from '../../../utils/dateUtils';
import { UNASSIGNED_PROJECT_ID } from '../../../hooks/useFinanceData';
import { PaymentRequestService } from '../../../services/paymentRequestService';
import type { Transaction, Project, PaymentRequest, PaymentRequestStatus } from '../../../types';

interface AdministrativeTabProps {
  transactions: Transaction[];
  isTransactionInCategory: (t: Transaction, cat: string) => boolean;
  adminAccountYearFilter: number;
  dynamicAdministrativeProjectIds: string[];
  adminProjectIdFilter: string | null;
  setAdminProjectIdFilter: (id: string | null) => void;
  loading: boolean;
  error: string | null;
  getTransactionAccountLabel: (tx: Transaction) => string;
  hasPermission: (perm: string) => boolean;
  handleEditTransaction: (tx: Transaction) => void;
  handleDeleteTransaction: (id: string) => void;
  setIsAddAdministrativeProjectOpen: (open: boolean) => void;
  projects: Project[];
}

const PR_STATUS_FILTER_OPTIONS: { label: string; value: PaymentRequestStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Pending', value: 'submitted' },
  { label: 'Approved', value: 'approved' },
  { label: 'Paid', value: 'paid' },
  { label: 'Rejected', value: 'rejected' },
];

const AdministrativeTabBase: React.FC<AdministrativeTabProps> = ({
  transactions,
  isTransactionInCategory,
  adminAccountYearFilter,
  dynamicAdministrativeProjectIds,
  adminProjectIdFilter,
  setAdminProjectIdFilter,
  loading,
  error,
  getTransactionAccountLabel,
  hasPermission,
  handleEditTransaction,
  handleDeleteTransaction,
  setIsAddAdministrativeProjectOpen,
  projects,
}) => {
  const [confirmState, setConfirmState] = useState<ConfirmState>(CONFIRM_CLOSED);

  const requestDeleteTransaction = (id: string, description?: string) => {
    setConfirmState({
      open: true,
      title: 'Delete Transaction',
      message: `Are you sure you want to permanently delete "${description || 'this transaction'}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      variant: 'danger',
      onConfirm: () => {
        handleDeleteTransaction(id);
        setConfirmState(CONFIRM_CLOSED);
      },
    });
  };

  const [adminPRs, setAdminPRs] = React.useState<PaymentRequest[]>([]);
  const [prStatusFilter, setPrStatusFilter] = React.useState<PaymentRequestStatus | 'all'>('all');

  React.useEffect(() => {
    PaymentRequestService.list({ pageSize: 500 }).then(({ items }) => {
      setAdminPRs(items.filter(pr => pr.category === 'administrative'));
    }).catch(() => {});
  }, []);

  const activeYear = adminAccountYearFilter;
  const adminTransactions = transactions.filter(t => isTransactionInCategory(t, 'Administrative'));
  const adminFiltered = activeYear === 0
    ? adminTransactions
    : adminTransactions.filter(t => new Date(t.date).getFullYear() === activeYear);

  const adminIncome = adminFiltered.filter(t => t.type === 'Income').reduce((s, t) => s + t.amount, 0);
  const adminExpenses = adminFiltered.filter(t => t.type === 'Expense').reduce((s, t) => s + Math.abs(t.amount), 0);
  const adminNet = adminIncome - adminExpenses;
  const allAdminProjectIds = dynamicAdministrativeProjectIds;
  let adminByProjectId = allAdminProjectIds.map(projectId => {
    const txList = adminFiltered.filter(t => (t.projectId || '').trim() === projectId.trim());
    const inc = txList.filter(t => t.type === 'Income').reduce((s, t) => s + t.amount, 0);
    const exp = txList.filter(t => t.type === 'Expense').reduce((s, t) => s + Math.abs(t.amount), 0);
    return { projectId, income: inc, expenses: exp, net: inc - exp };
  });
  const uncategorized = adminFiltered.filter(t => !(t.projectId || '').trim());
  const uncatInc = uncategorized.filter(t => t.type === 'Income').reduce((s, t) => s + t.amount, 0);
  const uncatExp = uncategorized.filter(t => t.type === 'Expense').reduce((s, t) => s + Math.abs(t.amount), 0);
  adminByProjectId = [{ projectId: UNASSIGNED_PROJECT_ID, income: uncatInc, expenses: uncatExp, net: uncatInc - uncatExp }, ...adminByProjectId];
  if (activeYear !== 0) {
    adminByProjectId = adminByProjectId.filter(acc => acc.income !== 0 || acc.expenses !== 0);
  }

  const adminTransactionsWithFilter = activeYear === 0
    ? adminTransactions
    : adminTransactions.filter(t => new Date(t.date).getFullYear() === activeYear);
  const filteredAdminTx = adminProjectIdFilter
    ? adminProjectIdFilter === UNASSIGNED_PROJECT_ID
      ? adminTransactionsWithFilter.filter(t => !(t.projectId || '').trim())
      : adminTransactionsWithFilter.filter(t => (t.projectId || '').trim() === adminProjectIdFilter)
    : adminTransactionsWithFilter;

  return (
    <>
    <div className="space-y-4">
      {/* ── Admin Account Cards – horizontal scroll both mobile + desktop ── */}
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-bold text-slate-700">Admin Accounts</h3>
        {hasPermission('canEditFinance') && (
          <Button size="sm" variant="outline" onClick={() => setIsAddAdministrativeProjectOpen(true)}>
            <Plus size={13} className="mr-1" />Add Account
          </Button>
        )}
      </div>
      {adminByProjectId.length === 0 ? (
        <p className="py-4 text-sm text-slate-400 text-center">No admin accounts found.</p>
      ) : (
        <div className="flex gap-2.5 overflow-x-auto pb-1 no-scrollbar -mx-1 px-1">
          {adminByProjectId.map(({ projectId, income, expenses, net }) => {
            const isActive = adminProjectIdFilter === projectId;
            const isUnassigned = projectId === UNASSIGNED_PROJECT_ID;
            return (
              <div
                key={projectId}
                role="button"
                tabIndex={0}
                onClick={() => setAdminProjectIdFilter(isActive ? null : projectId)}
                onKeyDown={(e) => e.key === 'Enter' && setAdminProjectIdFilter(isActive ? null : projectId)}
                className={`shrink-0 w-64 relative cursor-pointer rounded-xl border overflow-hidden shadow-sm transition-all ${isActive
                  ? 'border-jci-blue ring-1 ring-jci-blue/20 shadow-md shadow-jci-blue/5'
                  : 'border-slate-200 hover:border-slate-300 hover:shadow'
                  }`}
              >
                <div className={`absolute left-0 top-0 bottom-0 w-1 ${isActive ? 'bg-jci-blue' : isUnassigned ? 'bg-amber-400' : 'bg-slate-300'}`} />
                <div className={`pl-4 pr-3 pt-3 pb-3 ${isActive ? 'bg-jci-blue/5' : 'bg-white'}`}>
                  <div className="flex items-center gap-1.5 min-w-0 mb-2.5">
                    <Briefcase size={13} className={`shrink-0 ${isActive ? 'text-jci-blue' : 'text-slate-400'}`} />
                    <span className={`text-sm font-semibold truncate ${isActive ? 'text-jci-blue' : 'text-slate-800'}`}>
                      {isUnassigned ? 'Unassigned' : projectId}
                    </span>
                  </div>
                  <div className="bg-slate-50 rounded-lg border border-slate-100 overflow-hidden">
                    <div className="divide-y divide-slate-100">
                      <div className="grid grid-cols-2 gap-1 px-2 py-1">
                        <div className="text-[11px] text-slate-500">Income</div>
                        <div className="text-right text-[11px] font-mono text-green-600">{formatCurrency(income)}</div>
                      </div>
                      <div className="grid grid-cols-2 gap-1 px-2 py-1">
                        <div className="text-[11px] text-slate-500">Expense</div>
                        <div className="text-right text-[11px] font-mono text-red-500">{formatCurrency(expenses)}</div>
                      </div>
                      <div className="grid grid-cols-2 gap-1 px-2 py-1.5 bg-slate-100/60">
                        <div className="text-[11px] font-semibold text-slate-700">Net</div>
                        <div className={`text-right text-[11px] font-mono font-semibold ${net >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(net)}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Summary strip + Transactions ── */}
      <div className="grid grid-cols-1 md:grid-cols-10 gap-4">
        {/* Payment Requests card (情景 24) */}
        <div className="md:col-span-2">
          {(() => {
            const yearPRs = activeYear === 0 ? adminPRs : adminPRs.filter(pr => {
              const y = pr.date ? new Date(pr.date).getFullYear() : new Date(pr.createdAt).getFullYear();
              return y === activeYear;
            });
            const filteredPRs = prStatusFilter === 'all' ? yearPRs : yearPRs.filter(pr => pr.status === prStatusFilter);
            const pendingAmt = yearPRs.filter(p => p.status === 'submitted').reduce((s, p) => s + (p.totalAmount || p.amount || 0), 0);
            const approvedAmt = yearPRs.filter(p => p.status === 'approved').reduce((s, p) => s + (p.totalAmount || p.amount || 0), 0);
            const paidAmt = yearPRs.filter(p => p.status === 'paid').reduce((s, p) => s + (p.totalAmount || p.amount || 0), 0);
            return (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-4 pt-3 pb-2 border-b border-slate-100 flex items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5"><FileText size={13} className="text-jci-blue" />Payment Requests</h3>
                    <p className="text-[11px] text-slate-400">{activeYear === 0 ? 'All time' : activeYear} · Administrative</p>
                  </div>
                </div>
                <div className="px-3 py-2 border-b border-slate-100">
                  <div className="flex gap-1 flex-wrap">
                    {PR_STATUS_FILTER_OPTIONS.map(opt => (
                      <button key={opt.value} onClick={() => setPrStatusFilter(opt.value)}
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-colors ${prStatusFilter === opt.value ? 'bg-jci-blue text-white border-jci-blue' : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-slate-300'}`}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="px-4 py-3 space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] text-amber-600">Pending</span>
                    <span className="text-xs font-mono font-semibold text-amber-600">{formatCurrency(pendingAmt)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] text-blue-600">Approved</span>
                    <span className="text-xs font-mono font-semibold text-blue-600">{formatCurrency(approvedAmt)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] text-green-600">Paid</span>
                    <span className="text-xs font-mono font-semibold text-green-600">{formatCurrency(paidAmt)}</span>
                  </div>
                  <div className="pt-2 border-t border-slate-100">
                    <p className="text-[10px] text-slate-400">{filteredPRs.length} PR{filteredPRs.length !== 1 ? 's' : ''} {prStatusFilter === 'all' ? 'total' : prStatusFilter}</p>
                    <div className="mt-1 space-y-1 max-h-40 overflow-y-auto">
                      {filteredPRs.slice(0, 8).map(pr => (
                        <div key={pr.id} className="flex justify-between items-center text-[10px]">
                          <span className="truncate text-slate-600 max-w-[65%]">{pr.purpose || pr.remark || pr.referenceNumber}</span>
                          <span className="font-mono text-slate-700 shrink-0">{formatCurrency(pr.totalAmount || pr.amount || 0)}</span>
                        </div>
                      ))}
                      {filteredPRs.length > 8 && <p className="text-[10px] text-slate-400 text-center">+{filteredPRs.length - 8} more</p>}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Summary card */}
        <div className="md:col-span-2">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-4 pt-3 pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-800">Summary</h3>
              <p className="text-[11px] text-slate-400">{activeYear === 0 ? 'All time' : activeYear}</p>
            </div>
            <div className="px-4 py-3 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-500">Income</span>
                <span className="text-sm font-mono font-semibold text-green-600">+{formatCurrency(adminIncome)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-500">Expense</span>
                <span className="text-sm font-mono font-semibold text-red-500">-{formatCurrency(adminExpenses)}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                <span className="text-xs font-semibold text-slate-700">Net</span>
                <span className={`text-sm font-mono font-bold ${adminNet >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(adminNet)}</span>
              </div>
              <p className="text-[11px] text-slate-400 pt-1">
                {adminFiltered.filter(t => t.type === 'Income').length} income · {adminFiltered.filter(t => t.type === 'Expense').length} expense
              </p>
            </div>
          </div>
        </div>

        {/* Right: Transactions */}
        <div className="md:col-span-6">
          {/* Title row */}
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-slate-800">
              {adminProjectIdFilter === UNASSIGNED_PROJECT_ID
                ? 'Transactions · Unassigned'
                : adminProjectIdFilter
                  ? `Transactions · ${adminProjectIdFilter}`
                  : 'Admin Transactions'}
            </h3>
            {adminProjectIdFilter && (
              <button onClick={() => setAdminProjectIdFilter(null)} className="text-xs text-blue-500 hover:text-blue-700 font-medium">Clear</button>
            )}
          </div>
          <LoadingState loading={loading} error={error} empty={filteredAdminTx.length === 0} emptyMessage={adminProjectIdFilter ? 'No transactions for this account.' : "No admin transactions found. Use 'New Transaction' above to add one."}>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-100">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
                  <tr>
                    <th className="py-2.5 px-3 font-semibold text-xs whitespace-nowrap">Date</th>
                    <th className="py-2.5 px-3 font-semibold text-xs whitespace-nowrap">Type</th>
                    <th className="py-2.5 px-3 font-semibold text-xs">Description</th>
                    <th className="py-2.5 px-3 font-semibold text-xs whitespace-nowrap">Account</th>
                    <th className="py-2.5 px-3 font-semibold text-xs text-right whitespace-nowrap">Amount</th>
                    {hasPermission('canEditFinance') && <th className="py-2.5 px-3 font-semibold text-xs text-center">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAdminTx
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .map(tx => {
                      const hasProjectId = tx.projectId && tx.projectId.trim() !== '';
                      const hasPurpose = tx.purpose && tx.purpose.trim() !== '';
                      const accountLabel = getTransactionAccountLabel(tx);
                      return (
                        <tr key={tx.id} className={`border-l-2 ${tx.type === 'Income' ? 'border-l-green-400' : 'border-l-red-400'} hover:bg-slate-50/60 transition-colors`}>
                          <td className="py-2.5 px-3 text-xs text-slate-500 whitespace-nowrap">{formatDate(tx.date)}</td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full ${tx.type === 'Income' ? 'bg-green-50 text-green-700 ring-1 ring-green-200' : 'bg-red-50 text-red-600 ring-1 ring-red-200'}`}>
                              {tx.type === 'Income' ? '↑ Income' : '↓ Expense'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 max-w-0">
                            <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                              {tx.isSplit
                                ? <Badge variant="info" className="text-[10px] shrink-0">Split</Badge>
                                : hasProjectId && hasPurpose
                                  ? <Badge variant="success" className="text-[10px] shrink-0">Categorized</Badge>
                                  : <Badge variant="warning" className="text-[10px] shrink-0">Uncategorized</Badge>
                              }
                              <span className="font-medium text-slate-900 truncate text-xs">{tx.description}</span>
                              {tx.referenceNumber && <span className="text-[10px] text-slate-400 font-mono shrink-0">({tx.referenceNumber})</span>}
                              {tx.status && tx.status !== 'Cleared' && (
                                <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${tx.status === 'Reconciled' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-700'}`}>{tx.status}</span>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-xs text-slate-500 whitespace-nowrap max-w-[140px] truncate">
                            {accountLabel}
                          </td>
                          <td className={`py-2.5 px-3 text-right font-mono font-bold text-xs whitespace-nowrap ${tx.type === 'Income' ? 'text-green-600' : 'text-red-500'}`}>
                            {tx.type === 'Income' ? '+' : '-'}{formatCurrency(Math.abs(tx.amount))}
                          </td>
                          {hasPermission('canEditFinance') && (
                            <td className="py-2.5 px-3 text-center">
                              <div className="flex justify-center gap-0.5">
                                <button aria-label={`Edit transaction: ${tx.description}`} onClick={() => handleEditTransaction(tx)} className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"><Edit size={13} /></button>
                                <button aria-label={`Delete transaction: ${tx.description}`} onClick={() => requestDeleteTransaction(tx.id, tx.description)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"><Trash2 size={13} /></button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
            {/* Mobile cards */}
            <div className="md:hidden space-y-2 pt-1">
              {filteredAdminTx
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .map(tx => {
                  const hasProjectId = tx.projectId && tx.projectId.trim() !== '';
                  const hasPurpose = tx.purpose && tx.purpose.trim() !== '';
                  return (
                    <div key={tx.id} className="relative bg-white border border-slate-100 rounded-xl overflow-hidden shadow-sm">
                      <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-xl ${tx.type === 'Income' ? 'bg-green-400' : 'bg-red-400'}`} />
                      <div className="pl-4 pr-3 pt-2.5 pb-2.5">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-[11px] text-slate-400 font-medium">{formatDate(tx.date)}</span>
                          <span className={`font-mono font-bold text-sm shrink-0 ${tx.type === 'Income' ? 'text-green-600' : 'text-red-600'}`}>
                            {tx.type === 'Income' ? '+' : '-'}{formatCurrency(Math.abs(tx.amount))}
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-slate-900 leading-snug truncate mb-1.5">{tx.description}</p>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
                            {tx.isSplit
                              ? <Badge variant="info" className="text-[10px] shrink-0">Split</Badge>
                              : hasProjectId && hasPurpose
                                ? <Badge variant="success" className="text-[10px] shrink-0">Categorized</Badge>
                                : <Badge variant="warning" className="text-[10px] shrink-0">Uncategorized</Badge>
                            }
                            <span className="text-[10px] text-slate-400 truncate">
                              {tx.projectId ? (projects.find(p => p.id === tx.projectId)?.name ?? tx.projectId) : '—'}
                            </span>
                          </div>
                          {hasPermission('canEditFinance') && (
                            <div className="flex items-center gap-0.5 shrink-0">
                              <button aria-label={`Edit transaction: ${tx.description}`} onClick={() => handleEditTransaction(tx)} className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"><Edit size={13} /></button>
                              <button aria-label={`Delete transaction: ${tx.description}`} onClick={() => requestDeleteTransaction(tx.id, tx.description)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"><Trash2 size={13} /></button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </LoadingState>
        </div>
      </div>
    </div>
    <ConfirmDialog
      open={confirmState.open}
      title={confirmState.title}
      message={confirmState.message}
      confirmLabel={confirmState.confirmLabel}
      variant={confirmState.variant}
      onConfirm={confirmState.onConfirm}
      onCancel={() => setConfirmState(CONFIRM_CLOSED)}
    />
    </>
  );
};

export const AdministrativeTab = React.memo(AdministrativeTabBase);
