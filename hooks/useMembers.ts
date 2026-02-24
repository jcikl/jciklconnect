// Members Data Hook
import { useState, useEffect, useCallback } from 'react';
import { MembersService } from '../services/membersService';
import { Member } from '../types';
import { useToast } from '../components/ui/Common';
import { useAuth } from './useAuth';
import { isDevMode } from '../utils/devMode';

export const useMembers = (loIdFilter?: string | null) => {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();
  const { user, member: currentMember, loading: authLoading, isDevMode: isDevModeFromAuth } = useAuth();

  const loadMembers = useCallback(async () => {
    const inDevMode = isDevMode() || isDevModeFromAuth;
    const isFullMember = currentMember && ['MEMBER', 'BOARD', 'ADMIN', 'ORGANIZATION_SECRETARY', 'ORGANIZATION_FINANCE', 'ACTIVITY_FINANCE'].includes(currentMember.role);

    if (!inDevMode && !isFullMember) {
      setMembers([]);
      setLoading(false);
      setError(null);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const data = await MembersService.getAllMembers(loIdFilter ?? currentMember?.loId ?? undefined);
      setMembers(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load members';
      setError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  }, [loIdFilter, currentMember, isDevModeFromAuth, showToast]);

  useEffect(() => {
    if (authLoading) return;
    const inDevMode = isDevMode() || isDevModeFromAuth;
    const isFullMember = currentMember && ['MEMBER', 'BOARD', 'ADMIN', 'ORGANIZATION_SECRETARY', 'ORGANIZATION_FINANCE', 'ACTIVITY_FINANCE'].includes(currentMember.role);

    if (!inDevMode && !isFullMember) {
      setMembers([]);
      setLoading(false);
      setError(null);
      return;
    }
    loadMembers();
  }, [loadMembers, authLoading, currentMember, isDevModeFromAuth]);

  const createMember = async (memberData: Omit<Member, 'id'>) => {
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
      // Provide a clearer message for Firestore permission errors
      const anyErr = err as any;
      if (anyErr && anyErr.code === 'permission-denied') {
        showToast('You are not authorized to delete members. Please contact an ADMIN.', 'error');
      } else {
        const errorMessage = err instanceof Error ? err.message : 'Failed to delete member';
        showToast(errorMessage, 'error');
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
      const errorMessage = err instanceof Error ? err.message : 'Failed to update members';
      showToast(errorMessage, 'error');
      throw err;
    }
  };

  const batchDeleteMembers = async (memberIds: string[]) => {
    try {
      await MembersService.batchDeleteMembers(memberIds);
      await loadMembers();
      showToast(`Successfully deleted ${memberIds.length} members`, 'success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete members';
      showToast(errorMessage, 'error');
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
  };
};

