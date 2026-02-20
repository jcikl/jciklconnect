import React from 'react';
import { BatchImportModal } from '../../shared/batchImport/BatchImportModal';
import { bankTransactionImportConfig } from './config/bankTransactionImportConfig';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onImported: () => void;
}

/**
 * Bank Transaction Import Modal
 * Lightweight wrapper around the generic BatchImportModal
 */

export const BankTransactionImportModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onImported,
}) => {
  return (
    <BatchImportModal
      isOpen={isOpen}
      onClose={onClose}
      config={bankTransactionImportConfig}
      onImported={onImported}
    />
  );
};

export default BankTransactionImportModal;
