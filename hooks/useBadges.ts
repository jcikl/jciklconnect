// Badges Hook - Manages badge definitions and awards
import { useState, useEffect, useCallback } from 'react';
import { BadgeService, BadgeDefinition, BadgeAward } from '../services/badgeService';
import { useToast } from '../components/ui/Common';
import { useAuth } from './useAuth';
import { isDevMode } from '../utils/devMode';

export const useBadges = () => {
  const [badges, setBadges] = useState<BadgeDefinition[]>([]);
  const [memberBadges, setMemberBadges] = useState<Array<BadgeDefinition & { awardedAt: Date }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { member } = useAuth();
  const { showToast } = useToast();

  // Load all badges
  const loadBadges = useCallback(async () => {
    if (isDevMode()) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await BadgeService.getAllBadges();
      setBadges(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load badges';
      setError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  // Load member badges
  const loadMemberBadges = useCallback(async (memberId: string) => {
    if (isDevMode()) {
      setMemberBadges([]);
      return;
    }

    try {
      setError(null);
      const data = await BadgeService.getMemberBadges(memberId);
      setMemberBadges(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load member badges';
      setError(errorMessage);
      showToast(errorMessage, 'error');
    }
  }, [showToast]);

  // Create badge
  const createBadge = useCallback(async (badge: Omit<BadgeDefinition, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      setError(null);
      await BadgeService.createBadge(badge);
      await loadBadges();
      showToast('Badge created successfully', 'success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create badge';
      setError(errorMessage);
      showToast(errorMessage, 'error');
      throw err;
    }
  }, [showToast, loadBadges]);

  // Update badge
  const updateBadge = useCallback(async (badgeId: string, updates: Partial<BadgeDefinition>) => {
    try {
      setError(null);
      await BadgeService.updateBadge(badgeId, updates);
      await loadBadges();
      showToast('Badge updated successfully', 'success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update badge';
      setError(errorMessage);
      showToast(errorMessage, 'error');
      throw err;
    }
  }, [showToast, loadBadges]);

  // Delete badge
  const deleteBadge = useCallback(async (badgeId: string) => {
    try {
      setError(null);
      await BadgeService.deleteBadge(badgeId);
      await loadBadges();
      showToast('Badge deleted successfully', 'success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete badge';
      setError(errorMessage);
      showToast(errorMessage, 'error');
      throw err;
    }
  }, [showToast, loadBadges]);

  // Award badge
  const awardBadge = useCallback(async (
    badgeId: string,
    memberId: string,
    reason?: string
  ) => {
    try {
      setError(null);
      await BadgeService.awardBadge(badgeId, memberId, 'system', reason);
      await loadMemberBadges(memberId);
      showToast('Badge awarded successfully', 'success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to award badge';
      setError(errorMessage);
      showToast(errorMessage, 'error');
      throw err;
    }
  }, [showToast, loadMemberBadges]);

  // Initialize
  useEffect(() => {
    loadBadges();
  }, [loadBadges]);

  useEffect(() => {
    if (member) {
      loadMemberBadges(member.id);
    }
  }, [member, loadMemberBadges]);

  return {
    badges,
    memberBadges,
    loading,
    error,
    createBadge,
    updateBadge,
    deleteBadge,
    awardBadge,
    loadBadges,
    loadMemberBadges,
  };
};

