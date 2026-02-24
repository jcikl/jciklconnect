// Points Data Hook
import { useState, useEffect } from 'react';
import { PointsService, PointTransaction } from '../services/pointsService';
import { Member } from '../types';
import { useToast } from '../components/ui/Common';
import { useAuth } from './useAuth';

export const usePoints = () => {
  const [pointHistory, setPointHistory] = useState<PointTransaction[]>([]);
  const [leaderboard, setLeaderboard] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { member } = useAuth();
  const { showToast } = useToast();

  const loadPointHistory = async (memberId?: string) => {
    try {
      setLoading(true);
      setError(null);
      const targetMemberId = memberId || member?.id;
      if (!targetMemberId) return;

      const history = await PointsService.getMemberPointHistory(targetMemberId);
      setPointHistory(history);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load point history';
      setError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadLeaderboard = async (limit: number = 10) => {
    try {
      setLoading(true);
      setError(null);
      const data = await PointsService.getLeaderboard(limit);
      setLeaderboard(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load leaderboard';
      setError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const isFullMember = member && ['MEMBER', 'BOARD', 'ADMIN', 'ORGANIZATION_SECRETARY', 'ORGANIZATION_FINANCE', 'ACTIVITY_FINANCE'].includes(member.role);
    if (isFullMember) {
      loadPointHistory();
      loadLeaderboard();
    }
  }, [member]);

  return {
    pointHistory,
    leaderboard,
    loading,
    error,
    loadPointHistory,
    loadLeaderboard,
  };
};

