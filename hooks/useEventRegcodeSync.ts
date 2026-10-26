/** Developer-only back-fill of JCI Malaysia regcodes onto eventRegistrations: preview then apply. The server enforces developer-only. */
import { useCallback, useState } from 'react';
import { useAuth } from './useAuth';
import { usePermissions } from './usePermissions';
import {
  EventRegcodeService, type EventRegcodePreview, type EventRegcodeApplyResult,
} from '../services/eventRegcodeService';

export function useEventRegcodeSync() {
  const { member } = useAuth();
  const { isDeveloper: isDevModeDeveloper } = usePermissions();
  // Button visibility only; netlify/functions/jci-malaysia-regcode checks members/{uid}.isDeveloper itself.
  const canSync = isDevModeDeveloper || member?.isDeveloper === true;

  const [preview, setPreview] = useState<EventRegcodePreview | null>(null);
  const [result, setResult] = useState<EventRegcodeApplyResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPreview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPreview(await EventRegcodeService.preview());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const apply = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await EventRegcodeService.apply();
      setResult(res);
      return res;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      throw e;
    } finally {
      setBusy(false);
    }
  }, []);

  const reset = useCallback(() => {
    setPreview(null);
    setResult(null);
    setError(null);
  }, []);

  return { canSync, preview, result, loading, busy, error, loadPreview, apply, reset };
}
