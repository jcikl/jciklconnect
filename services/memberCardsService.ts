// Member Cards Service — keeps `memberCards/{memberId}` (the public directory card, Phase 0 WP2)
// in sync with `members`. The card is written AFTER the member doc has committed (CLAUDE.md §5.2:
// main doc first, side effects after), in its own writeBatch, and a card failure is logged but never
// fails the member save (e.g. while an older firestore.rules still denies memberCards writes).
// firestore.rules validates the card against the member doc (get/getAfter), so it works either way.
import { doc, writeBatch } from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/constants';
import type { Member, MemberCard } from '../types';
import { buildMemberCard, shouldHaveCard, planCardSync, applyMemberUpdates } from '../utils/memberCard.mjs';
import { errorLoggingService } from './errorLoggingService';
import { isDevMode } from '../utils/devMode';

export type CardSyncAction = 'upsert' | 'delete' | 'none';

/** One member's before -> after change (before null = new member / unknown). */
export interface CardSyncInput {
  memberId: string;
  before: Partial<Member> | null;
  after: Partial<Member>;
  /** Delete the card even if `before` did not qualify (member deleted). */
  forceDelete?: boolean;
}

const BATCH_SIZE = 400;

// No cache: this service only writes. If reads are added, add an invalidateCardsCache() and call it
// from every write method below.
export class MemberCardsService {
  static buildCard(member: Partial<Member>, nowIso?: string): MemberCard {
    return buildMemberCard(member, nowIso) as MemberCard;
  }

  static shouldHaveCard(member: Partial<Member> | null | undefined): boolean {
    return shouldHaveCard(member);
  }

  /** Member snapshot after an updateDoc-style payload (dot-paths supported). */
  static applyUpdates(member: Partial<Member> | null, updates: Record<string, unknown>): Partial<Member> {
    return applyMemberUpdates(member, updates);
  }

  /** Decide the card action for a before -> after member change (see planCardSync). */
  static plan(before: Partial<Member> | null, after: Partial<Member> | null, opts?: { forceDelete?: boolean }): CardSyncAction {
    return planCardSync(before, after, opts);
  }

  /**
   * Applies the planned card upserts/deletes for already-committed member writes, chunked (<= 400 per
   * batch). Never throws: failures are logged through errorLoggingService so the member save stands.
   * Returns the number of card ops that were committed.
   */
  static async syncCards(inputs: CardSyncInput[]): Promise<number> {
    if (isDevMode()) return 0;
    const ops: Array<{ memberId: string; action: 'upsert' | 'delete'; after: Partial<Member> }> = [];
    for (const { memberId, before, after, forceDelete } of inputs) {
      const action = this.plan(before, after, { forceDelete });
      if (action !== 'none') ops.push({ memberId, action, after });
    }
    let committed = 0;
    for (let i = 0; i < ops.length; i += BATCH_SIZE) {
      const chunk = ops.slice(i, i + BATCH_SIZE);
      try {
        const batch = writeBatch(db);
        const nowIso = new Date().toISOString();
        for (const { memberId, action, after } of chunk) {
          const ref = doc(db, COLLECTIONS.MEMBER_CARDS, memberId);
          if (action === 'upsert') batch.set(ref, this.buildCard(after, nowIso));
          else batch.delete(ref);
        }
        await batch.commit();
        committed += chunk.length;
      } catch (error) {
        errorLoggingService.logError(error instanceof Error ? error : new Error(String(error)), {
          context: 'MemberCardsService.syncCards',
          additionalInfo: `member write succeeded; card sync failed for ${chunk.length} card(s), e.g. ${chunk[0]?.memberId}`,
        });
      }
    }
    return committed;
  }
}
