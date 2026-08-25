import React from 'react';
import type { BankAccount } from '../../../types';
import { addAdministrativeProjectId, getAdministrativeProjectIds } from '../../../utils/administrativeProjectsStorage';
import { FinanceAccountDetailDrawer } from './FinanceAccountDetailDrawer';
import { FinanceAddAdminAccountModal } from './FinanceAddAdminAccountModal';
import { FinanceBatchSelectionBar } from './FinanceBatchSelectionBar';
import { FinanceDeleteConfirmDialogs } from './FinanceDeleteConfirmDialogs';

interface MonthlyAccountSummaryItem {
  month: number;
  openingBalance: number;
  income: number;
  expenses: number;
  closingBalance: number;
}

interface BatchOperationProgress {
  current: number;
  total: number;
}

interface FinanceBottomOverlaysProps {
  canOperateFinance: boolean;
  activeTab: string;
  hasDisplayTransactions: boolean;
  selectedTransactionCount: number;
  selectedSplitCount: number;
  batchOperationProgress: BatchOperationProgress | null;
  isAccountDetailOpen: boolean;
  detailAccount: BankAccount | null;
  detailYear: number;
  availableYears: number[];
  monthlyAccountSummary: MonthlyAccountSummaryItem[];
  isAddAdministrativeProjectOpen: boolean;
  deleteProjectTransactionId: string | null;
  showBatchDeleteConfirm: boolean;
  onCloseAccountDetail: () => void;
  onAccountDetailYearChange: (year: number) => void;
  onOpenBatchCategory: () => void;
  onOpenBatchDeleteConfirm: () => void;
  onClearSelection: () => void;
  onDeleteProjectTransaction: (transactionId: string) => void;
  onProjectDeleteConfirmChange: (transactionId: string | null) => void;
  onBatchDeleteConfirmChange: (isOpen: boolean) => void;
  onBatchDelete: () => void;
  onCloseAddAdministrativeProject: () => void;
  onAdministrativeProjectIdsChange: (ids: string[]) => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

export const FinanceBottomOverlays: React.FC<FinanceBottomOverlaysProps> = ({
  canOperateFinance,
  activeTab,
  hasDisplayTransactions,
  selectedTransactionCount,
  selectedSplitCount,
  batchOperationProgress,
  isAccountDetailOpen,
  detailAccount,
  detailYear,
  availableYears,
  monthlyAccountSummary,
  isAddAdministrativeProjectOpen,
  deleteProjectTransactionId,
  showBatchDeleteConfirm,
  onCloseAccountDetail,
  onAccountDetailYearChange,
  onOpenBatchCategory,
  onOpenBatchDeleteConfirm,
  onClearSelection,
  onDeleteProjectTransaction,
  onProjectDeleteConfirmChange,
  onBatchDeleteConfirmChange,
  onBatchDelete,
  onCloseAddAdministrativeProject,
  onAdministrativeProjectIdsChange,
  showToast,
}) => {
  const selectedRecordCount = selectedTransactionCount + selectedSplitCount;

  return (
    <>
      <FinanceAccountDetailDrawer
        isOpen={isAccountDetailOpen}
        account={detailAccount}
        detailYear={detailYear}
        availableYears={availableYears}
        monthlyAccountSummary={monthlyAccountSummary}
        onClose={onCloseAccountDetail}
        onYearChange={onAccountDetailYearChange}
      />

      {canOperateFinance && activeTab === 'Transactions' && hasDisplayTransactions && selectedRecordCount > 1 && (
        <FinanceBatchSelectionBar
          selectedTransactionCount={selectedTransactionCount}
          selectedSplitCount={selectedSplitCount}
          batchOperationProgress={batchOperationProgress}
          onOpenBatchCategory={onOpenBatchCategory}
          onOpenBatchDeleteConfirm={onOpenBatchDeleteConfirm}
          onClearSelection={onClearSelection}
        />
      )}

      <FinanceDeleteConfirmDialogs
        deleteProjectTransactionId={deleteProjectTransactionId}
        selectedRecordCount={selectedRecordCount}
        showBatchDeleteConfirm={showBatchDeleteConfirm}
        onConfirmProjectDelete={() => {
          if (deleteProjectTransactionId) {
            onDeleteProjectTransaction(deleteProjectTransactionId);
          }
          onProjectDeleteConfirmChange(null);
        }}
        onCancelProjectDelete={() => onProjectDeleteConfirmChange(null)}
        onConfirmBatchDelete={() => {
          onBatchDeleteConfirmChange(false);
          onBatchDelete();
        }}
        onCancelBatchDelete={() => onBatchDeleteConfirmChange(false)}
      />

      <FinanceAddAdminAccountModal
        isOpen={canOperateFinance && isAddAdministrativeProjectOpen}
        onClose={onCloseAddAdministrativeProject}
        onAdd={(name) => {
          addAdministrativeProjectId(name);
          onAdministrativeProjectIdsChange(getAdministrativeProjectIds());
          showToast('Admin account added successfully', 'success');
          onCloseAddAdministrativeProject();
        }}
      />
    </>
  );
};
