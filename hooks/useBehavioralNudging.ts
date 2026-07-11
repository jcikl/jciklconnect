// Behavioral Nudging Hook
import { useCallback } from 'react';
import { BehavioralNudgingService, Nudge } from '../services/behavioralNudgingService';
import { useToast } from '../components/ui/Common';
import { useAuth } from './useAuth';
import { useFirestoreCollection } from './useFirestoreCollection';

export const useBehavioralNudging = () => {
  const { member } = useAuth();
  const { showToast } = useToast();

  const { data: allNudges, loading, error, reload } = useFirestoreCollection<Nudge>({
    loader: () => BehavioralNudgingService.getMemberNudges(member!.id),
    enabled: !!member,
    deps: [member?.id],
  });

  const nudges = allNudges.filter(n => !n.dismissed);

  const dismissNudge = useCallback(async (nudgeId: string) => {
    if (!member) return;
    try {
      await BehavioralNudgingService.dismissNudge(nudgeId, member.id);
      await reload();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to dismiss nudge';
      showToast(errorMessage, 'error');
    }
  }, [member, showToast, reload]);

  return {
    nudges,
    loading,
    error,
    dismissNudge,
    refreshNudges: reload,
  };
};
