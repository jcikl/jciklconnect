import type { SisterChapter } from '../types/sisterChapter';
import type { MemberCardWithId } from '../services/memberCardsService';

export interface SisterChapterCard extends MemberCardWithId {
  sisterChapter: SisterChapter;
}

export type CardQueryPlan = { kind: 'international'; ownLoId?: string } | { kind: 'chapters'; loIds: string[] };

/** Synthetic chapter entry so KL cards resolve a chapter for externals (KL is not a `sisterChapters` doc). */
export const KL_CHAPTER: SisterChapter = { id: 'jcikl', name: 'JCI Kuala Lumpur', country: 'Malaysia' } as SisterChapter;

/**
 * Which memberCards query the signed-in user may run. KL users list the active sister chapters' cards
 * (every sister-chapter person, opted in or not; they never log in). Externals list the
 * `international == true` cards (firestore.rules externalCanReadCard) plus, when `ownLoId` is given,
 * their own chapter's cards (allowed once the viewer has opted in).
 */
export function planCardQuery(isExternal: boolean, activeChapters: SisterChapter[], ownLoId?: string): CardQueryPlan {
  return isExternal
    ? (ownLoId ? { kind: 'international', ownLoId } : { kind: 'international' })
    : { kind: 'chapters', loIds: activeChapters.map(c => c.id) };
}

/** Merge card lists, keeping the first occurrence of each card id. */
export function mergeCards(...lists: MemberCardWithId[][]): MemberCardWithId[] {
  const seen = new Set<string>();
  return lists.flat().filter(c => (seen.has(c.id) ? false : (seen.add(c.id), true)));
}

/** Attach each card's active sister chapter; cards of unknown/inactive chapters are dropped (KL is always known). */
export function attachSisterChapters(cards: MemberCardWithId[], chapters: SisterChapter[]): SisterChapterCard[] {
  const byId = new Map([KL_CHAPTER, ...chapters].map(c => [c.id, c]));
  return cards.flatMap(card => {
    const sisterChapter = byId.get(card.loId);
    return sisterChapter ? [{ ...card, sisterChapter }] : [];
  });
}
