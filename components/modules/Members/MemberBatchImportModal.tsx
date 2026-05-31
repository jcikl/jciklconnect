import React, { useEffect, useState } from 'react';
import { BatchImportModal } from '../../shared/batchImport/BatchImportModal';
import { memberImportConfig } from './config/memberImportConfig';
import { useMembers } from '../../../hooks/useMembers';
import { useAuth } from '../../../hooks/useAuth';
import { DEFAULT_LO_ID } from '../../../config/constants';
import {
  DEFAULT_MEMBERSHIP_RULES,
  MembershipConfigService,
} from '../../../services/membershipConfigService';
import { MembershipRuleConfig, MembershipType } from '../../../types';

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
  const [membershipRules, setMembershipRules] = useState<
    Record<MembershipType, MembershipRuleConfig>
  >(DEFAULT_MEMBERSHIP_RULES);

  useEffect(() => {
    if (!isOpen) return;
    MembershipConfigService.getRules().then(setMembershipRules).catch(() => {
      setMembershipRules(DEFAULT_MEMBERSHIP_RULES);
    });
  }, [isOpen]);

  return (
    <BatchImportModal
      isOpen={isOpen}
      onClose={onClose}
      config={memberImportConfig}
      onImported={onImported}
      context={{ members, membershipRules }}
    />
  );
};

export default MemberBatchImportModal;
