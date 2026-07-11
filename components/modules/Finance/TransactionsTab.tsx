import React from 'react';
import { Search, ChevronDown, Edit, Trash2 } from 'lucide-react';
import { Button, Badge } from '../../ui/Common';
import { LoadingState } from '../../ui/Loading';
import { Input } from '../../ui/Form';
import { formatCurrency } from '../../../utils/formatUtils';
import { formatDate } from '../../../utils/dateUtils';
import { FinanceService } from '../../../services/financeService';
import { projectFinancialService } from '../../../services/projectFinancialService';
import type { Transaction, BankAccount, TransactionSplit, Project, Member } from '../../../types';

interface GroupedGroup {
  key: string;
  label: string;
  txs: (Transaction & { runningBalance: number })[];
}

interface TransactionsTabProps {
  txSearchTerm: string;
  setTxSearchTerm: (v: string) => void;
  txCategoryFilter: string;
  setTxCategoryFilter: (v: string) => void;
  bankAccountFilter: string;
  setBankAccountFilter: (v: string) => void;
  txTypeFilter: 'All' | 'Income' | 'Expense';
  setTxTypeFilter: (v: 'All' | 'Income' | 'Expense') => void;
  txStatusFilter: 'All' | 'Pending' | 'Cleared';
  setTxStatusFilter: (v: 'All' | 'Pending' | 'Cleared') => void;
  reportYear: number;
  setReportYear: (v: number) => void;
  accounts: BankAccount[];
  loading: boolean;
  error: string | null;
  transactions: Transaction[];
  visibleTransactions: Transaction[];
  groupedTransactions: GroupedGroup[];
  transactionSplits: Record<string, TransactionSplit[]>;
  selectedTxIds: Set<string>;
  setSelectedTxIds: (v: Set<string>) => void;
  selectedSplitIds: Set<string>;
  setSelectedSplitIds: (v: Set<string>) => void;
  handleSelectAllTransactions: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleEditTransaction: (tx: Transaction) => void;
  handleDeleteTransaction: (id: string) => void;
  setSelectedTransaction: (tx: Transaction | null) => void;
  setIsSplitModalOpen: (open: boolean) => void;
  members: Member[];
  loadMembers: () => void;
  projects: Project[];
  loadProjects: () => void;
  setProjectPurposes: (v: string[]) => void;
  getTransactionAccountLabel: (tx: Transaction | TransactionSplit, parentTx?: Transaction) => string;
  hasMoreTransactions: boolean;
  setTransactionLimit: (fn: (prev: number) => number) => void;
}

