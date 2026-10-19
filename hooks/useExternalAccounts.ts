/** External (sister-chapter) account actions for components: create chapter admins, invite, status, resend. */
import { useCallback, useState } from 'react';
import { ExternalAccountsService, type ExternalInvitee, type ExternalCreateResponse } from '../services/externalAccountsService';
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

  return { busy, createChapterAdmins, inviteMembers, setStatus, resendInvite };
}
