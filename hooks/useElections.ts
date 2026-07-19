import { useState, useEffect, useCallback } from 'react';
import ElectionsService from '../services/electionsService';
import { errorLoggingService } from '../services/errorLoggingService';
import { useAuth } from './useAuth';
import { DEFAULT_LO_ID } from '../config/constants';

export interface Election {
  id: string;
  title: string;
  status: 'draft' | 'open' | 'closed' | 'tallied';
  startDate: { toDate: () => Date };
  endDate: { toDate: () => Date };
  positions: string[];
  createdAt: { toDate: () => Date };
  createdBy: string;
  loId?: string;
  tally?: Record<string, Record<string, number>>;
}

interface UseElectionsReturn {
  elections: Election[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  castBallot: (electionId: string, votes: Record<string, string>) => Promise<void>;
  hasVoted: (electionId: string) => Promise<boolean>;
}

export function useElections(): UseElectionsReturn {
  const [elections, setElections] = useState<Election[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { member } = useAuth();
  const loId = (member as { loId?: string })?.loId ?? DEFAULT_LO_ID;

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await ElectionsService.getElections(loId);
      setElections(data as unknown as Election[]);
    } catch (e) {
      const msg = (e as Error).message ?? 'Failed to load elections';
      setError(msg);
      errorLoggingService.logError(e as Error, { component: 'useElections', action: 'reload' });
    } finally {
      setLoading(false);
    }
  }, [loId]);

  useEffect(() => { reload(); }, [reload]);

  const castBallot = useCallback(async (electionId: string, votes: Record<string, string>) => {
    if (!member?.id) throw new Error('Not authenticated');
    await ElectionsService.castBallot(electionId, member.id, votes);
  }, [member]);

  const hasVoted = useCallback(async (electionId: string): Promise<boolean> => {
    if (!member?.id) return false;
    return ElectionsService.hasVoted(electionId, member.id);
  }, [member]);

  return { elections, loading, error, reload, castBallot, hasVoted };
}
