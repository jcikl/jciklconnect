import React, { lazy, Suspense, useMemo } from 'react';
import type { BankAccount, Project, Transaction } from '../../../types';
import { FinanceService } from '../../../services/financeService';
import { ADMINISTRATIVE_PURPOSES } from '../../../config/constants';
import { AsyncErrorBoundary } from '../../ui/AsyncErrorBoundary';
import { AddBankAccountModal } from './AddBankAccountModal';
import { DuesRenewalModal } from './DuesRenewalModal';
import { FinancialReportsModal } from './FinancialReportsModal';

const TransactionSplitModal = lazy(() => import('./TransactionSplitModal').then(module => ({ default: module.TransactionSplitModal })));
const BankTransactionImportModal = lazy(() => import('./BankTransactionImportModal'));
const BankMatchingModal = lazy(() => import('./BankMatchingModal').then(module => ({ default: module.BankMatchingModal })));
const BatchCategoryModal = lazy(() => import('./BatchCategoryModal').then(module => ({ default: module.BatchCategoryModal })));

interface FinanceSummary {
  totalIncome: number;
  totalExpenses: number;
  netBalance: number;
  byCategory: Record<string, { income: number; expenses: number }>;
}

interface FinanceAuxiliaryModalsProps {
  canOperateFinance: boolean;
  isReportsModalOpen: boolean;
  isDuesRenewalModalOpen: boolean;
  isImportModalOpen: boolean;
  isSplitModalOpen: boolean;
  isBatchCategoryModalOpen: boolean;
  isAddAccountModalOpen: boolean;
  selectedTransaction: Transaction | null;
  matchingAccount: BankAccount | null;
  transactions: Transaction[];
  accounts: BankAccount[];
  summary: FinanceSummary | null;
  reportYear: number;
  reportMonth: number | null;
  fiscalYearStart: number;
  renewalYear: number;
  isRenewing: boolean;
  dynamicAdministrativeProjectIds: string[];
  members: Array<{ id: string; name: string; membershipType?: string }>;
  projects: Project[];
  projectYears: number[];
  projectPurposes: string[];
  selectedTxIds: Set<string>;
  selectedSplitIds: Set<string>;
  editingProjectPurposesByProject: Record<string, string[]>;
  currentUserId: string;
  onCloseReports: () => void;
  onReportYearChange: (year: number) => void;
  onReportMonthChange: (month: number | null) => void;
  onFiscalYearStartChange: (month: number) => void;
  onCloseDuesRenewal: () => void;
  onRenewalYearChange: (year: number) => void;
  onRenewingChange: (isRenewing: boolean) => void;
  onCloseImport: () => void;
  onCloseSplit: () => void;
  onCloseBatchCategory: () => void;
  onCloseAddAccount: () => void;
  onCloseBankMatching: () => void;
  onImported: () => Promise<void>;
  onSplitSuccess: () => void;
  onBatchCategorySuccess: () => void;
  onBankMatchingComplete: () => void;
  showToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  loadData: () => Promise<void>;
}

const toProjectOption = (project: Project) => {
  const projectDate = project.eventStartDate || project.startDate || project.date || project.proposedDate;
  return {
    id: project.id,
    name: project.name || project.title || project.id,
    year: projectDate ? new Date(projectDate).getFullYear() : undefined,
  };
};

