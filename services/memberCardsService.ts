// Member Cards Service — keeps `memberCards/{memberId}` (the public directory card, Phase 0 WP2)
// in sync with `members`. The card is written in the SAME writeBatch / transaction as the member
// write wherever the path allows, because firestore.rules validates it with getAfter(member doc)
// (loId and international must match the member doc after the write).
import { doc, writeBatch, type WriteBatch, type Transaction as FirestoreTransaction } from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/constants';
import type { Member, MemberCard } from '../types';
import { buildMemberCard, shouldHaveCard, planCardSync, applyMemberUpdates } from '../utils/memberCard.mjs';
import { errorLoggingService } from './errorLoggingService';

export type CardSyncAction = 'upsert' | 'delete' | 'none';

// No cache: this service only writes. If reads are added, add an invalidateCardsCache() and call it
// from every method below.
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
   * Adds the card write for before -> after to an existing batch (same commit as the member write).
   * Returns the action taken; 'none' means no op was added to the batch.
   */
  static addToBatch(
    batch: WriteBatch,
    memberId: string,
    before: Partial<Member> | null,
    after: Partial<Member>,
    opts?: { forceDelete?: boolean },
  ): CardSyncAction {
    const action = this.plan(before, after, opts);
    const ref = doc(db, COLLECTIONS.MEMBER_CARDS, memberId);
    if (action === 'upsert') batch.set(ref, this.buildCard(after));
    else if (action === 'delete') batch.delete(ref);
    return action;
  }

  /** Same as addToBatch, for a runTransaction (member create). */
  static addToTransaction(txn: FirestoreTransaction, memberId: string, after: Partial<Member>): CardSyncAction {
    const action = this.plan(null, after);
    if (action === 'upsert') txn.set(doc(db, COLLECTIONS.MEMBER_CARDS, memberId), this.buildCard(after));
    return action;
  }

  /** Unconditional delete op for a batch (member deleted / made INACTIVE). Deleting a missing doc is a no-op. */
  static deleteInBatch(batch: WriteBatch, memberId: string): void {
    batch.delete(doc(db, COLLECTIONS.MEMBER_CARDS, memberId));
  }

  /** Standalone delete (no member write in the same batch). Errors are logged and rethrown. */
  static async deleteCard(memberId: string): Promise<void> {
    try {
      const batch = writeBatch(db);
      this.deleteInBatch(batch, memberId);
      await batch.commit();
    } catch (error) {
      errorLoggingService.logError(error instanceof Error ? error : new Error(String(error)), { context: 'MemberCardsService.deleteCard', additionalInfo: `memberId=${memberId}` });
      throw error;
    }
  }
}
