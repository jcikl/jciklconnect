import React from 'react';
import type { Project, Transaction } from '../../../types';
import { FinanceProjectTrackerTransactionsModal } from './FinanceProjectTrackerTransactionsModal';

interface LinkedBankTxInfo {
  isSplit: boolean;
  date: string;
  description: string;
  bankAccountName: string;
  amount: number;
}

interface FinanceProjectTrackerModalContainerProps {
  canOperateFinance: boolean;
  isOpen: boolean;
  selectedProjectFilter: string | null;
  selectedProjectInfo: Project | null;
  projectTransactions: Transaction[];
  loading: boolean;
  addForm: Partial<Transaction>;
  editForm: Partial<Transaction>;
  editingId: string | null;
  onClose: () => void;
  onPaste: (text: string) => void;
  onAddFormChange: (form: Partial<Transaction>) => void;
  onEditFormChange: (form: Partial<Transaction>) => void;
  onAddTransaction: () => void;
  onUpdateTransaction: (transactionId: string) => void;
  onEditingIdChange: (transactionId: string | null) => void;
  onDeleteTransaction: (transactionId: string) => void;
  getLinkedBankTxInfo: (transactionId: string) => LinkedBankTxInfo | null;
  showToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

export const FinanceProjectTrackerModalContainer: React.FC<FinanceProjectTrackerModalContainerProps> = ({
  canOperateFinance,
  isOpen,
  selectedProjectFilter,
  selectedProjectInfo,
  projectTransactions,
  loading,
  addForm,
  editForm,
  editingId,
  onClose,
  onPaste,
  onAddFormChange,
  onEditFormChange,
  onAddTransaction,
  onUpdateTransaction,
  onEditingIdChange,
  onDeleteTransaction,
  getLinkedBankTxInfo,
  showToast,
}) => {
  if (!selectedProjectFilter || !selectedProjectInfo) return null;

  return (
    <FinanceProjectTrackerTransactionsModal
      isOpen={canOperateFinance && isOpen}
      project={selectedProjectInfo}
      projectTransactions={projectTransactions}
      loading={loading}
      addForm={addForm}
      editForm={editForm}
      editingId={editingId}
      onClose={onClose}
      onPaste={onPaste}
      onAddFormChange={onAddFormChange}
      onEditFormChange={onEditFormChange}
      onAddTransaction={() => {
        const amount = addForm.amount;
        if (!amount || amount <= 0) {
          showToast('金额必须大于 0', 'error');
          return;
        }
        onAddTransaction();
      }}
      onUpdateTransaction={onUpdateTransaction}
      onEditTransaction={(transaction) => {
        onEditingIdChange(transaction.id);
        onEditFormChange(transaction);
      }}
      onCancelEdit={() => onEditingIdChange(null)}
      onDeleteTransaction={onDeleteTransaction}
      getLinkedBankTxInfo={getLinkedBankTxInfo}
    />
  );
};
