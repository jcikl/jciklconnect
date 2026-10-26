/** External (sister-chapter) account actions for components: create chapter admins, invite, status, resend. */
import { useCallback, useState } from 'react';
import { ExternalAccountsService, type ExternalInvitee, type ExternalCreateResponse } from '../services/externalAccountsService';
import { MembersService } from '../services/membersService';
import type { AffiliationStatus } from '../types/member';

export function useExternalAccounts() {
  const [busy, setBusy] = useState(false);

  const wrap = useCallback(async <T,>(fn: () => Promise<T>): Promise<T> => {
    setBusy(true);
    try { return await fn(); } finally { setBusy(false); }
  }, []);

  const createChapterAdmins = useCallback(
    (loId: string, members: ExternalInvitee[]): Promise<ExternalCreateResponse> =>
      wrap(() => ExternalAccountsService.createChapterAdmins(loId, members)),
    [wrap]
  );
  const inviteMembers = useCallback(
    (members: ExternalInvitee[], loId?: string): Promise<ExternalCreateResponse> =>
      wrap(() => ExternalAccountsService.inviteMembers(members, loId)),
    [wrap]
  );
  const setStatus = useCallback(
    (memberId: string, status: AffiliationStatus): Promise<void> => wrap(() => ExternalAccountsService.setStatus(memberId, status)),
    [wrap]
  );
  const resendInvite = useCallback(
    (memberId: string): Promise<boolean> => wrap(() => ExternalAccountsService.resendInvite(memberId)),
    [wrap]
  );

  /** PERMANENT delete of an external login account (server checks scope). */
  const deleteAccount = useCallback(
    (memberId: string): Promise<{ authDeleted: boolean }> => wrap(() => ExternalAccountsService.deleteAccount(memberId)),
    [wrap]
  );

  /**
   * Legacy sister-chapter doc without a login (old "Add Member": role MEMBER, loId != jcikl): soft-delete via
   * MembersService.deleteMember, which also releases the email slot and deletes the memberCards doc
   * (MemberCardsService.syncCards with forceDelete). Login-backed external docs are suspended instead (setStatus).
   */
  const removeLegacyMember = useCallback(
    (memberId: string): Promise<void> => wrap(() => MembersService.deleteMember(memberId)),
    [wrap]
  );

  return { busy, createChapterAdmins, inviteMembers, setStatus, resendInvite, deleteAccount, removeLegacyMember };
}