export const TransactionsTab: React.FC<TransactionsTabProps> = ({
  txSearchTerm,
  setTxSearchTerm,
  txCategoryFilter,
  setTxCategoryFilter,
  bankAccountFilter,
  setBankAccountFilter,
  txTypeFilter,
  setTxTypeFilter,
  txStatusFilter,
  setTxStatusFilter,
  reportYear,
  setReportYear,
  accounts,
  loading,
  error,
  transactions,
  visibleTransactions,
  groupedTransactions,
  transactionSplits,
  selectedTxIds,
  setSelectedTxIds,
  selectedSplitIds,
  setSelectedSplitIds,
  handleSelectAllTransactions,
  handleEditTransaction,
  handleDeleteTransaction,
  setSelectedTransaction,
  setIsSplitModalOpen,
  members,
  loadMembers,
  projects,
  loadProjects,
  setProjectPurposes,
  getTransactionAccountLabel,
  hasMoreTransactions,
  setTransactionLimit,
}) => {
  const activeFilterCount = [
    txTypeFilter !== 'All',
    txStatusFilter !== 'All',
    txCategoryFilter !== 'All',
    bankAccountFilter !== 'All',
    reportYear !== 0,
  ].filter(Boolean).length;

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-3 space-y-2">
          {/* Search */}
          <Input
            type="text"
            placeholder="Search date, description, ref no…"
            value={txSearchTerm}
            onChange={(e) => setTxSearchTerm(e.target.value)}
            icon={<Search size={16} />}
            className="w-full"
          />

          {/* Filter panel */}
          <div className="flex flex-col md:flex-row md:items-center gap-2">
            {/* Dropdowns – pill style */}
            <div className="flex gap-1.5">
              {/* Account */}
              <div className="relative flex-1 md:flex-none md:shrink-0">
                <select
                  value={bankAccountFilter}
                  onChange={(e) => setBankAccountFilter(e.target.value)}
                  className={`appearance-none cursor-pointer w-full pl-3 pr-6 py-1.5 rounded-full text-xs font-semibold outline-none border transition-colors ${bankAccountFilter !== 'All'
                    ? 'bg-jci-blue text-white border-jci-blue'
                    : 'bg-slate-100 text-slate-600 border-transparent hover:bg-slate-200'
                    }`}
                >
                  <option value="All">All Accounts</option>
                  {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                </select>
                <ChevronDown size={11} className={`absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none ${bankAccountFilter !== 'All' ? 'text-white' : 'text-slate-400'}`} />
              </div>
              {/* Category */}
              <div className="relative flex-1 md:flex-none md:shrink-0">
                <select
                  value={txCategoryFilter}
                  onChange={(e) => setTxCategoryFilter(e.target.value)}
                  className={`appearance-none cursor-pointer w-full pl-3 pr-6 py-1.5 rounded-full text-xs font-semibold outline-none border transition-colors ${txCategoryFilter !== 'All'
                    ? 'bg-jci-blue text-white border-jci-blue'
                    : 'bg-slate-100 text-slate-600 border-transparent hover:bg-slate-200'
                    }`}
                >
                  <option value="All">All Categories</option>
                  <option value="Projects & Activities">Projects & Activities</option>
                  <option value="Membership">Membership</option>
                  <option value="Administrative">Administrative</option>
                  <option value="Uncategorized">Uncategorized</option>
                </select>
                <ChevronDown size={11} className={`absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none ${txCategoryFilter !== 'All' ? 'text-white' : 'text-slate-400'}`} />
              </div>
            </div>
            {/* Chips – Type + Status */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
                {(['All', 'Income', 'Expense'] as const).map(t => (
                  <button key={t} onClick={() => setTxTypeFilter(t)}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${txTypeFilter === t
                      ? t === 'Income' ? 'bg-green-500 text-white' : t === 'Expense' ? 'bg-red-500 text-white' : 'bg-white text-slate-700 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                      }`}>
                    {t === 'Income' ? '↑ Inc' : t === 'Expense' ? '↓ Exp' : 'All'}
                  </button>
                ))}
              </div>
              <div className="w-px h-4 bg-slate-200 shrink-0" />
              <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
                {(['All', 'Pending', 'Cleared'] as const).map(s => (
                  <button key={s} onClick={() => setTxStatusFilter(s)}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${txStatusFilter === s
                      ? s === 'Pending' ? 'bg-amber-500 text-white' : s === 'Cleared' ? 'bg-blue-500 text-white' : 'bg-white text-slate-700 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                      }`}>{s}</button>
                ))}
              </div>
              {activeFilterCount > 0 && (
                <button
                  onClick={() => { setTxTypeFilter('All'); setTxStatusFilter('All'); setTxCategoryFilter('All'); setBankAccountFilter('All'); setReportYear(new Date().getFullYear()); }}
                  className="text-xs text-blue-500 hover:text-blue-700 font-medium ml-1"
                >
                  Clear all
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Summary strip */}
        {visibleTransactions.length > 0 && (() => {
          const incomeTotal = visibleTransactions.filter(t => t.type === 'Income').reduce((s, t) => s + t.amount, 0);
          const expenseTotal = visibleTransactions.filter(t => t.type === 'Expense').reduce((s, t) => s + t.amount, 0);
          const pendingCount = visibleTransactions.filter(t => t.status === 'Pending').length;
          return (
            <div className="flex items-center gap-2 px-1 pb-3 border-b border-slate-100 overflow-x-auto no-scrollbar">
              <span className="text-xs text-slate-500 font-medium whitespace-nowrap shrink-0">{visibleTransactions.length} txns</span>
              <span className="w-px h-3.5 bg-slate-200 shrink-0" />
              <span className="text-xs font-mono font-semibold text-green-600 whitespace-nowrap shrink-0">+{formatCurrency(incomeTotal)}</span>
              <span className="text-xs font-mono font-semibold text-red-500 whitespace-nowrap shrink-0">−{formatCurrency(expenseTotal)}</span>
              {pendingCount > 0 && (
                <>
                  <span className="w-px h-3.5 bg-slate-200 shrink-0" />
                  <span className="flex items-center gap-1 text-xs font-semibold text-amber-600 whitespace-nowrap shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                    {pendingCount} pending
                  </span>
                </>
              )}
            </div>
          );
        })()}

        <LoadingState loading={loading} error={error} empty={transactions.length === 0} emptyMessage="No transactions found">
          {/* Desktop View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full table-fixed text-left text-sm">
              <colgroup>
                <col style={{ width: '2.5rem' }} />
                <col style={{ width: '7.5rem' }} />
                <col style={{ width: '35%' }} />
                <col style={{ width: '9rem' }} />
                <col style={{ width: '10rem' }} />
                <col style={{ width: '9rem' }} />
              </colgroup>
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="py-3 px-2 font-semibold">
                    <input
                      type="checkbox"
                      checked={(() => {
                        const allVisibleTxIds = visibleTransactions.map(t => t.id);
                        const allVisibleSplitIds = visibleTransactions.flatMap(t =>
                          t.isSplit && transactionSplits[t.id] ? transactionSplits[t.id].map(s => s.id) : []
                        );
                        return allVisibleTxIds.length > 0 && allVisibleTxIds.every(id => selectedTxIds.has(id)) &&
                          (allVisibleSplitIds.length === 0 || allVisibleSplitIds.every(id => selectedSplitIds.has(id)));
                      })()}
                      onChange={handleSelectAllTransactions}
                      className="accent-blue-600 cursor-pointer"
                    />
                  </th>
                  <th className="py-3 px-3 font-semibold whitespace-nowrap">Date</th>
                  <th className="py-3 px-3 font-semibold">Description</th>
                  <th className="py-3 px-3 font-semibold text-right whitespace-nowrap">Amount</th>
                  <th className="py-3 px-3 font-semibold text-right whitespace-nowrap">Bal.</th>
                  <th className="py-3 px-3 font-semibold text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {groupedTransactions.map(group => (
                  <React.Fragment key={group.key}>
                    <tr>
                      <td colSpan={6} className="py-1.5 px-3 bg-slate-50 border-y border-slate-100">
                        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{group.label}</span>
                      </td>
                    </tr>
                    {group.txs.map(tx => (
                      <React.Fragment key={tx.id}>
                        {/* Parent Transaction Row */}
                        <tr className={`border-l-2 ${tx.type === 'Income' ? 'border-l-green-400' : 'border-l-red-400'} hover:bg-slate-50/80 transition-colors ${selectedTxIds.has(tx.id) ? 'bg-blue-50/60' : tx.status === 'Pending' ? 'bg-amber-50/40' : ''}`}>
                          <td className="py-4 px-2 w-8">
                            <input
                              type="checkbox"
                              checked={selectedTxIds.has(tx.id)}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                const nextTx = new Set(selectedTxIds);
                                const nextSplits = new Set(selectedSplitIds);
                                if (checked) {
                                  nextTx.add(tx.id);
                                  if (tx.isSplit && transactionSplits[tx.id]) {
                                    transactionSplits[tx.id].forEach(s => nextSplits.add(s.id));
                                  }
                                } else {
                                  nextTx.delete(tx.id);
                                  if (tx.isSplit && transactionSplits[tx.id]) {
                                    transactionSplits[tx.id].forEach(s => nextSplits.delete(s.id));
                                  }
                                }
                                setSelectedTxIds(nextTx);
                                setSelectedSplitIds(nextSplits);
                              }}
                              className="accent-blue-600 cursor-pointer"
                            />
                          </td>
                          <td className="py-4 px-4 text-slate-500 whitespace-nowrap">{formatDate(tx.date)}</td>
                          <td className="py-4 px-4 max-w-0 overflow-hidden">
                            <div className="flex items-center gap-2 overflow-hidden">
                              {(() => {
                                const hasProjectId = tx.projectId && tx.projectId.trim() !== '';
                                const hasPurpose = tx.purpose && tx.purpose.trim() !== '';
                                if (tx.isSplit) {
                                  return <Badge variant="info" className="text-[10px] py-0 px-1.5 shrink-0">Split</Badge>;
                                } else if (hasProjectId && hasPurpose) {
                                  return <Badge variant="success" className="text-[10px] py-0 px-1.5 shrink-0">Categorized</Badge>;
                                } else {
                                  return <Badge variant="warning" className="text-[10px] py-0 px-1.5 shrink-0">Uncategorized</Badge>;
                                }
                              })()}
                              <span className="font-medium text-slate-900 truncate min-w-0">{tx.description}</span>
                              {tx.referenceNumber && (
                                <span className="text-[11px] text-slate-400 font-mono shrink-0">({tx.referenceNumber})</span>
                              )}
                            </div>
                            <div
                              className="mt-1 overflow-hidden text-xs text-slate-500 whitespace-nowrap text-ellipsis flex items-center gap-1.5"
                              title={`${tx.isSplit ? 'Split' : (tx.category || '—')} | ${getTransactionAccountLabel(tx)} | ${tx.purpose || '—'}`}
                            >
                              {tx.status === 'Pending' && <span className="shrink-0 inline-flex items-center px-1.5 py-0 rounded text-[10px] font-semibold bg-amber-100 text-amber-700">Pending</span>}
                              <span className="font-medium text-slate-600">
                                {tx.isSplit ? 'Split' : (tx.category || '—')}
                              </span>
                              <span className="text-slate-300">|</span>
                              <span>{getTransactionAccountLabel(tx)}</span>
                              <span className="text-slate-300">|</span>
                              <span>{tx.purpose || '—'}</span>
                              {tx.isSplit && (
                                <>
                                  <span className="text-slate-300">|</span>
                                  <span className="text-blue-600">Split into {transactionSplits[tx.id]?.length || 0} parts</span>
                                </>
                              )}
                            </div>
                          </td>
                          <td className={`py-4 px-4 text-right font-mono font-bold ${tx.type === 'Income' ? 'text-green-600' : 'text-red-600'}`}>
                            {tx.type === 'Income' ? '+' : '-'}{formatCurrency(Math.abs(tx.amount))}
                          </td>
                          <td className={`py-4 px-4 text-right font-mono font-semibold ${tx.runningBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatCurrency(tx.runningBalance)}
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditTransaction(tx)}
                                className="text-slate-600 hover:text-blue-600 p-1"
                                title="Edit transaction"
                              >
                                <Edit size={16} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteTransaction(tx.id)}
                                className="text-slate-600 hover:text-red-600 p-1"
                                title="Delete transaction"
                              >
                                <Trash2 size={16} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedTransaction(tx);
                                  setIsSplitModalOpen(true);
                                  if (members.length === 0) loadMembers();
                                  if (projects.length === 0) loadProjects();
                                  const loadPurposes = async () => {
                                    const purposes = new Set<string>();
                                    const targetProjectId = tx.projectId;
                                    try {
                                      const ptTrx = await projectFinancialService.getAllProjectTrackerTransactions();
                                      ptTrx.forEach(t => {
                                        if (t.projectId === targetProjectId && t.description) purposes.add(t.description);
                                      });
                                    } catch (e) { console.error('Failed to load PT purposes', e); }
                                    let allTx: Transaction[] = [];
                                    try {
                                      allTx = await FinanceService.getAllTransactions();
                                      allTx.forEach(t => {
                                        if (t.projectId === targetProjectId && t.purpose) purposes.add(t.purpose);
                                      });
                                    } catch (e) { console.error('Failed to load tx purposes', e); }
                                    try {
                                      const splitTx = allTx.filter(t => t.isSplit && t.splitIds);
                                      for (const t of splitTx) {
                                        try {
                                          const splits = await FinanceService.getTransactionSplits(t.id);
                                          splits.forEach(s => {
                                            if (s.projectId === targetProjectId && s.purpose) purposes.add(s.purpose);
                                          });
                                        } catch (e) { /* ignore */ }
                                      }
                                    } catch (e) { console.error('Failed to load split purposes', e); }
                                    setProjectPurposes(Array.from(purposes).sort());
                                  };
                                  loadPurposes();
                                }}
                                className="text-blue-600 hover:text-blue-700 text-xs px-2"
                                title={tx.isSplit ? 'Edit split' : 'Split transaction'}
                              >
                                {tx.isSplit ? 'Edit Split' : 'Split'}
                              </Button>
                            </div>
                          </td>
                        </tr>

                        {/* Split Transaction Rows */}
                        {tx.isSplit && transactionSplits[tx.id] && transactionSplits[tx.id].map((split, idx) => (
                          <tr key={`${tx.id}-split-${idx}`} className={`bg-blue-50/30 ${selectedSplitIds.has(split.id) ? 'bg-blue-100/50' : ''}`}>
                            <td className="py-2 px-2">
                              <input
                                type="checkbox"
                                checked={selectedSplitIds.has(split.id)}
                                onChange={(e) => {
                                  const next = new Set(selectedSplitIds);
                                  if (e.target.checked) next.add(split.id);
                                  else next.delete(split.id);
                                  setSelectedSplitIds(next);
                                }}
                                className="accent-blue-600 cursor-pointer"
                              />
                            </td>
                            <td className="py-2 px-4 pl-12"></td>
                            <td className="py-2 px-4 pl-12 max-w-0 overflow-hidden">
                              <div className="flex items-center gap-2 overflow-hidden">
                                <span className="text-slate-400 shrink-0">↳</span>
                                <span className="text-slate-600 truncate min-w-0">{split.description}</span>
                              </div>
                              <div
                                className="mt-0.5 overflow-hidden text-xs text-slate-500 whitespace-nowrap text-ellipsis"
                                title={`${split.category || '—'} | ${getTransactionAccountLabel(split, tx)} | ${split.purpose || '—'}`}
                              >
                                <span className="font-medium text-slate-600">{split.category || '—'}</span>
                                <span className="mx-1 text-slate-300">|</span>
                                <span>{getTransactionAccountLabel(split, tx)}</span>
                                <span className="mx-1 text-slate-300">|</span>
                                <span>{split.purpose || '—'}</span>
                              </div>
                            </td>
                            <td className={`py-2 px-4 text-right font-mono text-sm ${(split.type || tx.type) === 'Income' ? 'text-green-600' : 'text-red-600'}`}>
                              {(split.type || tx.type) === 'Income' ? '+' : '-'}{formatCurrency(Math.abs(split.amount))}
                            </td>
                            <td className="py-2 px-4"></td>
                            <td className="py-2 px-4"></td>
                          </tr>
                        ))}
                      </React.Fragment>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile View */}
          <div className="md:hidden space-y-3 p-1">
            {groupedTransactions.map(group => (
              <div key={group.key}>
                <div className="py-1 px-1 mb-1.5">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{group.label}</span>
                </div>
                {group.txs.map(tx => (
                  <div key={tx.id} className={`bg-white border rounded-xl overflow-hidden shadow-sm relative ${selectedTxIds.has(tx.id) ? 'ring-2 ring-blue-500 bg-blue-50/20 border-blue-200' : tx.status === 'Pending' ? 'border-amber-200 bg-amber-50/20' : 'border-slate-100'}`}>
                    <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-xl ${tx.type === 'Income' ? 'bg-green-400' : 'bg-red-400'}`} />
                    <div className="pl-4 pr-3 pt-2.5 pb-2.5">
                      {/* Row 1: checkbox + date + pending | amount */}
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <input
                            type="checkbox"
                            checked={selectedTxIds.has(tx.id)}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              const nextTx = new Set(selectedTxIds);
                              const nextSplits = new Set(selectedSplitIds);
                              if (checked) {
                                nextTx.add(tx.id);
                                if (tx.isSplit && transactionSplits[tx.id]) {
                                  transactionSplits[tx.id].forEach(s => nextSplits.add(s.id));
                                }
                              } else {
                                nextTx.delete(tx.id);
                                if (tx.isSplit && transactionSplits[tx.id]) {
                                  transactionSplits[tx.id].forEach(s => nextSplits.delete(s.id));
                                }
                              }
                              setSelectedTxIds(nextTx);
                              setSelectedSplitIds(nextSplits);
                            }}
                            className="accent-blue-600 w-4 h-4 cursor-pointer shrink-0"
                          />
                          <span className="text-[11px] text-slate-400 font-medium shrink-0">{formatDate(tx.date)}</span>
                          {tx.status === 'Pending' && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded px-1 shrink-0">
                              <span className="w-1 h-1 rounded-full bg-amber-400 inline-block" />
                              Pending
                            </span>
                          )}
                        </div>
                        <span className={`font-mono font-bold text-sm shrink-0 ${tx.type === 'Income' ? 'text-green-600' : 'text-red-600'}`}>
                          {tx.type === 'Income' ? '+' : '-'}{formatCurrency(Math.abs(tx.amount))}
                        </span>
                      </div>
                      {/* Row 2: description */}
                      <p className="text-sm font-semibold text-slate-900 leading-snug truncate mb-2">{tx.description}</p>
                      {/* Row 3: meta | actions */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
                          <Badge variant={tx.isSplit ? 'info' : 'neutral'} className="text-[10px] shrink-0">{tx.isSplit ? 'Split' : (tx.category || '—')}</Badge>
                          {(() => {
                            const acc = accounts.find(a => a.id === tx.bankAccountId);
                            if (acc) return <span className="text-[10px] text-slate-400 truncate">{acc.name}</span>;
                            return null;
                          })()}
                          <span className="text-[10px] text-slate-400 font-mono whitespace-nowrap shrink-0">Bal {formatCurrency(tx.runningBalance)}</span>
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0">
                          <button onClick={() => handleEditTransaction(tx)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors" title="Edit">
                            <Edit size={14} />
                          </button>
                          <button onClick={() => handleDeleteTransaction(tx.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors" title="Delete">
                            <Trash2 size={14} />
                          </button>
                          <button onClick={() => {
                            setSelectedTransaction(tx);
                            setIsSplitModalOpen(true);
                            if (members.length === 0) loadMembers();
                            if (projects.length === 0) loadProjects();
                          }} className="px-2 py-1 rounded-lg text-[11px] font-bold text-blue-600 hover:bg-blue-50 transition-colors">
                            {tx.isSplit ? 'Edit Split' : 'Split'}
                          </button>
                        </div>
                      </div>
                      {/* Split details */}
                      {tx.isSplit && transactionSplits[tx.id] && (
                        <div className="mt-2 space-y-1.5 bg-blue-50/40 p-2 rounded-lg border border-blue-100/60">
                          {transactionSplits[tx.id].map((split, idx) => (
                            <div key={idx} className="flex justify-between items-center text-[11px]">
                              <div className="flex items-center gap-1 min-w-0">
                                <span className="text-blue-400 shrink-0">↳</span>
                                <span className="text-slate-600 truncate">{split.description}</span>
                              </div>
                              <span className={`font-mono font-medium whitespace-nowrap shrink-0 ${(split.type || tx.type) === 'Income' ? 'text-green-600' : 'text-red-600'}`}>
                                {(split.type || tx.type) === 'Income' ? '+' : '-'}{formatCurrency(Math.abs(split.amount))}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
          {hasMoreTransactions && (
            <div className="mt-4 flex justify-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setTransactionLimit(prev => prev + 100)}
                className="text-jci-blue hover:bg-jci-blue/10 font-medium"
              >
                Show More Transactions
              </Button>
            </div>
          )}
        </LoadingState>
      </div>
    </div>
  );
};
