import { useState, useEffect } from 'react';
import { MemberCardsService } from '../services/memberCardsService';
import { SisterChaptersService } from '../services/sisterChaptersService';
import type { SisterChapter } from '../types/sisterChapter';
import { attachSisterChapters, planCardQuery, type SisterChapterCard } from '../utils/internationalCards';
import { usePermissions } from './usePermissions';

/** International directory entry: a public member card (`memberCards`) plus its sister chapter. */
export type SisterChapterMember = SisterChapterCard;

/**
 * Sister-chapter people for the international directory, read from `memberCards` (never from `members`,
 * whose list rule only allows KL docs). KL users list the active chapters' cards (all people, as before);
 * externals list only `international == true` cards (the only shape the rules allow them).
 * Chapters and cards fail independently (allSettled): a card failure keeps the chapter list.
 */
export function useSisterChapterMembers() {
  const { isExternal } = usePermissions();
  const [members, setMembers] = useState<SisterChapterMember[]>([]);
  const [chapters, setChapters] = useState<SisterChapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const [chaptersRes] = await Promise.allSettled([SisterChaptersService.getAll()]);
      const activeChapters = chaptersRes.status === 'fulfilled' ? chaptersRes.value.filter(c => c.isActive) : [];
      const plan = planCardQuery(isExternal, activeChapters);
      const [cardsRes] = await Promise.allSettled([
        plan.kind === 'international'
          ? MemberCardsService.getInternationalCards()
          : MemberCardsService.getCardsByChapters(plan.loIds),
      ]);
      if (cancelled) return;
      setChapters(activeChapters);
      setMembers(cardsRes.status === 'fulfilled' ? attachSisterChapters(cardsRes.value, activeChapters) : []);
      setError(chaptersRes.status === 'rejected' || cardsRes.status === 'rejected' ? 'Failed to load international members' : null);
      setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [isExternal]);

  return { members, chapters, loading, error };
}
