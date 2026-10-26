import { useState, useEffect, useCallback } from 'react';
import { MemberCardsService } from '../services/memberCardsService';
import { MembersService } from '../services/membersService';
import { SisterChaptersService } from '../services/sisterChaptersService';
import type { SisterChapter } from '../types/sisterChapter';
import { attachSisterChapters, mergeCards, planCardQuery, type SisterChapterCard } from '../utils/internationalCards';
import { canViewCards } from '../utils/cardAccess';
import { useAuth } from './useAuth';
import { usePermissions } from './usePermissions';
import { useToast } from '../components/ui/Common';

/** International directory entry: a public member card (`memberCards`) plus its sister chapter. */
export type SisterChapterMember = SisterChapterCard;

/**
 * Sister-chapter people for the international directory, read from `memberCards` (never from `members`,
 * whose list rule only allows KL docs). KL users list the active chapters' cards (all people, as before);
 * externals list the `international == true` cards (incl. opted-in KL) plus their own chapter's cards.
 * Reciprocity: unless the viewer shares their own card (or is a KL admin) the cards query does NOT run
 * (`canView` false); `optIn()` turns sharing on, then loads the cards.
 * Chapters and cards fail independently (allSettled): a card failure keeps the chapter list.
 * `enabled: false` loads nothing (lets a view call the hook only for some viewers, e.g. externals).
 */
export function useSisterChapterMembers({ enabled = true }: { enabled?: boolean } = {}) {
  const { member } = useAuth();
  const { isExternal, effectiveRole } = usePermissions();
  const { showToast } = useToast();
  const canView = canViewCards(member, effectiveRole);
  const [members, setMembers] = useState<SisterChapterMember[]>([]);
  const [chapters, setChapters] = useState<SisterChapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [optingIn, setOptingIn] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!enabled) {
        setChapters([]);
        setMembers([]);
        setError(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      const [chaptersRes] = await Promise.allSettled([SisterChaptersService.getAll()]);
      const activeChapters = chaptersRes.status === 'fulfilled' ? chaptersRes.value.filter(c => c.isActive) : [];
      if (!canView) {
        // Not opted in: chapters only, no cards query (the rules would deny it).
        if (cancelled) return;
        setChapters(activeChapters);
        setMembers([]);
        setError(chaptersRes.status === 'rejected' ? 'Failed to load international members' : null);
        setLoading(false);
        return;
      }
      const plan = planCardQuery(isExternal, activeChapters, member?.loId);
      const [cardsRes] = await Promise.allSettled([
        plan.kind === 'international'
          ? Promise.all([
              MemberCardsService.getInternationalCards(),
              plan.ownLoId ? MemberCardsService.getCardsByChapters([plan.ownLoId]) : Promise.resolve([]),
            ]).then(([intl, own]) => mergeCards(intl, own))
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
  }, [enabled, isExternal, canView, member?.loId, reloadKey]);

  /** Turn on `privacy.shareCardInternationally` through MembersService.updateMember (which also syncs the card). */
  const optIn = useCallback(async () => {
    if (!member || optingIn) return;
    setOptingIn(true);
    try {
      await MembersService.updateMember(member.id, { privacy: { ...member.privacy, shareCardInternationally: true } } as any);
      // Drop any cached (possibly stale/empty) list and reload now that the viewer shares.
      MemberCardsService.invalidateCardsCache();
      setReloadKey(k => k + 1);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not update sharing', 'error');
    } finally {
      setOptingIn(false);
    }
  }, [member, optingIn, showToast]);

  return { members, chapters, loading, error, canView, optIn, optingIn };
}
