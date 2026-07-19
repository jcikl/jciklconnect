import { useState, useEffect } from 'react';
import { ToyyibService } from '../services/toyyibService';
import { TOYYIB_CONFIG } from '../config/constants';

interface ToyyibMode {
  isSandbox: boolean;
  hasProdKey: boolean;
  loading: boolean;
}

export function useToyyibMode(): ToyyibMode {
  const [state, setState] = useState<ToyyibMode>({
    isSandbox: TOYYIB_CONFIG.IS_SANDBOX,
    hasProdKey: false,
    loading: true,
  });

  useEffect(() => {
    ToyyibService.getMode()
      .then(({ isSandbox, hasProdKey }) => setState({ isSandbox, hasProdKey, loading: false }))
      .catch(() => setState(s => ({ ...s, loading: false })));
  }, []);

  return state;
}