export const FinanceAuxiliaryModals: React.FC<FinanceAuxiliaryModalsProps> = ({
  canOperateFinance,
  isReportsModalOpen,
  isDuesRenewalModalOpen,
  isImportModalOpen,
  isSplitModalOpen,
  isBatchCategoryModalOpen,
  isAddAccountModalOpen,
  selectedTransaction,
  matchingAccount,
  transactions,
  accounts,
  summary,
  reportYear,
  reportMonth,
  fiscalYearStart,
  renewalYear,
  isRenewing,
  dynamicAdministrativeProjectIds,
  members,
  projects,
  projectYears,
  projectPurposes,
  selectedTxIds,
  selectedSplitIds,
  editingProjectPurposesByProject,
  currentUserId,
  onCloseReports,
  onReportYearChange,
  onReportMonthChange,
  onFiscalYearStartChange,
  onCloseDuesRenewal,
  onRenewalYearChange,
  onRenewingChange,
  onCloseImport,
  onCloseSplit,
  onCloseBatchCategory,
  onCloseAddAccount,
  onCloseBankMatching,
  onImported,
  onSplitSuccess,
  onBatchCategorySuccess,
  onBankMatchingComplete,
  showToast,
  loadData,
}) => {
  const projectOptions = useMemo(() => projects.map(toProjectOption), [projects]);
  const adminPurposes = useMemo(() => [...ADMINISTRATIVE_PURPOSES], []);

  return (
    <>
      {isReportsModalOpen && (
        <AsyncErrorBoundary>
          <FinancialReportsModal
            isOpen={isReportsModalOpen}
            onClose={onCloseReports}
            transactions={transactions}
            accounts={accounts}
            projects={projectOptions}
            summary={summary}
            reportYear={reportYear}
            reportMonth={reportMonth}
            fiscalYearStart={fiscalYearStart}
            onYearChange={onReportYearChange}
            onMonthChange={onReportMonthChange}
            onFiscalYearStartChange={onFiscalYearStartChange}
          />
        </AsyncErrorBoundary>
      )}

      <DuesRenewalModal
        isOpen={canOperateFinance && isDuesRenewalModalOpen}
        onClose={onCloseDuesRenewal}
        year={renewalYear}
        onYearChange={onRenewalYearChange}
        onRenew={async () => {
          onRenewingChange(true);
          try {
            const result = await FinanceService.initiateDuesRenewal(renewalYear);
            showToast(
              `Dues renewal initiated: ${result.totalMembers} members processed, ${result.notificationsSent} notifications sent`,
              'success'
            );
            await loadData();
            onCloseDuesRenewal();
          } catch (err) {
            showToast('Failed to initiate dues renewal', 'error');
          } finally {
            onRenewingChange(false);
          }
        }}
        isRenewing={isRenewing}
      />

      <Suspense fallback={null}>
        <BankTransactionImportModal
          isOpen={canOperateFinance && isImportModalOpen}
          onClose={onCloseImport}
          onImported={onImported}
        />
      </Suspense>

      {selectedTransaction && (
        <Suspense fallback={null}>
          <TransactionSplitModal
            transaction={selectedTransaction}
            isOpen={canOperateFinance && isSplitModalOpen}
            adminProjectIds={dynamicAdministrativeProjectIds}
            memberOptions={members}
            projectOptions={projectOptions}
            administrativePurposes={adminPurposes}
            projectYears={projectYears}
            projectPurposes={projectPurposes}
            onClose={onCloseSplit}
            onSuccess={onSplitSuccess}
          />
        </Suspense>
      )}

      <Suspense fallback={null}>
        <BatchCategoryModal
          isOpen={canOperateFinance && isBatchCategoryModalOpen}
          onClose={onCloseBatchCategory}
          onSuccess={onBatchCategorySuccess}
          selectedTransactionIds={Array.from(selectedTxIds)}
          selectedSplitIds={Array.from(selectedSplitIds)}
          projects={projectOptions}
          members={members}
          administrativeProjectIds={dynamicAdministrativeProjectIds}
          adminPurposes={adminPurposes}
          projectYears={projectYears}
          projectPurposesByProject={editingProjectPurposesByProject}
        />
      </Suspense>

      <AddBankAccountModal
        isOpen={canOperateFinance && isAddAccountModalOpen}
        onClose={onCloseAddAccount}
        onAdded={loadData}
      />

      {canOperateFinance && matchingAccount && (
        <Suspense fallback={null}>
          <BankMatchingModal
            isOpen={!!matchingAccount}
            onClose={onCloseBankMatching}
            account={matchingAccount}
            currentUserId={currentUserId}
            onComplete={onBankMatchingComplete}
          />
        </Suspense>
      )}
    </>
  );
};
