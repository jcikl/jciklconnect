import { useState, useEffect } from 'react';
import { SisterChaptersService } from '../services/sisterChaptersService';
import type { SisterChapter } from '../types/sisterChapter';

export function useSisterChapters() {
  const [chapters, setChapters] = useState<SisterChapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setChapters(await SisterChaptersService.getAll());
      setError(null);
    } catch {
      setError('Failed to load sister chapters');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return { chapters, loading, error, reload: load };
}
