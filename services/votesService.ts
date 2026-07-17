// Votes Service — governance motions/resolutions voted on by board
// FIX P0-A: castVote uses runTransaction with deterministic doc ID to prevent duplicate votes atomically
// FIX P1-B: tallyVotes / closeVote checks quorum before declaring a result
// FIX P1-C: castVote enforces vote.endDate (deadline) — rejects late submissions
// FIX P2-D: castVote enforces vote.allowAbstain; tallyVotes notes weightedVoting for future implementation
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  runTransaction,
  query,
  where,
  orderBy,
  arrayUnion,
  increment,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/constants';
import { withDevMode, isDevMode } from '../utils/devMode';
import { errorLoggingService } from './errorLoggingService';
import { Vote, VoteOption, VoteCast } from '../types';

// ─── Extended Firestore document shapes ──────────────────────────────────────
// The base Vote type from types/governance.ts does not include governance-
// specific fields that exist in the Firestore document.  We extend here.
export interface VoteDoc extends Omit<Vote, 'startDate' | 'endDate' | 'createdAt' | 'updatedAt'> {
  startDate: Timestamp;
  endDate: Timestamp;           // used as the vote deadline (P1-C)
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  quorum?: number;              // minimum casts required to be valid (P1-B)
  allowAbstain?: boolean;       // when false, 'abstain' choice is rejected (P2-D)
  weightedVoting?: boolean;     // reserved for weighted tally (P2-D)
  votedMemberIds?: string[];    // array of voter IDs for fast duplicate check
  totalVotes?: number;          // denormalized counter
  failReason?: string;          // set when status becomes 'failed'
}

export interface VoteCastDoc {
  id?: string;
  voteId: string;
  voterId: string;
  optionId: string;             // maps to VoteOption.id
  castAt: Timestamp;
}

export interface TallyResult {
  success: boolean;
  reason?: string;
  results?: Array<{ optionId: string; text: string; count: number }>;
  winner?: string;
}

// ─── Mock data for dev mode ───────────────────────────────────────────────────
const MOCK_VOTES: VoteDoc[] = [
  {
    id: 'mock-vote-1',
    question: 'Approve 2025 Annual Budget',
    description: 'Vote to approve the proposed annual budget for 2025',
    options: [
      { id: 'opt-yes', text: 'Yes', voteCount: 3 },
      { id: 'opt-no', text: 'No', voteCount: 1 },
    ],
    eligibleVoters: ['member-1', 'member-2', 'member-3', 'member-4'],
    startDate: Timestamp.fromDate(new Date('2025-01-01')),
    endDate: Timestamp.fromDate(new Date('2025-12-31')),
    anonymous: false,
    status: 'active',
    createdBy: 'admin-1',
    createdAt: Timestamp.fromDate(new Date('2025-01-01')),
    quorum: 3,
    allowAbstain: false,
    weightedVoting: false,
    votedMemberIds: ['member-1'],
    totalVotes: 4,
  },
];

// ─── Service class ────────────────────────────────────────────────────────────
export class VotesService {

  // ── Helpers ────────────────────────────────────────────────────────────────

  private static mapDoc(id: string, data: Record<string, unknown>): VoteDoc {
    return {
      id,
      ...data,
    } as VoteDoc;
  }

  private static toClientVote(voteDoc: VoteDoc): Vote & Partial<VoteDoc> {
    return {
      ...voteDoc,
      startDate: voteDoc.startDate?.toDate?.() ?? (voteDoc.startDate as unknown as Date),
      endDate: voteDoc.endDate?.toDate?.() ?? (voteDoc.endDate as unknown as Date),
      createdAt: voteDoc.createdAt?.toDate?.() ?? (voteDoc.createdAt as unknown as Date),
      updatedAt: voteDoc.updatedAt?.toDate?.() ?? (voteDoc.updatedAt as unknown as Date),
    } as unknown as Vote & Partial<VoteDoc>;
  }

  // ── Read operations ────────────────────────────────────────────────────────

