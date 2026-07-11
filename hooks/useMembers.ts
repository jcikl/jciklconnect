// Members Data Hook
import { useState, useEffect, useCallback } from 'react';
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

  const inDevMode = isDevMode() || isDevModeFromAuth;
  const isFullMember = !!(currentMember && ['MEMBER', 'BOARD', 'ADMIN'].includes(currentMember.role as string));
  const enabled = !authLoading && (inDevMode || isFullMember);

  const { data: members, loading, error, reload: loadMembers } = useFirestoreCollection<Member>({
    loader: () => MembersService.getAllMembers(loIdFilter ?? currentMember?.loId ?? undefined),
    enabled,
    deps: [loIdFilter, currentMember?.loId, currentMember?.role, isDevModeFromAuth, authLoading],
  });

  const createMember = async (memberData: MemberCreateInput) => {
    try {
      const id = await MembersService.createMember(memberData, user?.uid ?? undefined);
      await loadMembers();
      showToast('Member created successfully', 'success');
      return id;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create member';
      showToast(errorMessage, 'error');
      throw err;
    }
  };

  const updateMember = async (memberId: string, updates: Partial<Member>) => {
    try {
      await MembersService.updateMember(memberId, updates, user?.uid ?? undefined);
      await loadMembers();
      showToast('Member updated successfully', 'success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update member';
      showToast(errorMessage, 'error');
      throw err;
    }
  };

  const deleteMember = async (memberId: string) => {
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
    }
  };

  const batchUpdateMembers = async (memberIds: string[], updates: Partial<Member>) => {
    try {
      await MembersService.batchUpdateMembers(memberIds, updates);
      await loadMembers();
      showToast(`Successfully updated ${memberIds.length} members`, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update members', 'error');
      throw err;
    }
  };

  const batchDeleteMembers = async (memberIds: string[]) => {
    try {
      await MembersService.batchDeleteMembers(memberIds);
      await loadMembers();
      showToast(`Successfully deleted ${memberIds.length} members`, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete members', 'error');
      throw err;
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

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    try {
      const result = await MembersService.getMembersPaginated(pageSize, lastDoc ?? undefined);
      setMembers(prev => [...prev, ...result.members]);
      setLastDoc(result.lastDoc);
      setHasMore(result.hasMore);
    } finally {
      setLoading(false);
    }
  }, [loading, hasMore, lastDoc, pageSize]);

  // Initial load
  useEffect(() => {
    void loadMore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { members, loadMore, hasMore, loading };
};
