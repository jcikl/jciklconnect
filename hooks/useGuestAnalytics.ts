import { useState, useEffect } from 'react';
import { guestAnalyticsService, GuestPageSummary } from '../services/guestAnalyticsService';

export function useGuestAnalytics(days: number) {
  const [data, setData] = useState<GuestPageSummary[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    guestAnalyticsService.getSummary(days)
      .then(r => { if (!ignore) { setData(r); setError(null); } })
      .catch(e => { if (!ignore) setError(e instanceof Error ? e : new Error(String(e))); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [days]);

  return { data, loading, error };
}
