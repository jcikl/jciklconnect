import { useState, useEffect, useCallback } from 'react';
import { useToast } from '../components/ui/Common';

interface UseFirestoreCollectionOptions<T> {
  loader: () => Promise<T[]>;
  /** Skip fetching when false (e.g. permission guard). Defaults to true. */
  enabled?: boolean;
  /** Values that trigger a re-fetch when changed (like useEffect deps). */
  deps?: any[];
}

interface UseFirestoreCollectionResult<T> {
  data: T[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

/**
 * Base hook for Firestore list queries.
 * Handles loading/error state, toast on error, and permission-gated fetching.
 * Wrap this in domain hooks (useMembers, useEvents, etc.) to add CRUD mutations.
 */
export function useFirestoreCollection<T>({
  loader,
  enabled = true,
  deps = [],
}: UseFirestoreCollectionOptions<T>): UseFirestoreCollectionResult<T> {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

  const reload = useCallback(async () => {
    if (!enabled) {
      setData([]);
      setLoading(false);
      setError(null);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      setData(await loader());
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load data';
      setError(msg);
      showToast(msg, 'error');
      throw err;
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, loading, error, reload };
}
