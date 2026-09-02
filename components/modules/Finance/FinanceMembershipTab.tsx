import React, { lazy, Suspense } from 'react';
import type { Transaction } from '../../../types';
import { formatCurrency } from '../../../utils/formatUtils';
import { formatDate } from '../../../utils/dateUtils';

const DuesRenewalDashboard = lazy(() => import('./DuesRenewalDashboard').then(m => ({ default: m.DuesRenewalDashboard })));

interface FinanceMembershipTabProps {
  year: number;
  membershipTransactions: Transaction[];
  members: Array<{
    id: string;
    name: string;
    fullName?: string;
    phone?: string;
    membershipType?: string;
    introducer?: string;
    tshirtSize?: string;
    jacketSize?: string;
    joinDate?: string;
    membership?: Record<string, unknown>;
  }>;
  canOperateFinance: boolean;
  isAdminUser: boolean;
  onEditTransaction: (transaction: Transaction) => void;
  onEditingMembershipFilterYearChange: (year: number) => void;
  onEditingMembershipMemberIdChange: (memberId: string) => void;
  onEditingMembershipYearChange: (year: number) => void;
  onOpenEditModal: () => void;
  onMembershipDataChanged: () => void | Promise<void>;
  onInitiateRenewal: () => void;
}

export const FinanceMembershipTab: React.FC<FinanceMembershipTabProps> = ({
  year,
  membershipTransactions,
  members,
  canOperateFinance,
  isAdminUser,
  onEditTransaction,
  onEditingMembershipFilterYearChange,
  onEditingMembershipMemberIdChange,
  onEditingMembershipYearChange,
  onOpenEditModal,
  onMembershipDataChanged,
  onInitiateRenewal,
}) => (
  <Suspense fallback={<div className="py-12 text-center text-slate-400 text-sm">Loading...</div>}>
    <DuesRenewalDashboard
      year={year}
      membershipTransactions={membershipTransactions}
      onEditMembershipTransaction={(tx, filterYear) => {
        onEditTransaction(tx);
        onEditingMembershipFilterYearChange(filterYear);
        onEditingMembershipMemberIdChange(tx.memberId || '');
        const yearFromProjectId = tx.projectId?.match(/^(\d+)\s+membership$/)?.[1];
        onEditingMembershipYearChange(yearFromProjectId ? parseInt(yearFromProjectId, 10) : new Date(tx.date).getFullYear());
        onOpenEditModal();
      }}
      hasEditPermission={canOperateFinance}
      isAdminUser={isAdminUser}
      formatCurrency={(n) => formatCurrency(n)}
      formatDate={(d) => formatDate(d)}
      onMembershipDataChanged={onMembershipDataChanged}
      members={members}
      onInitiateRenewal={onInitiateRenewal}
    />
  </Suspense>
);
