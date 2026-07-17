// Points Data Hook
import { PointsService, PointTransaction } from '../services/pointsService';
import { Member } from '../types';
import { useToast } from '../components/ui/Common';
import { useAuth } from './useAuth';
import { useFirestoreCollection } from './useFirestoreCollection';

export const usePoints = () => {
  const { member } = useAuth();
  const { showToast } = useToast();

  const isEligible = !!member && member.role !== 'GUEST' && member.role !== 'INACTIVE';

  const { data: pointHistory, loading: loading1, error: error1, reload: reloadHistory } = useFirestoreCollection<PointTransaction>({
    loader: () => PointsService.getMemberPointHistory(member?.id ?? ''),
    enabled: isEligible,
    deps: [member?.id, isEligible],
  });

  const { data: leaderboard, loading: loading2, error: error2, reload: reloadLeaderboard } = useFirestoreCollection<Member>({
    loader: () => PointsService.getLeaderboard(10, 'public', undefined, undefined),
    enabled: isEligible,
    deps: [isEligible],
  });

  const loading = loading1 || loading2;
  const error = error1 || error2;

  // Keep parameterized signatures for backward compatibility.
  // When called with a different memberId the hook still uses the current member;
  // callers that need arbitrary members should call PointsService directly.
  const loadPointHistory = async (_memberId?: string) => {
    try {
      await reloadHistory();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load point history';
      showToast(errorMessage, 'error');
    }
  };

  const loadLeaderboard = async (_limit?: number, _year?: number) => {
    try {
      await reloadLeaderboard();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load leaderboard';
      showToast(errorMessage, 'error');
    }
  };

  return {
    pointHistory,
    leaderboard,
    loading,
    error,
    loadPointHistory,
    loadLeaderboard,
  };
};
