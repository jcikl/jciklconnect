import React from 'react';
import type { BankAccount, Transaction } from '../../../types';
import { FinanceAlertsPanel } from './FinanceAlertsPanel';
import { FinanceBankAccountsCard } from './FinanceBankAccountsCard';
import { FinanceDashboardKpis } from './FinanceDashboardKpis';
import { FinanceRecentTransactionsCard } from './FinanceRecentTransactionsCard';

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

interface FinanceDashboardTabProps {
  loading: boolean;
  error?: string | null;
  canOperateFinance: boolean;
  canViewFinance: boolean;
  userId?: string;
  accounts: BankAccount[];
  transactions: Transaction[];
  summary: FinanceSummary | null;
  dashboardStats: FinanceDashboardStats;
  onViewAllTransactions: () => void;
  onAddAccount: () => void;
  onOpenAccount: (account: BankAccount) => void;
  onMatchAccount: (account: BankAccount) => void;
}

export const FinanceDashboardTab: React.FC<FinanceDashboardTabProps> = ({
  loading,
  error,
  canOperateFinance,
  canViewFinance,
  userId,
  accounts,
  transactions,
  summary,
  dashboardStats,
  onViewAllTransactions,
  onAddAccount,
  onOpenAccount,
  onMatchAccount,
}) => (
  <div className="space-y-6">
    {canViewFinance && userId && <FinanceAlertsPanel userId={userId} />}

    <FinanceDashboardKpis
      loading={loading}
      error={error}
      accounts={accounts}
      summary={summary}
      dashboardStats={dashboardStats}
      onPendingClick={onViewAllTransactions}
    />

    <div className="grid md:grid-cols-3 gap-6 min-w-0">
      <div className="md:col-span-2 space-y-6 order-2 md:order-1 min-w-0">
        <FinanceRecentTransactionsCard
          transactions={transactions}
          loading={loading}
          error={error}
          onViewAll={onViewAllTransactions}
        />
      </div>

      <div className="order-1 md:order-2 min-w-0">
        <FinanceBankAccountsCard
          accounts={accounts}
          canOperateFinance={canOperateFinance}
          onAddAccount={onAddAccount}
          onOpenAccount={onOpenAccount}
          onMatchAccount={onMatchAccount}
        />
      </div>
    </div>
  </div>
);
