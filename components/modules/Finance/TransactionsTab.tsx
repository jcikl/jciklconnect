import React, { useMemo, useRef } from 'react';
import { Search, ChevronDown, Edit, Trash2, Link2Off, Ban } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
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
  handleUnmatchTransaction: (tx: Transaction) => void;
  handleVoidTransaction: (tx: Transaction) => void;
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

// Flat item types for the virtual list
type FlatItemDesktop =
  | { kind: 'group-header'; label: string; key: string }
  | { kind: 'tx'; tx: Transaction & { runningBalance: number } }
  | { kind: 'split'; split: TransactionSplit; parentTx: Transaction & { runningBalance: number }; idx: number };

type FlatItemMobile =
  | { kind: 'group-header'; label: string; key: string }
  | { kind: 'tx'; tx: Transaction & { runningBalance: number } };

// Height estimates
const DESKTOP_GROUP_HEADER_H = 36;
const DESKTOP_TX_H = 64;
const DESKTOP_SPLIT_H = 44;
const MOBILE_GROUP_HEADER_H = 32;
const MOBILE_TX_H = 116; // generous estimate including possible split inline section

const TransactionsTabBase: React.FC<TransactionsTabProps> = ({
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
  handleUnmatchTransaction,
  handleVoidTransaction,
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

  // Flatten grouped transactions into a single array for virtual rendering (desktop)
  const flatDesktopItems = useMemo<FlatItemDesktop[]>(() => {
    const items: FlatItemDesktop[] = [];
    for (const group of groupedTransactions) {
      items.push({ kind: 'group-header', label: group.label, key: group.key });
      for (const tx of group.txs) {
        items.push({ kind: 'tx', tx });
        if (tx.isSplit && transactionSplits[tx.id]) {
          transactionSplits[tx.id].forEach((split, idx) => {
            items.push({ kind: 'split', split, parentTx: tx, idx });
          });
        }
      }
    }
    return items;
  }, [groupedTransactions, transactionSplits]);

  // Flatten for mobile (splits are rendered inside the tx card, not as separate rows)
  const flatMobileItems = useMemo<FlatItemMobile[]>(() => {
    const items: FlatItemMobile[] = [];
    for (const group of groupedTransactions) {
      items.push({ kind: 'group-header', label: group.label, key: group.key });
      for (const tx of group.txs) {
        items.push({ kind: 'tx', tx });
      }
    }
    return items;
  }, [groupedTransactions]);

  const desktopScrollRef = useRef<HTMLDivElement>(null);
  const mobileScrollRef = useRef<HTMLDivElement>(null);

  const desktopVirtualizer = useVirtualizer({
    count: flatDesktopItems.length,
    getScrollElement: () => desktopScrollRef.current,
    estimateSize: (i) => {
      const item = flatDesktopItems[i];
      if (!item) return DESKTOP_TX_H;
      if (item.kind === 'group-header') return DESKTOP_GROUP_HEADER_H;
      if (item.kind === 'split') return DESKTOP_SPLIT_H;
      return DESKTOP_TX_H;
    },
    overscan: 8,
  });

  const mobileVirtualizer = useVirtualizer({
    count: flatMobileItems.length,
    getScrollElement: () => mobileScrollRef.current,
    estimateSize: (i) => {
      const item = flatMobileItems[i];
      if (!item) return MOBILE_TX_H;
      if (item.kind === 'group-header') return MOBILE_GROUP_HEADER_H;
      // For mobile tx with splits, add extra height
      if (item.kind === 'tx') {
        const tx = item.tx;
        const splitCount = tx.isSplit && transactionSplits[tx.id] ? transactionSplits[tx.id].length : 0;
        return MOBILE_TX_H + splitCount * 24;
      }
      return MOBILE_TX_H;
    },
    overscan: 5,
  });

  const openSplitModal = (tx: Transaction) => {
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
  };

  const renderDesktopItem = (item: FlatItemDesktop) => {
    if (item.kind === 'group-header') {
      return (
        <div
          className="py-1.5 px-3 bg-slate-50 border-y border-slate-100 flex items-center"
          style={{ height: DESKTOP_GROUP_HEADER_H }}
        >
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{item.label}</span>
        </div>
      );
    }

    if (item.kind === 'split') {
      const { split, parentTx, idx } = item;
      return (
        <div
          key={`${parentTx.id}-split-${idx}`}
          className={`flex border-b border-slate-50 bg-blue-50/30 ${selectedSplitIds.has(split.id) ? 'bg-blue-100/50' : ''}`}
          style={{ height: DESKTOP_SPLIT_H }}
        >
          <div className="py-2 px-2 flex-none" style={{ width: '2.5rem' }}>
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
          </div>
          <div className="py-2 px-4 flex-none" style={{ width: '7.5rem' }} />
          <div className="py-2 px-4 pl-12 flex-1 min-w-0 overflow-hidden">
            <div className="flex items-center gap-2 overflow-hidden">
              <span className="text-slate-400 shrink-0">↳</span>
              <span className="text-slate-600 truncate min-w-0">{split.description}</span>
            </div>
            <div
              className="mt-0.5 overflow-hidden text-xs text-slate-500 whitespace-nowrap text-ellipsis"
              title={`${split.category || '—'} | ${getTransactionAccountLabel(split, parentTx)} | ${split.purpose || '—'}`}
            >
              <span className="font-medium text-slate-600">{split.category || '—'}</span>
              <span className="mx-1 text-slate-300">|</span>
              <span>{getTransactionAccountLabel(split, parentTx)}</span>
              <span className="mx-1 text-slate-300">|</span>
              <span>{split.purpose || '—'}</span>
            </div>
          </div>
          <div className={`py-2 px-4 flex-none text-right font-mono text-sm flex items-center justify-end ${(split.type || parentTx.type) === 'Income' ? 'text-green-600' : 'text-red-600'}`} style={{ width: '9rem' }}>
            {(split.type || parentTx.type) === 'Income' ? '+' : '-'}{formatCurrency(Math.abs(split.amount))}
          </div>
          <div className="py-2 px-4 flex-none" style={{ width: '10rem' }} />
          <div className="py-2 px-4 flex-none" style={{ width: '9rem' }} />
        </div>
      );
    }

    // kind === 'tx'
    const { tx } = item;
    const hasProjectId = tx.projectId && tx.projectId.trim() !== '';
    const hasPurpose = tx.purpose && tx.purpose.trim() !== '';

    const handleTxCheckbox = (e: React.ChangeEvent<HTMLInputElement>) => {
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
    };

    return (
      <div
        className={`flex items-center border-l-2 border-b border-slate-50 hover:bg-slate-50/80 transition-colors ${tx.type === 'Income' ? 'border-l-green-400' : 'border-l-red-400'} ${selectedTxIds.has(tx.id) ? 'bg-blue-50/60' : tx.status === 'Pending' ? 'bg-amber-50/40' : ''}`}
        style={{ height: DESKTOP_TX_H }}
      >
        <div className="py-4 px-2 flex-none" style={{ width: '2.5rem' }}>
          <input type="checkbox" checked={selectedTxIds.has(tx.id)} onChange={handleTxCheckbox} className="accent-blue-600 cursor-pointer" />
        </div>
        <div className="py-4 px-3 text-slate-500 whitespace-nowrap flex-none" style={{ width: '7.5rem' }}>{formatDate(tx.date)}</div>
        <div className="py-4 px-3 flex-1 min-w-0 overflow-hidden">
          <div className="flex items-center gap-2 overflow-hidden">
            {tx.isSplit
              ? <Badge variant="info" className="text-[10px] py-0 px-1.5 shrink-0">Split</Badge>
              : hasProjectId && hasPurpose
                ? <Badge variant="success" className="text-[10px] py-0 px-1.5 shrink-0">Categorized</Badge>
                : <Badge variant="warning" className="text-[10px] py-0 px-1.5 shrink-0">Uncategorized</Badge>
            }
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
            {tx.matchStatus === 'full' && <span className="shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0 rounded text-[10px] font-semibold bg-teal-100 text-teal-700"><Link2Off size={9} />Matched</span>}
            {tx.status === 'Voided' && <span className="shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0 rounded text-[10px] font-semibold bg-slate-200 text-slate-500"><Ban size={9} />Voided</span>}
            <span className="font-medium text-slate-600">{tx.isSplit ? 'Split' : (tx.category || '—')}</span>
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
        </div>
        <div className={`py-4 px-3 flex-none text-right font-mono font-bold ${tx.type === 'Income' ? 'text-green-600' : 'text-red-600'}`} style={{ width: '9rem' }}>
          {tx.type === 'Income' ? '+' : '-'}{formatCurrency(Math.abs(tx.amount))}
        </div>
        <div className={`py-4 px-3 flex-none text-right font-mono font-semibold ${tx.runningBalance >= 0 ? 'text-green-600' : 'text-red-600'}`} style={{ width: '10rem' }}>
          {formatCurrency(tx.runningBalance)}
        </div>
        <div className="py-4 px-3 flex-none" style={{ width: '9rem' }}>
          <div className="flex items-center justify-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => handleEditTransaction(tx)} className="text-slate-600 hover:text-blue-600 p-1" title="Edit transaction">
              <Edit size={16} />
            </Button>
            {tx.status === 'Reconciled' || tx.status === 'Partially Reconciled' ? (
              <Button variant="ghost" size="sm" onClick={() => handleVoidTransaction(tx)} className="text-slate-400 hover:text-red-600 p-1" title="Void reconciled transaction">
                <Ban size={16} />
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => handleDeleteTransaction(tx.id)} className="text-slate-600 hover:text-red-600 p-1" title="Delete transaction">
                <Trash2 size={16} />
              </Button>
            )}
            {tx.matchStatus === 'full' && tx.matchedBankTxIds?.length ? (
              <Button variant="ghost" size="sm" onClick={() => handleUnmatchTransaction(tx)} className="text-amber-500 hover:text-amber-700 p-1" title="Unmatch bank transaction">
                <Link2Off size={16} />
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => openSplitModal(tx)} className="text-blue-600 hover:text-blue-700 text-xs px-2" title={tx.isSplit ? 'Edit split' : 'Split transaction'}>
                {tx.isSplit ? 'Edit Split' : 'Split'}
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderMobileItem = (item: FlatItemMobile) => {
    if (item.kind === 'group-header') {
      return (
        <div className="py-1 px-1 flex items-end" style={{ height: MOBILE_GROUP_HEADER_H }}>
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{item.label}</span>
        </div>
      );
    }

    const { tx } = item;
    const splits = tx.isSplit && transactionSplits[tx.id] ? transactionSplits[tx.id] : [];
    const itemHeight = MOBILE_TX_H + splits.length * 24;

    const handleTxCheckbox = (e: React.ChangeEvent<HTMLInputElement>) => {
      const checked = e.target.checked;
      const nextTx = new Set(selectedTxIds);
      const nextSplits = new Set(selectedSplitIds);
      if (checked) {
        nextTx.add(tx.id);
        splits.forEach(s => nextSplits.add(s.id));
      } else {
        nextTx.delete(tx.id);
        splits.forEach(s => nextSplits.delete(s.id));
      }
      setSelectedTxIds(nextTx);
      setSelectedSplitIds(nextSplits);
    };

    return (
      <div className="px-1" style={{ height: itemHeight }}>
        <div className={`bg-white border rounded-xl overflow-hidden shadow-sm relative h-full ${selectedTxIds.has(tx.id) ? 'ring-2 ring-blue-500 bg-blue-50/20 border-blue-200' : tx.status === 'Pending' ? 'border-amber-200 bg-amber-50/20' : 'border-slate-100'}`}>
          <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-xl ${tx.type === 'Income' ? 'bg-green-400' : 'bg-red-400'}`} />
          <div className="pl-4 pr-3 pt-2.5 pb-2.5">
            {/* Row 1: checkbox + date + pending | amount */}
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="flex items-center gap-2 min-w-0">
                <input type="checkbox" checked={selectedTxIds.has(tx.id)} onChange={handleTxCheckbox} className="accent-blue-600 w-4 h-4 cursor-pointer shrink-0" />
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
                {tx.status === 'Reconciled' || tx.status === 'Partially Reconciled' ? (
                  <button onClick={() => handleVoidTransaction(tx)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors" title="Void reconciled transaction">
                    <Ban size={14} />
                  </button>
                ) : (
                  <button onClick={() => handleDeleteTransaction(tx.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors" title="Delete">
                    <Trash2 size={14} />
                  </button>
                )}
                {tx.matchStatus === 'full' && tx.matchedBankTxIds?.length ? (
                  <button onClick={() => handleUnmatchTransaction(tx)} className="p-1.5 rounded-lg text-amber-500 hover:text-amber-700 hover:bg-amber-50 transition-colors" title="Unmatch bank transaction">
                    <Link2Off size={14} />
                  </button>
                ) : (
                  <button onClick={() => openSplitModal(tx)} className="px-2 py-1 rounded-lg text-[11px] font-bold text-blue-600 hover:bg-blue-50 transition-colors">
                    {tx.isSplit ? 'Edit Split' : 'Split'}
                  </button>
                )}
              </div>
            </div>
            {/* Split details */}
            {splits.length > 0 && (
              <div className="mt-2 space-y-1.5 bg-blue-50/40 p-2 rounded-lg border border-blue-100/60">
                {splits.map((split, idx) => (
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
      </div>
    );
  };

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
          <div className="hidden md:block">
            {/* Sticky header row */}
            <div className="overflow-x-auto">
              <div style={{ minWidth: 760 }}>
                <div className="flex bg-slate-50 text-slate-500 border-b border-slate-100 sticky top-0 z-10">
                  <div className="py-3 px-2 font-semibold flex-none" style={{ width: '2.5rem' }}>
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
                  </div>
                  <div className="py-3 px-3 font-semibold whitespace-nowrap flex-none" style={{ width: '7.5rem' }}>Date</div>
                  <div className="py-3 px-3 font-semibold flex-1">Description</div>
                  <div className="py-3 px-3 font-semibold text-right whitespace-nowrap flex-none" style={{ width: '9rem' }}>Amount</div>
                  <div className="py-3 px-3 font-semibold text-right whitespace-nowrap flex-none" style={{ width: '10rem' }}>Bal.</div>
                  <div className="py-3 px-3 font-semibold text-center flex-none" style={{ width: '9rem' }}>Actions</div>
                </div>

                {/* Virtualized rows */}
                <div
                  ref={desktopScrollRef}
                  style={{ height: 'calc(100vh - 380px)', minHeight: 300, overflowY: 'auto' }}
                >
                  <div style={{ height: desktopVirtualizer.getTotalSize(), position: 'relative' }}>
                    {desktopVirtualizer.getVirtualItems().map(virtualRow => {
                      const item = flatDesktopItems[virtualRow.index];
                      const estimatedHeight =
                        item.kind === 'group-header' ? DESKTOP_GROUP_HEADER_H :
                        item.kind === 'split' ? DESKTOP_SPLIT_H :
                        DESKTOP_TX_H;
                      return (
                        <div
                          key={virtualRow.key}
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            height: estimatedHeight,
                            transform: `translateY(${virtualRow.start}px)`,
                          }}
                        >
                          {renderDesktopItem(item)}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Mobile View */}
          <div
            className="md:hidden"
            ref={mobileScrollRef}
            style={{ height: 'calc(100vh - 340px)', minHeight: 300, overflowY: 'auto' }}
          >
            <div style={{ height: mobileVirtualizer.getTotalSize(), position: 'relative' }}>
              {mobileVirtualizer.getVirtualItems().map(virtualRow => {
                const item = flatMobileItems[virtualRow.index];
                const estimatedHeight =
                  item.kind === 'group-header' ? MOBILE_GROUP_HEADER_H :
                  (() => {
                    const tx = item.tx;
                    const splitCount = tx.isSplit && transactionSplits[tx.id] ? transactionSplits[tx.id].length : 0;
                    return MOBILE_TX_H + splitCount * 24;
                  })();
                return (
                  <div
                    key={virtualRow.key}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: estimatedHeight,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    {renderMobileItem(item)}
                  </div>
                );
              })}
            </div>
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

export const TransactionsTab = React.memo(TransactionsTabBase);
