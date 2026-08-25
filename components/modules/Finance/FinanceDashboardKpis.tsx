import React from 'react';
import type { BankAccount } from '../../../types';
import { formatCurrency } from '../../../utils/formatUtils';
import { LoadingState } from '../../ui/Loading';

interface FinanceSummary {
  totalIncome: number;
  totalExpenses: number;
  netBalance: number;
}

interface FinanceDashboardStats {
  totalCash: number;
  pendingCount: number;
  pendingExpensesCount: number;
}

interface FinanceDashboardKpisProps {
  loading: boolean;
  error?: string | null;
  accounts: BankAccount[];
  summary: FinanceSummary | null;
  dashboardStats: FinanceDashboardStats;
  onPendingClick: () => void;
}

export const FinanceDashboardKpis: React.FC<FinanceDashboardKpisProps> = ({
  loading,
  error,
  accounts,
  summary,
  dashboardStats,
  onPendingClick,
}) => (
  <LoadingState loading={loading} error={error}>
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
      <div className="col-span-2 lg:col-span-1 bg-gradient-to-br from-jci-navy to-jci-blue rounded-xl p-4 text-white shadow-sm">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-white/70">Total Cash on Hand</p>
        <p className="text-2xl font-bold mt-1 tabular-nums">{formatCurrency(dashboardStats.totalCash, accounts[0]?.currency || 'MYR')}</p>
        <p className="text-xs text-white/60 mt-1">Across {accounts.length} account{accounts.length !== 1 ? 's' : ''}</p>
        {summary && (
          <div className="mt-2 flex gap-3 border-t border-white/20 pt-2">
            <span className="text-[10px] text-green-300 font-mono tabular-nums">â†‘ {formatCurrency(summary.totalIncome)}</span>
            <span className="text-[10px] text-red-300 font-mono tabular-nums">â†“ {formatCurrency(summary.totalExpenses)}</span>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Net Balance</p>
        <p className={`text-xl font-bold mt-1 leading-tight tabular-nums ${summary && summary.netBalance >= 0 ? 'text-slate-900' : 'text-red-600'}`}>
          {summary ? formatCurrency(summary.netBalance) : '—'}
        </p>
        <div className="mt-2 space-y-1">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
            <span className="text-[10px] text-slate-400 font-mono tabular-nums truncate">{summary ? formatCurrency(summary.totalIncome) : '—'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
            <span className="text-[10px] text-slate-400 font-mono tabular-nums truncate">{summary ? formatCurrency(summary.totalExpenses) : '—'}</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 cursor-pointer hover:border-amber-300 hover:bg-amber-50/30 transition-colors" onClick={onPendingClick}>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Pending Txs</p>
        <p className="text-2xl font-bold text-amber-500 mt-1 tabular-nums">{dashboardStats.pendingCount}</p>
        <p className="text-[10px] text-slate-400 mt-1">{dashboardStats.pendingExpensesCount} exp. need review</p>
      </div>
    </div>
  </LoadingState>
);
