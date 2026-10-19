import type { SisterChapter } from '../types/sisterChapter';
import type { MemberCardWithId } from '../services/memberCardsService';

export interface SisterChapterCard extends MemberCardWithId {
  sisterChapter: SisterChapter;
}

export type CardQueryPlan = { kind: 'international' } | { kind: 'chapters'; loIds: string[] };

/**
 * Which memberCards query the signed-in user may run. KL users list the active sister chapters' cards
 * (every sister-chapter person, opted in or not; they never log in). Externals may only list
 * `international == true` cards (firestore.rules externalCanReadCard).
 */
export function planCardQuery(isExternal: boolean, activeChapters: SisterChapter[]): CardQueryPlan {
  return isExternal ? { kind: 'international' } : { kind: 'chapters', loIds: activeChapters.map(c => c.id) };
}

/** Attach each card's active sister chapter; cards of unknown/inactive chapters are dropped. */
export function attachSisterChapters(cards: MemberCardWithId[], chapters: SisterChapter[]): SisterChapterCard[] {
  const byId = new Map(chapters.map(c => [c.id, c]));
  return cards.flatMap(card => {
    const sisterChapter = byId.get(card.loId);
    return sisterChapter ? [{ ...card, sisterChapter }] : [];
  });
}
