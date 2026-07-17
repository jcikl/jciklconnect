import { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from '../components/ui/Common';

// ERR-R-002: fetch timeout — 15 s before we give up and show a user-facing message.
const FETCH_TIMEOUT_MS = 15_000;
// ERR-R-001: max automatic retries on transient errors.
const MAX_RETRIES = 3;
// ERR-R-001: backoff delays (ms) for each retry attempt (1 s, 2 s, 4 s).
const RETRY_DELAYS = [1000, 2000, 4000];

/** Wraps a loader promise with a 15-second timeout. */
function withTimeout<T>(promise: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const id = setTimeout(() => {
      reject(new Error('TIMEOUT'));
    }, FETCH_TIMEOUT_MS);
    promise.then(
      v => { clearTimeout(id); resolve(v); },
      e => { clearTimeout(id); reject(e); },
    );
  });
}

/** Returns a human-readable error message, distinguishing known error codes. */
function describeError(err: unknown): string {
  if (err instanceof Error) {
    if (err.message === 'TIMEOUT') {
      // ERR-R-002
      return 'Connection timed out — tap to retry';
    }
    const code = (err as any).code as string | undefined;
    if (code === 'resource-exhausted') {
      // ERR-R-004
      return 'Daily data limit reached — the app will recover automatically after midnight';
    }
    return err.message;
  }
  return 'Failed to load data';
}

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
 * Includes ERR-R-001 exponential-backoff retry (up to 3 attempts),
 * ERR-R-002 fetch timeout (15 s), and ERR-R-004 quota-error distinction.
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

  // Keep a ref to the latest loader so reload() never captures a stale closure.
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  /**
   * Attempts the loader up to MAX_RETRIES times with exponential backoff.
   * Only sets error state after all retries are exhausted (ERR-R-001).
   * Applies a 15-second timeout to every attempt (ERR-R-002).
   */
  const loadWithRetry = useCallback(async (
    getIgnore?: () => boolean,
  ): Promise<T[] | null> => {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await withTimeout(loaderRef.current());
      } catch (err) {
        const isQuota = (err as any)?.code === 'resource-exhausted';
        const isTimeout = err instanceof Error && err.message === 'TIMEOUT';
        const isLastAttempt = attempt === MAX_RETRIES;

        // Don't retry on quota exhaustion — it won't recover until midnight.
        if (isQuota || isLastAttempt) {
          throw err;
        }

        // ERR-R-001: wait before next retry; bail if the effect was cancelled.
        await new Promise<void>(resolve => setTimeout(resolve, RETRY_DELAYS[attempt] ?? 4000));
        if (getIgnore?.()) return null; // component unmounted — abort silently
      }
    }
    // Unreachable — TypeScript narrowing.
    throw new Error('Failed to load data');
  }, []);

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
      const result = await loadWithRetry();
      if (result !== null) setData(result);
    } catch (err) {
      const msg = describeError(err);
      setError(msg);
      showToast(msg, 'error');
      // ERR-R-004: log quota errors with a distinct tag so they surface in the error dashboard.
      if ((err as any)?.code === 'resource-exhausted') {
        console.warn('[useFirestoreCollection] Firestore quota-exceeded', err);
      }
    } finally {
      setLoading(false);
    }
  }, [enabled, loadWithRetry]);

  useEffect(() => {
    let ignore = false;
    const run = async () => {
      if (!enabled) {
        if (!ignore) { setData([]); setLoading(false); setError(null); }
        return;
      }
      if (!ignore) { setLoading(true); setError(null); }
      try {
        const result = await loadWithRetry(() => ignore);
        if (!ignore && result !== null) {
          setData(result);
          setLoading(false);
        }
      } catch (err) {
        if (!ignore) {
          const msg = describeError(err);
          setError(msg);
          showToast(msg, 'error');
          setLoading(false);
          if ((err as any)?.code === 'resource-exhausted') {
            console.warn('[useFirestoreCollection] Firestore quota-exceeded', err);
          }
        }
      }
    };
    run();
    return () => { ignore = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);

  return { data, loading, error, reload };
}