  static async getAllVotes(): Promise<(Vote & Partial<VoteDoc>)[]> {
    return withDevMode(
      () => MOCK_VOTES.map(v => VotesService.toClientVote(v)),
      async () => {
        const snapshot = await getDocs(
          query(collection(db, COLLECTIONS.VOTES), orderBy('createdAt', 'desc'))
        );
        return snapshot.docs.map(d =>
          VotesService.toClientVote(VotesService.mapDoc(d.id, d.data() as Record<string, unknown>))
        );
      }
    );
  }

  static async getVoteById(voteId: string): Promise<(Vote & Partial<VoteDoc>) | null> {
    if (isDevMode()) {
      const mock = MOCK_VOTES.find(v => v.id === voteId);
      return mock ? VotesService.toClientVote(mock) : null;
    }
    try {
      const snap = await getDoc(doc(db, COLLECTIONS.VOTES, voteId));
      if (!snap.exists()) return null;
      return VotesService.toClientVote(
        VotesService.mapDoc(snap.id, snap.data() as Record<string, unknown>)
      );
    } catch (error) {
      errorLoggingService.logError(error as Error, { action: 'VotesService.getVoteById', additionalData: { voteId } });
      throw error;
    }
  }

  static async getActiveVotes(): Promise<(Vote & Partial<VoteDoc>)[]> {
    return withDevMode(
      () => MOCK_VOTES.filter(v => v.status === 'active').map(v => VotesService.toClientVote(v)),
      async () => {
        const snapshot = await getDocs(
          query(
            collection(db, COLLECTIONS.VOTES),
            where('status', '==', 'active'),
            orderBy('endDate', 'asc')
          )
        );
        return snapshot.docs.map(d =>
          VotesService.toClientVote(VotesService.mapDoc(d.id, d.data() as Record<string, unknown>))
        );
      }
    );
  }

  // ── Write operations ───────────────────────────────────────────────────────

