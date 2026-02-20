import React from 'react';
import { BatchImportModal } from '../../shared/batchImport/BatchImportModal';
import { memberImportConfig } from './config/memberImportConfig';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onImported: () => void;
}

/**
 * Member Batch Import Modal
 * Lightweight wrapper around the generic BatchImportModal
 * Supports both CSV upload and TSV paste with auto-matching column headers
 */
export const MemberBatchImportModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onImported,
}) => {
  return (
    <BatchImportModal
      isOpen={isOpen}
      onClose={onClose}
      config={memberImportConfig}
      onImported={onImported}
    />
  );
};

export default MemberBatchImportModal;
