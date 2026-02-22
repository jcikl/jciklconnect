import React from 'react';
import { BatchImportModal } from '../../shared/batchImport/BatchImportModal';
import { memberImportConfig } from './config/memberImportConfig';
import { useMembers } from '../../../hooks/useMembers';
import { useAuth } from '../../../hooks/useAuth';
import { DEFAULT_LO_ID } from '../../../config/constants';

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
  const { member } = useAuth();
  const loId = (member as { loId?: string })?.loId ?? DEFAULT_LO_ID;
  const { members } = useMembers(loId);

  return (
    <BatchImportModal
      isOpen={isOpen}
      onClose={onClose}
      config={memberImportConfig}
      onImported={onImported}
      context={{ members }}
    />
  );
};

export default MemberBatchImportModal;
