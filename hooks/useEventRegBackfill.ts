/** Developer-only back-fill of missing eventRegistrations from JCI Malaysia: preview then background apply. */
import { useCallback, useState } from 'react';
import {
  EventRegBackfillService, type BackfillPreview, type BackfillResolutions,
} from '../services/eventRegBackfillService';

export function useEventRegBackfill() {
  const [preview, setPreview] = useState<BackfillPreview | null>(null);
  const [resolutions, setResolutions] = useState<BackfillResolutions>({});
  const [started, setStarted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPreview = useCallback(async () => {
    setLoading(true);
    setError(null);
    setStarted(false);
    try {
      setPreview(await EventRegBackfillService.preview(resolutions));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [resolutions]);

  const apply = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await EventRegBackfillService.apply(resolutions);
      setStarted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      throw e;
    } finally {
      setBusy(false);
    }
  }, [resolutions]);

  const setResolution = useCallback((key: string, value: BackfillResolutions[string]) => {
    setResolutions(prev => ({ ...prev, [key]: value }));
  }, []);

  return { preview, resolutions, started, loading, busy, error, loadPreview, apply, setResolution };
}
