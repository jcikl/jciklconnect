/** JCI Malaysia sync for components: preview, save a conflict pick, apply. The server enforces developer-only. */
import { useCallback, useState } from 'react';
import { useAuth } from './useAuth';
import { usePermissions } from './usePermissions';
import {
  JciMalaysiaSyncService, type JciMalaysiaSyncPreview, type JciMalaysiaSyncApplyResult,
} from '../services/jciMalaysiaSyncService';

export function useJciMalaysiaSync() {
  const { member } = useAuth();
  const { isDeveloper: isDevModeDeveloper } = usePermissions();
  // Button visibility only; netlify/functions/jci-malaysia-sync checks members/{uid}.isDeveloper itself.
  const canSync = isDevModeDeveloper || member?.isDeveloper === true;

  const [preview, setPreview] = useState<JciMalaysiaSyncPreview | null>(null);
  const [result, setResult] = useState<JciMalaysiaSyncApplyResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPreview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPreview(await JciMalaysiaSyncService.preview());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  /** Save a pick, then refresh the preview. Throws so the caller can show a toast. */
  const pick = useCallback(async (memberId: string, sourceId: string) => {
    setBusy(true);
    try {
      await JciMalaysiaSyncService.pick(memberId, sourceId);
    } finally {
      setBusy(false);
    }
    await loadPreview();
  }, [loadPreview]);

  const apply = useCallback(async (selected: string[]) => {
    setBusy(true);
    setError(null);
    try {
      const res = await JciMalaysiaSyncService.apply(selected);
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

  return { canSync, preview, result, loading, busy, error, loadPreview, pick, apply, reset };
}
