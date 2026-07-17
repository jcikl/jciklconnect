import { useCallback, useRef } from 'react';
import { MembersService } from '../services/membersService';
import { useToast } from '../components/ui/Common';
import { useAuth } from './useAuth';
import type { Member, MemberCreateInput } from '../types';

interface UseMemberMutationsOptions {
  /** Called after any successful mutation so callers can reload their list. */
  onSuccess?: () => void | Promise<void>;
}

/**
 * Standalone mutations hook — wraps MembersService CRUD without subscribing
 * to the full members list. Use in components that need to mutate members
 * but already have the list from another source (e.g. GuestManagementView
 * which gets members via useMembers for the full list and only needs
 * updateMember here).
 */
export const useMemberMutations = ({ onSuccess }: UseMemberMutationsOptions = {}) => {
  const { showToast } = useToast();
  const { user } = useAuth();
  const isSubmittingRef = useRef(false);

  const createMember = useCallback(async (data: MemberCreateInput): Promise<string> => {
    if (isSubmittingRef.current) return '' as string;
    isSubmittingRef.current = true;
    try {
      const id = await MembersService.createMember(data, user?.uid ?? undefined);
      showToast('Member created successfully', 'success');
      await onSuccess?.();
      return id;
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to create member', 'error');
      throw err;
    } finally {
      isSubmittingRef.current = false;
    }
  }, [user?.uid, onSuccess, showToast]);

  const updateMember = useCallback(async (memberId: string, updates: Partial<Member>): Promise<void> => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    try {
      await MembersService.updateMember(memberId, updates, user?.uid ?? undefined);
      showToast('Member updated successfully', 'success');
      await onSuccess?.();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update member', 'error');
      throw err;
    } finally {
      isSubmittingRef.current = false;
    }
  }, [user?.uid, onSuccess, showToast]);

  const deleteMember = useCallback(async (memberId: string): Promise<void> => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    try {
      await MembersService.deleteMember(memberId);
      showToast('Member deleted successfully', 'success');
      await onSuccess?.();
    } catch (err) {
      const anyErr = err as any;
      if (anyErr?.code === 'permission-denied') {
        showToast('You are not authorized to delete members. Please contact an ADMIN.', 'error');
      } else {
        showToast(err instanceof Error ? err.message : 'Failed to delete member', 'error');
      }
      throw err;
    } finally {
      isSubmittingRef.current = false;
    }
  }, [onSuccess, showToast]);

  const batchUpdateMembers = useCallback(async (memberIds: string[], updates: Partial<Member>): Promise<void> => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    try {
      await MembersService.batchUpdateMembers(memberIds, updates);
      showToast(`Successfully updated ${memberIds.length} members`, 'success');
      await onSuccess?.();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update members', 'error');
      throw err;
    } finally {
      isSubmittingRef.current = false;
    }
  }, [onSuccess, showToast]);

  const batchDeleteMembers = useCallback(async (memberIds: string[]): Promise<void> => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    try {
      await MembersService.batchDeleteMembers(memberIds);
      showToast(`Successfully deleted ${memberIds.length} members`, 'success');
      await onSuccess?.();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete members', 'error');
      throw err;
    } finally {
      isSubmittingRef.current = false;
    }
  }, [onSuccess, showToast]);

  return { createMember, updateMember, deleteMember, batchUpdateMembers, batchDeleteMembers };
};
