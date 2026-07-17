import { useState, useEffect } from 'react';
import { guestAnalyticsService, GuestPageSummary } from '../services/guestAnalyticsService';

export function useGuestAnalytics(days: number) {
  const [data, setData] = useState<GuestPageSummary[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);
    guestAnalyticsService.getSummary(days)
      .then(result => { setData(result); setError(null); })
      .catch(err => setError(err instanceof Error ? err : new Error(String(err))))
      .finally(() => setLoading(false));
  }, [days]);

  return { data, loading, error };
}
