import type { SisterChapter } from '../types/sisterChapter';
import type { MemberCardWithId } from '../services/memberCardsService';

export interface SisterChapterCard extends MemberCardWithId {
  sisterChapter: SisterChapter;
}

/** Attach each card's active sister chapter; cards of unknown/inactive chapters are dropped. */
export function attachSisterChapters(cards: MemberCardWithId[], chapters: SisterChapter[]): SisterChapterCard[] {
  const byId = new Map(chapters.map(c => [c.id, c]));
  return cards.flatMap(card => {
    const sisterChapter = byId.get(card.loId);
    return sisterChapter ? [{ ...card, sisterChapter }] : [];
  });
}
