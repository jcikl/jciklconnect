// Members Data Hook
import { useState, useEffect, useCallback, useRef } from 'react';
import { DocumentSnapshot } from 'firebase/firestore';
import { MembersService } from '../services/membersService';
import { Member, MemberCreateInput } from '../types';
import { useToast } from '../components/ui/Common';
import { useAuth } from './useAuth';
import { isDevMode } from '../utils/devMode';
import { useFirestoreCollection } from './useFirestoreCollection';

export interface UseMembersResult {
  members: Member[];
  loading: boolean;
  error: string | null;
  loadMembers: () => Promise<void>;
  createMember: (memberData: MemberCreateInput) => Promise<string>;
  updateMember: (memberId: string, updates: Partial<Member>) => Promise<void>;
  deleteMember: (memberId: string) => Promise<void>;
  batchUpdateMembers: (memberIds: string[], updates: Partial<Member>) => Promise<void>;
  batchDeleteMembers: (memberIds: string[]) => Promise<void>;
}

export const useMembers = (loIdFilter?: string | null): UseMembersResult => {
  const { showToast } = useToast();
  const { user, member: currentMember, loading: authLoading, isDevMode: isDevModeFromAuth } = useAuth();
  const isCreatingRef = useRef(false);
  const isUpdatingRef = useRef(false);
  const isDeletingRef = useRef(false);
  const isBatchUpdatingRef = useRef(false);
  const isBatchDeletingRef = useRef(false);

  const inDevMode = isDevMode() || isDevModeFromAuth;
  const isFullMember = !!(currentMember && ['MEMBER', 'BOARD', 'ADMIN', 'SUPER_ADMIN'].includes(currentMember.role as string));
  const enabled = !authLoading && (inDevMode || isFullMember);

  const { data: members, loading, error, reload: loadMembers } = useFirestoreCollection<Member>({
    loader: () => MembersService.getAllMembers(loIdFilter ?? currentMember?.loId ?? undefined),
    enabled,
    deps: [loIdFilter, currentMember?.loId, currentMember?.role, isDevModeFromAuth, authLoading],
  });

  const createMember = async (memberData: MemberCreateInput) => {
    if (isCreatingRef.current) return '' as string;
    isCreatingRef.current = true;
    try {
      const id = await MembersService.createMember(memberData, user?.uid ?? undefined);
      await loadMembers();
      showToast('Member created successfully', 'success');
      return id;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create member';
      showToast(errorMessage, 'error');
      throw err;
    } finally {
      isCreatingRef.current = false;
    }
  };

  const updateMember = async (memberId: string, updates: Partial<Member>) => {
    if (isUpdatingRef.current) return;
    isUpdatingRef.current = true;
    try {
      await MembersService.updateMember(memberId, updates, user?.uid ?? undefined);
      await loadMembers();
      showToast('Member updated successfully', 'success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update member';
      showToast(errorMessage, 'error');
      throw err;
    } finally {
      isUpdatingRef.current = false;
    }
  };

  const deleteMember = async (memberId: string) => {
    if (isDeletingRef.current) return;
    isDeletingRef.current = true;
    try {
      await MembersService.deleteMember(memberId);
      await loadMembers();
      showToast('Member deleted successfully', 'success');
    } catch (err) {
      const anyErr = err as any;
      if (anyErr?.code === 'permission-denied') {
        showToast('You are not authorized to delete members. Please contact an ADMIN.', 'error');
      } else {
        showToast(err instanceof Error ? err.message : 'Failed to delete member', 'error');
      }
      throw err;
    } finally {
      isDeletingRef.current = false;
    }
  };

  const batchUpdateMembers = async (memberIds: string[], updates: Partial<Member>) => {
    if (isBatchUpdatingRef.current) return;
    isBatchUpdatingRef.current = true;
    try {
      await MembersService.batchUpdateMembers(memberIds, updates);
      await loadMembers();
      showToast(`Successfully updated ${memberIds.length} members`, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update members', 'error');
      throw err;
    } finally {
      isBatchUpdatingRef.current = false;
    }
  };

  const batchDeleteMembers = async (memberIds: string[]) => {
    if (isBatchDeletingRef.current) return;
    isBatchDeletingRef.current = true;
    try {
      await MembersService.batchDeleteMembers(memberIds);
      await loadMembers();
      showToast(`Successfully deleted ${memberIds.length} members`, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete members', 'error');
      throw err;
    } finally {
      isBatchDeletingRef.current = false;
    }
  };

  return {
    members,
    loading,
    error,
    loadMembers,
    createMember,
    updateMember,
    deleteMember,
    batchUpdateMembers,
    batchDeleteMembers,
  } satisfies UseMembersResult;
};

export interface UsePaginatedMembersResult {
  members: Member[];
  loadMore: () => Promise<void>;
  hasMore: boolean;
  loading: boolean;
  /** ERR-R-006: error message from the last failed loadMore(), null when healthy. */
  error: string | null;
}

/**
 * Paginated members hook for list views (e.g. MembersView).
 * Keeps appending pages; call `loadMore()` to fetch the next page.
 * Distinct from `useMembers` which fetches all members (used for dropdowns etc.).
 */
export const usePaginatedMembers = (pageSize = 50): UsePaginatedMembersResult => {
  const [members, setMembers] = useState<Member[]>([]);
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  // ERR-R-006: expose error so callers can surface a failure state instead of empty+no-spinner.
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    setError(null);
    try {
      const result = await MembersService.getMembersPaginated(pageSize, lastDoc ?? undefined);
      setMembers(prev => [...prev, ...result.members]);
      setLastDoc(result.lastDoc);
      setHasMore(result.hasMore);
    } catch (err) {
      // ERR-R-006: catch errors so they don't propagate as unhandled rejections.
      const msg = err instanceof Error ? err.message : 'Failed to load members';
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  }, [loading, hasMore, lastDoc, pageSize, showToast]);

  // Initial load
  useEffect(() => {
    void loadMore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { members, loadMore, hasMore, loading, error };
};
