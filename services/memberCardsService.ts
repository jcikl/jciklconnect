// Member Cards Service — keeps `memberCards/{memberId}` (the public directory card, Phase 0 WP2)
// in sync with `members`. The card is written AFTER the member doc has committed (CLAUDE.md §5.2:
// main doc first, side effects after), in its own writeBatch, and a card failure is logged but never
// fails the member save (e.g. while an older firestore.rules still denies memberCards writes).
// firestore.rules validates the card against the member doc (get/getAfter), so it works either way.
import { collection, doc, getDocs, query, where, writeBatch } from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/constants';
import type { Member, MemberCard } from '../types';
import { KL_LO_ID, buildMemberCard, shouldHaveCard, planCardSync, applyMemberUpdates } from '../utils/memberCard.mjs';
import { errorLoggingService } from './errorLoggingService';
import { isDevMode } from '../utils/devMode';
import { apiCache, CACHE_TTL_3MIN } from './cacheService';

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

const CACHE_KEY_INTERNATIONAL = 'memberCards:international';

/** A card with its document id (the member id). */
export type MemberCardWithId = MemberCard & { id: string };

export class MemberCardsService {
  /**
   * Cards shared with other chapters (`international == true`), all chapters, KL's own excluded.
   * Query shape: ONE `where('international','==',true)` query. firestore.rules allows it for both
   * active KL members (any card) and active externals (externalCanReadCard: international == true),
   * because Firestore can prove the filter from the query. Cached 3 min; read-only (cards are only
   * written by syncCards, and a stale list for 3 min is acceptable for a directory).
   */
  static async getInternationalCards(): Promise<MemberCardWithId[]> {
    if (isDevMode()) return [];
    return apiCache.getOrSet(CACHE_KEY_INTERNATIONAL, async () => {
      try {
        const snap = await getDocs(query(collection(db, COLLECTIONS.MEMBER_CARDS), where('international', '==', true)));
        return snap.docs
          .map(d => ({ id: d.id, ...(d.data() as MemberCard) }))
          .filter(c => c.loId !== KL_LO_ID);
      } catch (error) {
        errorLoggingService.logError(error instanceof Error ? error : new Error(String(error)), { context: 'MemberCardsService.getInternationalCards' });
        throw error;
      }
    }, CACHE_TTL_3MIN);
  }

  /**
   * Cards of the given chapters (KL users only: rules let active KL members list any card, by `loId ==`
   * or `in`; externals must use getInternationalCards). `in` queries are chunked by 30 (Firestore limit).
   * Cached 3 min per sorted id set.
   */
  static async getCardsByChapters(loIds: string[]): Promise<MemberCardWithId[]> {
    const ids = Array.from(new Set(loIds)).sort();
    if (isDevMode() || ids.length === 0) return [];
    return apiCache.getOrSet(`memberCards:chapters:${ids.join(',')}`, async () => {
      try {
        const chunks: string[][] = [];
        for (let i = 0; i < ids.length; i += 30) chunks.push(ids.slice(i, i + 30));
        const snaps = await Promise.all(
          chunks.map(chunk => getDocs(query(collection(db, COLLECTIONS.MEMBER_CARDS), where('loId', 'in', chunk)))),
        );
        return snaps.flatMap(snap => snap.docs.map(d => ({ id: d.id, ...(d.data() as MemberCard) })));
      } catch (error) {
        errorLoggingService.logError(error instanceof Error ? error : new Error(String(error)), { context: 'MemberCardsService.getCardsByChapters' });
        throw error;
      }
    }, CACHE_TTL_3MIN);
  }

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
