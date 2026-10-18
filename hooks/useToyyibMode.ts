import { useState, useEffect, useCallback } from 'react';
import { ToyyibService } from '../services/toyyibService';
import { TOYYIB_CONFIG } from '../config/constants';

interface ToyyibMode {
  isSandbox: boolean;
  hasProdKey: boolean;
  loading: boolean;
  /** Re-read the mode from the server (call after setMode so the badge updates). */
  refresh: () => Promise<void>;
}

export function useToyyibMode(): ToyyibMode {
  const [state, setState] = useState<Omit<ToyyibMode, 'refresh'>>({
    isSandbox: TOYYIB_CONFIG.IS_SANDBOX,
    hasProdKey: false,
    loading: true,
  });

  const refresh = useCallback(async () => {
    setState(s => ({ ...s, loading: true }));
    try {
      const { isSandbox, hasProdKey } = await ToyyibService.getMode();
      setState({ isSandbox, hasProdKey, loading: false });
    } catch {
      setState(s => ({ ...s, loading: false }));
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { ...state, refresh };
}
