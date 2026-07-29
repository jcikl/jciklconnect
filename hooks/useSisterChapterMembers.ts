import { useState, useEffect } from 'react';
import { MembersService } from '../services/membersService';
import { SisterChaptersService } from '../services/sisterChaptersService';
import type { Member } from '../types';
import type { SisterChapter } from '../types/sisterChapter';

export interface SisterChapterMember extends Member {
  sisterChapter: SisterChapter;
}

export function useSisterChapterMembers() {
  const [members, setMembers] = useState<SisterChapterMember[]>([]);
  const [chapters, setChapters] = useState<SisterChapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const allChapters = await SisterChaptersService.getAll();
        const activeChapters = allChapters.filter(c => c.isActive);
        if (cancelled) return;
        setChapters(activeChapters);

        const perChapter = await Promise.all(
          activeChapters.map(ch => MembersService.getAllMembers(ch.id))
        );
        if (cancelled) return;

        const flat: SisterChapterMember[] = perChapter.flatMap((mems, i) =>
          mems.map(m => ({ ...m, sisterChapter: activeChapters[i] }))
        );
        setMembers(flat);
        setError(null);
      } catch {
        if (!cancelled) setError('Failed to load international members');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  return { members, chapters, loading, error };
}
