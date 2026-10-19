import { useState, useEffect } from 'react';
import { MemberCardsService } from '../services/memberCardsService';
import { SisterChaptersService } from '../services/sisterChaptersService';
import type { SisterChapter } from '../types/sisterChapter';
import { attachSisterChapters, type SisterChapterCard } from '../utils/internationalCards';

/** International directory entry: a public member card (`memberCards`) plus its sister chapter. */
export type SisterChapterMember = SisterChapterCard;

/**
 * Sister-chapter people for the international directory, read from `memberCards` (never from `members`,
 * whose list rule only allows KL docs). One query, `international == true`, allowed for KL members and
 * active externals alike. Chapters and cards load independently so one failure does not blank the other.
 */
export function useSisterChapterMembers() {
  const [members, setMembers] = useState<SisterChapterMember[]>([]);
  const [chapters, setChapters] = useState<SisterChapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const [chaptersRes, cardsRes] = await Promise.allSettled([
        SisterChaptersService.getAll(),
        MemberCardsService.getInternationalCards(),
      ]);
      if (cancelled) return;
      const activeChapters = chaptersRes.status === 'fulfilled' ? chaptersRes.value.filter(c => c.isActive) : [];
      setChapters(activeChapters);
      setMembers(cardsRes.status === 'fulfilled' ? attachSisterChapters(cardsRes.value, activeChapters) : []);
      setError(chaptersRes.status === 'rejected' || cardsRes.status === 'rejected' ? 'Failed to load international members' : null);
      setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, []);

  return { members, chapters, loading, error };
}