  static async createVote(
    voteData: Omit<VoteDoc, 'id' | 'createdAt' | 'updatedAt' | 'totalVotes' | 'votedMemberIds'>
  ): Promise<string> {
    return withDevMode(
      () => `mock-vote-${Date.now()}`,
      async () => {
        const newVote = {
          ...voteData,
          totalVotes: 0,
          votedMemberIds: [],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        const docRef = await addDoc(collection(db, COLLECTIONS.VOTES), newVote);
        return docRef.id;
      }
    );
  }

  static async updateVote(voteId: string, updates: Partial<VoteDoc>): Promise<void> {
    if (isDevMode()) return;
    try {
      await updateDoc(doc(db, COLLECTIONS.VOTES, voteId), {
        ...updates,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      errorLoggingService.logError(error as Error, { action: 'VotesService.updateVote', additionalData: { voteId } });
      throw error;
    }
  }

  static async deleteVote(voteId: string): Promise<void> {
    if (isDevMode()) return;
    try {
      // P1 — delete voteCasts subcollection and parent in the same batch
      const castsSnap = await getDocs(collection(db, COLLECTIONS.VOTES, voteId, 'voteCasts'));
      const batch = writeBatch(db);
      castsSnap.docs.forEach(d => batch.delete(d.ref));
      batch.delete(doc(db, COLLECTIONS.VOTES, voteId));
      await batch.commit();
    } catch (error) {
      errorLoggingService.logError(error as Error, { action: 'VotesService.deleteVote', additionalData: { voteId } });
      throw error;
    }
  }

  // ── Cast vote (P0-A + P1-C + P2-D) ──────────────────────────────────────
  /**
   * Atomically cast a vote.
   *
   * P0-A: Uses runTransaction with a deterministic document ID
   *       (`{voteId}_{voterId}`) so a second concurrent request hits
   *       existingSnap.exists() === true and throws, preventing duplicate
   *       votes even under race conditions.
   *
   * P1-C: Enforces vote.endDate as the deadline — throws if the current
   *       time is past endDate before writing anything.
   *
   * P2-D: Enforces vote.allowAbstain — throws if choice === 'abstain' and
   *       the vote disallows abstentions.
   */
  static async castVote(
    voteId: string,
    voterId: string,
    optionId: string
  ): Promise<void> {
    if (isDevMode()) {
      const mock = MOCK_VOTES.find(v => v.id === voteId);
      if (!mock) throw new Error('Vote not found.');
      if (mock.votedMemberIds?.includes(voterId)) throw new Error('You have already voted on this item.');
      mock.votedMemberIds = [...(mock.votedMemberIds ?? []), voterId];
      mock.totalVotes = (mock.totalVotes ?? 0) + 1;
      return;
    }

    try {
      await runTransaction(db, async (transaction) => {
        // 1. Read the parent vote document to validate state
        const voteRef = doc(db, COLLECTIONS.VOTES, voteId);
        const voteSnap = await transaction.get(voteRef);
        if (!voteSnap.exists()) throw new Error('Vote not found.');

        const voteData = voteSnap.data() as VoteDoc;

        // P0 — eligible voters enforcement
        if (voteData.eligibleVoters && voteData.eligibleVoters.length > 0 && !voteData.eligibleVoters.includes(voterId)) {
          throw new Error('您不在此投票的资格名单内');
        }

        // P1-C — deadline enforcement
        if (voteData.endDate) {
          const deadline = voteData.endDate instanceof Timestamp
            ? voteData.endDate.toDate()
            : new Date(voteData.endDate as unknown as string);
          if (new Date() > deadline) {
            throw new Error('This vote has closed and is no longer accepting submissions.');
          }
        }

        if (voteData.status !== 'active') {
          throw new Error(`This vote is not accepting submissions (status: ${voteData.status}).`);
        }

        // P2-D — abstain enforcement
        if (optionId === 'abstain' && voteData.allowAbstain === false) {
          throw new Error('Abstaining is not allowed for this vote.');
        }

        // Validate the chosen option exists
        const validOption = voteData.options?.find((o: VoteOption) => o.id === optionId);
        if (!validOption) {
          throw new Error('Invalid option selected.');
        }

        // P0-A — deterministic doc ID prevents concurrent duplicates
        const voteCastDocRef = doc(
          db,
          COLLECTIONS.VOTES,
          voteId,
          'voteCasts',
          `${voteId}_${voterId}`
        );
        const existingSnap = await transaction.get(voteCastDocRef);
        if (existingSnap.exists()) {
          throw new Error('You have already voted on this item.');
        }

        // Write the cast record
        const castData: VoteCastDoc = {
          voteId,
          voterId,
          optionId,
          castAt: Timestamp.now(),
        };
        transaction.set(voteCastDocRef, castData);

        // Update denormalized counters on the parent vote document
        transaction.update(voteRef, {
          votedMemberIds: arrayUnion(voterId),
          totalVotes: increment(1),
          updatedAt: serverTimestamp(),
        });
      });
    } catch (error) {
      errorLoggingService.logError(error as Error, { action: 'VotesService.castVote', additionalData: { voteId, voterId } });
      throw error;
    }
  }

  // ── Get casts for a vote ───────────────────────────────────────────────────

  static async getVoteCasts(voteId: string): Promise<VoteCastDoc[]> {
    if (isDevMode()) return [];
    try {
      const snapshot = await getDocs(
        collection(db, COLLECTIONS.VOTES, voteId, 'voteCasts')
      );
      return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as VoteCastDoc));
    } catch (error) {
      errorLoggingService.logError(error as Error, { action: 'VotesService.getVoteCasts', additionalData: { voteId } });
      throw error;
    }
  }

  // ── Tally / close vote (P1-B + P2-D) ────────────────────────────────────
  /**
   * Tallies all cast votes and closes the vote.
   *
   * P1-B: If vote.quorum is set and total casts < quorum, the vote is
   *       marked 'failed' with failReason 'Quorum not reached' and no
   *       winner is declared.
   *
   * P2-D: If vote.weightedVoting is true a comment documents where to
   *       add per-member weight lookup.  Currently counts 1 per cast.
   */
  static async tallyVotes(voteId: string): Promise<TallyResult> {
    if (isDevMode()) {
      return { success: true, results: [], winner: undefined };
    }

    try {
      const voteRef = doc(db, COLLECTIONS.VOTES, voteId);

      // P1 — wrap entire tally in runTransaction to prevent concurrent double-close
      let tallyResult: TallyResult = { success: false, reason: 'Transaction incomplete' };

      await runTransaction(db, async (transaction) => {
        const voteSnap = await transaction.get(voteRef);
        if (!voteSnap.exists()) throw new Error('Vote not found.');

        const voteData = voteSnap.data() as VoteDoc;

        if (voteData.status === 'closed') {
          tallyResult = { success: false, reason: 'Vote is already closed.' };
          return; // skip writes
        }

        // Fetch all cast records from the subcollection (reads must happen before writes in a transaction)
        const castsSnap = await getDocs(
          collection(db, COLLECTIONS.VOTES, voteId, 'voteCasts')
        );
        const casts = castsSnap.docs.map(d => d.data() as VoteCastDoc);
        const totalCast = casts.length;

        // P1-B — quorum enforcement
        if (voteData.quorum && totalCast < voteData.quorum) {
          transaction.update(voteRef, {
            status: 'failed',
            failReason: 'Quorum not reached',
            closedAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
          });
          tallyResult = { success: false, reason: 'Quorum not reached' };
          return;
        }

        // P2-D — weighted voting note
        // TODO: implement weighted voting per member role.
        // When voteData.weightedVoting === true, look up each voter's
        // `votingWeight` from their member profile and multiply their cast
        // by that weight instead of counting 1 per cast.

        // Count votes per option
        const countMap: Record<string, number> = {};
        for (const option of voteData.options ?? []) {
          countMap[option.id] = 0;
        }
        for (const cast of casts) {
          if (cast.optionId in countMap) {
            countMap[cast.optionId] += 1;
          }
        }

        const results = (voteData.options ?? []).map((opt: VoteOption) => ({
          optionId: opt.id,
          text: opt.text,
          count: countMap[opt.id] ?? 0,
        }));

        // Determine winner (highest count)
        let winner: string | undefined;
        if (results.length > 0) {
          const sorted = [...results].sort((a, b) => b.count - a.count);
          if (sorted[0].count > 0) {
            winner = sorted[0].optionId;
          }
        }

        transaction.update(voteRef, {
          status: 'closed',
          tallyResults: results,
          winner: winner ?? null,
          totalVotes: totalCast,
          closedAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });

        tallyResult = { success: true, results, winner };
      });

      return tallyResult;
    } catch (error) {
      errorLoggingService.logError(error as Error, { action: 'VotesService.tallyVotes', additionalData: { voteId } });
      throw error;
    }
  }

  // Convenience alias
  static async closeVote(voteId: string): Promise<TallyResult> {
    return VotesService.tallyVotes(voteId);
  }

  // ── Status management ─────────────────────────────────────────────────────

  static async activateVote(voteId: string): Promise<void> {
    if (isDevMode()) return;
    try {
      await updateDoc(doc(db, COLLECTIONS.VOTES, voteId), {
        status: 'active',
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      errorLoggingService.logError(error as Error, { action: 'VotesService.activateVote', additionalData: { voteId } });
      throw error;
    }
  }

  // ── Eligible voter check ─────────────────────────────────────────────────

  static async isEligibleVoter(voteId: string, memberId: string): Promise<boolean> {
    if (isDevMode()) {
      const mock = MOCK_VOTES.find(v => v.id === voteId);
      return mock?.eligibleVoters?.includes(memberId) ?? false;
    }
    try {
      const snap = await getDoc(doc(db, COLLECTIONS.VOTES, voteId));
      if (!snap.exists()) return false;
      const data = snap.data() as VoteDoc;
      return data.eligibleVoters?.includes(memberId) ?? false;
    } catch (error) {
      errorLoggingService.logError(error as Error, { action: 'VotesService.isEligibleVoter', additionalData: { voteId, memberId } });
      return false;
    }
  }

  static async hasAlreadyVoted(voteId: string, memberId: string): Promise<boolean> {
    if (isDevMode()) {
      const mock = MOCK_VOTES.find(v => v.id === voteId);
      return mock?.votedMemberIds?.includes(memberId) ?? false;
    }
    try {
      const castRef = doc(db, COLLECTIONS.VOTES, voteId, 'voteCasts', `${voteId}_${memberId}`);
      const snap = await getDoc(castRef);
      return snap.exists();
    } catch (error) {
      errorLoggingService.logError(error as Error, { action: 'VotesService.hasAlreadyVoted', additionalData: { voteId, memberId } });
      return false;
    }
  }
}
