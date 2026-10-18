import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BatchImportModal } from '../../shared/batchImport/BatchImportModal';
import { memberImportConfig } from './config/memberImportConfig';
import { FixAuthPanel } from './FixAuthPanel';
import { useMembers } from '../../../hooks/useMembers';
import { useAuth } from '../../../hooks/useAuth';
import { usePermissions } from '../../../hooks/usePermissions';
import { useMemberAuth } from '../../../hooks/useMemberAuth';
import { useToast } from '../../ui/Common';
import { DEFAULT_LO_ID } from '../../../config/constants';
import {
  DEFAULT_MEMBERSHIP_RULES,
  MembershipConfigService,
} from '../../../services/membershipConfigService';
import { MembershipRuleConfig, MembershipType, UserRole } from '../../../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onImported: () => void;
}

/**
 * Member Batch Import Modal
 * Lightweight wrapper around the generic BatchImportModal
 * Supports both CSV upload and TSV paste with auto-matching column headers.
 * New members get a Firebase Auth login account (uid = member id) right after import;
 * SUPER_ADMIN also sees the Fix Auth panel to back-fill members imported earlier.
 */
export const MemberBatchImportModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onImported,
}) => {
  const { member } = useAuth();
  const { effectiveRole } = usePermissions();
  const { createForMembers } = useMemberAuth();
  const { showToast } = useToast();
  const loId = (member as { loId?: string })?.loId ?? DEFAULT_LO_ID;
  const { members } = useMembers(loId);
  const [membershipRules, setMembershipRules] = useState<
    Record<MembershipType, MembershipRuleConfig>
  >(DEFAULT_MEMBERSHIP_RULES);
  // Filled by memberImportConfig.importer with the ids of newly created members.
  const createdMemberIds = useRef<string[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    MembershipConfigService.getRules().then(setMembershipRules).catch(() => {
      setMembershipRules(DEFAULT_MEMBERSHIP_RULES);
    });
  }, [isOpen]);

  const handleImported = useCallback(() => {
    onImported();
    const ids = createdMemberIds.current.splice(0);
    if (ids.length === 0) return;
    // Profiles are already saved; a failure here only means the accounts must be back-filled with Fix Auth.
    createForMembers(ids)
      .then(results => {
        const created = results.filter(r => r.status === 'created').length;
        const needsReview = results.length - created - results.filter(r => r.status === 'ready').length;
        showToast(
          `Login accounts: ${created} created${needsReview ? `, ${needsReview} need review (use Fix Auth)` : ''}`,
          needsReview ? 'warning' : 'success'
        );
      })
      .catch(() => showToast('Members imported, but login accounts could not be created — run Fix Auth', 'error'));
  }, [onImported, createForMembers, showToast]);

  return (
    <BatchImportModal
      isOpen={isOpen}
      onClose={onClose}
      config={memberImportConfig}
      onImported={handleImported}
      context={{ members, membershipRules, createdMemberIds: createdMemberIds.current }}
    >
      {effectiveRole === UserRole.SUPER_ADMIN && <FixAuthPanel members={members} />}
    </BatchImportModal>
  );
};

export default MemberBatchImportModal;
