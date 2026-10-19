/**
 * Chapter roster for an active CHAPTER_ADMIN (own chapter) and the KL approval queue (pending_kl, KL admins).
 * Status changes / invites go through the external-accounts function (ExternalAccountsService), which keeps
 * memberCards in sync; after each action the list reloads.
 */
import { useCallback, useEffect, useState } from 'react';
import { ExternalAccountsService, type ExternalInvitee, type ExternalCreateResponse } from '../services/externalAccountsService';
import type { Member } from '../types';
import type { AffiliationStatus } from '../types/member';

function useMemberList(load: (() => Promise<Member[]>) | null) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(!!load);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!load) { setMembers([]); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    load()
      .then(list => { if (!cancelled) { setMembers(list); setError(null); } })
      .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load members'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [load, reloadKey]);

  const reload = useCallback(() => setReloadKey(k => k + 1), []);

  const setStatus = useCallback(async (memberId: string, status: AffiliationStatus) => {
    setBusyId(memberId);
    try {
      await ExternalAccountsService.setStatus(memberId, status);
      setReloadKey(k => k + 1);
    } finally {
      setBusyId(null);
    }
  }, []);

  return { members, loading, error, reload, setStatus, busyId, setBusyId };
}

/** Own-chapter members (any status). `loId` null → nothing is loaded. */
export function useChapterMembers(loId: string | null | undefined) {
  const load = useCallback(() => ExternalAccountsService.getChapterMembers(loId as string), [loId]);
  const list = useMemberList(loId ? load : null);
  const { setBusyId, reload } = list;
  const [inviting, setInviting] = useState(false);

  const resendInvite = useCallback(async (memberId: string): Promise<boolean> => {
    setBusyId(memberId);
    try { return await ExternalAccountsService.resendInvite(memberId); } finally { setBusyId(null); }
  }, [setBusyId]);

  const inviteMembers = useCallback(async (invitees: ExternalInvitee[]): Promise<ExternalCreateResponse> => {
    setInviting(true);
    try {
      const res = await ExternalAccountsService.inviteMembers(invitees);
      reload();
      return res;
    } finally {
      setInviting(false);
    }
  }, [reload]);

  return { ...list, resendInvite, inviteMembers, inviting };
}

/** KL admins: members waiting for KL approval across all chapters. */
export function usePendingKlApprovals(enabled: boolean) {
  const load = useCallback(() => ExternalAccountsService.getPendingKlApprovals(), []);
  return useMemberList(enabled ? load : null);
}
