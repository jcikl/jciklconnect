// Behavioral Nudging Hook
import { useState, useEffect, useCallback } from 'react';
import { BehavioralNudgingService, Nudge } from '../services/behavioralNudgingService';
import { useToast } from '../components/ui/Common';
import { useAuth } from './useAuth';
import { isDevMode } from '../utils/devMode';

export const useBehavioralNudging = () => {
  const [nudges, setNudges] = useState<Nudge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { member } = useAuth();
  const { showToast } = useToast();

  const loadNudges = useCallback(async () => {
    if (!member) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await BehavioralNudgingService.getMemberNudges(member.id);
      setNudges(data.filter(n => !n.dismissed));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load nudges';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [member]);

  const dismissNudge = useCallback(async (nudgeId: string) => {
    if (!member) return;

    try {
      await BehavioralNudgingService.dismissNudge(nudgeId, member.id);
      setNudges(prev => prev.filter(n => n.id !== nudgeId));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to dismiss nudge';
      showToast(errorMessage, 'error');
    }
  }, [member, showToast]);

  const refreshNudges = useCallback(async () => {
    await loadNudges();
  }, [loadNudges]);

  useEffect(() => {
    if (member) {
      loadNudges();
    }
  }, [member, loadNudges]);

  return {
    nudges,
    loading,
    error,
    dismissNudge,
    refreshNudges,
  };
};

