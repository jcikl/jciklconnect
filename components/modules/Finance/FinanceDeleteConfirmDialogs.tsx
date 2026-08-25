import React from 'react';
import { ConfirmDialog } from '../../ui/Common';

interface FinanceDeleteConfirmDialogsProps {
  deleteProjectTransactionId: string | null;
  selectedRecordCount: number;
  showBatchDeleteConfirm: boolean;
  onConfirmProjectDelete: () => void;
  onCancelProjectDelete: () => void;
  onConfirmBatchDelete: () => void;
  onCancelBatchDelete: () => void;
}

export const FinanceDeleteConfirmDialogs: React.FC<FinanceDeleteConfirmDialogsProps> = ({
  deleteProjectTransactionId,
  selectedRecordCount,
  showBatchDeleteConfirm,
  onConfirmProjectDelete,
  onCancelProjectDelete,
  onConfirmBatchDelete,
  onCancelBatchDelete,
}) => (
  <>
    <ConfirmDialog
      open={!!deleteProjectTransactionId}
      title="Delete Project Transaction"
      message="Are you sure you want to delete this project transaction? This cannot be undone."
      confirmLabel="Delete"
      variant="danger"
      onConfirm={onConfirmProjectDelete}
      onCancel={onCancelProjectDelete}
    />

    <ConfirmDialog
      open={showBatchDeleteConfirm}
      title="Delete Selected Transactions"
      message={`Will delete ${selectedRecordCount} record(s). This operation cannot be undone.`}
      confirmLabel="Delete All"
      variant="danger"
      onConfirm={onConfirmBatchDelete}
      onCancel={onCancelBatchDelete}
    />
  </>
);
