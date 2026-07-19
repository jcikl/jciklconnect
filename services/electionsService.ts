import {
  collection, doc, getDoc, getDocs, addDoc,
  updateDoc, query, where, orderBy, Timestamp, runTransaction, limit
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import { COLLECTIONS } from '@/config/constants';
import { isDevMode } from '@/utils/devMode';
import { apiCache as cacheService } from './cacheService';
import { errorLoggingService } from './errorLoggingService';

// Minimal Election types (until types.ts has them)
interface Election {
  id: string;
  title: string;
  status: 'draft' | 'open' | 'closed' | 'tallied';
  startDate: Timestamp;
  endDate: Timestamp;
  positions: string[];
  createdAt: Timestamp;
  createdBy: string;
  loId?: string;
}

interface Ballot {
  id: string;
  electionId: string;
  voterId: string;
  votes: Record<string, string>; // position -> candidateId
  submittedAt: Timestamp;
}

export class ElectionsService {
  static async getElection(electionId: string): Promise<Election | null> {
    if (isDevMode()) return null;
    try {
      const snap = await getDoc(doc(db, COLLECTIONS.ELECTIONS, electionId));
      return snap.exists() ? { id: snap.id, ...snap.data() } as Election : null;
    } catch (e) {
      errorLoggingService.logError(e as Error, { component: 'ElectionsService', action: 'getElection' });
      throw e;
    }
  }

  static async getElections(loId?: string): Promise<Election[]> {
    if (isDevMode()) return [];
    const cacheKey = `elections:${loId || 'all'}`;
    const cached = cacheService.get<Election[]>(cacheKey);
    if (cached) return cached;
    try {
      const col = COLLECTIONS.ELECTIONS;
      const q = loId
        ? query(collection(db, col), where('loId', '==', loId), orderBy('createdAt', 'desc'))
        : query(collection(db, col), orderBy('createdAt', 'desc'), limit(100));
      const snap = await getDocs(q);
      const result = snap.docs.map(d => ({ id: d.id, ...d.data() }) as Election);
      cacheService.set(cacheKey, result, 180 * 1000);
      return result;
    } catch (e) {
      errorLoggingService.logError(e as Error, { component: 'ElectionsService', action: 'getElections' });
      throw e;
    }
  }

  static async createElection(data: Omit<Election, 'id' | 'createdAt' | 'status'>): Promise<string> {
    if (isDevMode()) return 'dev-election-id';
    try {
      const ref = await addDoc(collection(db, COLLECTIONS.ELECTIONS), {
        ...data,
        status: 'draft',
        createdAt: Timestamp.now(),
      });
      cacheService.deleteByPrefix('elections:');
      return ref.id;
    } catch (e) {
      errorLoggingService.logError(e as Error, { component: 'ElectionsService', action: 'createElection' });
      throw e;
    }
  }

  /**
   * Cast a ballot atomically. Uses a deterministic ballot ID {voterId}_{electionId}
   * so a second castBallot call for the same voter hits ballotSnap.exists() and throws.
   * The transaction reads the election status and throws if not 'open'.
   * P0 Fix: ID order changed to voterId_electionId to match Firestore rule:
   *   ballotId == request.auth.uid + '_' + electionId
   */
  static async castBallot(electionId: string, voterId: string, votes: Record<string, string>): Promise<void> {
    if (isDevMode()) return;
    const col = COLLECTIONS.ELECTIONS;
    const ballotsCol = `${col}/${electionId}/ballots`;
    const ballotId = `${voterId}_${electionId}`;
    const ballotRef = doc(db, ballotsCol, ballotId);
    const electionRef = doc(db, col, electionId);

    await runTransaction(db, async (txn) => {
      const [electionSnap, ballotSnap] = await Promise.all([
        txn.get(electionRef),
        txn.get(ballotRef),
      ]);

      if (!electionSnap.exists()) throw new Error('Election not found');
      const election = electionSnap.data() as Election;
      if (election.status !== 'open') throw new Error(`Election is not open (status: ${election.status})`);
      if (ballotSnap.exists()) throw new Error('You have already voted in this election');

      txn.set(ballotRef, {
        electionId,
        voterId,
        votes,
        submittedAt: Timestamp.now(),
      });
    });
  }

  static async hasVoted(electionId: string, voterId: string): Promise<boolean> {
    if (isDevMode()) return false;
    const col = COLLECTIONS.ELECTIONS;
    const ballotId = `${electionId}_${voterId}`;
    const snap = await getDoc(doc(db, `${col}/${electionId}/ballots`, ballotId));
    return snap.exists();
  }

  static async openElection(electionId: string): Promise<void> {
    if (isDevMode()) return;
    const electionRef = doc(db, COLLECTIONS.ELECTIONS, electionId);
    // P1 Fix 8: use runTransaction so concurrent openElection calls cannot both
    // pass the status check and both write.
    await runTransaction(db, async (txn) => {
      const snap = await txn.get(electionRef);
      if (!snap.exists()) throw new Error('Election not found');
      const data = snap.data() as Election;
      if (data.status !== 'draft') {
        throw new Error(`Cannot open election in status '${data.status}'. Election must be in 'draft' status first.`);
      }
      txn.update(electionRef, {
        status: 'open',
        openedAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
    });
    cacheService.deleteByPrefix('elections:');
  }

  static async closeElection(electionId: string): Promise<void> {
    if (isDevMode()) return;
    const electionRef = doc(db, COLLECTIONS.ELECTIONS, electionId);
    // P1 Fix 8: use runTransaction so concurrent closeElection calls cannot both
    // pass the status check and both write.
    await runTransaction(db, async (txn) => {
      const snap = await txn.get(electionRef);
      if (!snap.exists()) throw new Error('Election not found');
      const data = snap.data() as Election;
      if (data.status !== 'open') {
        throw new Error(`Cannot close election in status '${data.status}'. Election must be 'open' first.`);
      }
      txn.update(electionRef, {
        status: 'closed',
        closedAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
    });
    cacheService.deleteByPrefix('elections:');
  }

  /**
   * Tally votes for a closed election. Reads all ballots and aggregates counts per position.
   * Returns a map of position -> { candidateId -> voteCount }.
   */
  static async tallyElection(electionId: string): Promise<Record<string, Record<string, number>>> {
    if (isDevMode()) return {};
    const col = COLLECTIONS.ELECTIONS;
    const electionRef = doc(db, col, electionId);

    // Verify status before reading all ballots (avoids loading ballots for non-closed elections)
    const electionSnap = await getDoc(electionRef);
    if (!electionSnap.exists()) throw new Error('Election not found');
    const electionData = electionSnap.data() as Election;
    if (electionData.status !== 'closed') {
      throw new Error(`Cannot tally election in status '${electionData.status}'. Election must be 'closed' first.`);
    }

    // Compute tally outside the transaction (transactions cannot run arbitrary queries)
    const snap = await getDocs(collection(db, `${col}/${electionId}/ballots`));
    const tally: Record<string, Record<string, number>> = {};
    for (const d of snap.docs) {
      const ballot = d.data() as Ballot;
      for (const [position, candidateId] of Object.entries(ballot.votes)) {
        if (!tally[position]) tally[position] = {};
        tally[position][candidateId] = (tally[position][candidateId] || 0) + 1;
      }
    }

    // P2 Fix 9: wrap the status re-check + result write in runTransaction so
    // concurrent tally calls cannot both write, avoiding a double audit trail.
    await runTransaction(db, async (txn) => {
      const snap2 = await txn.get(electionRef);
      if (!snap2.exists()) throw new Error('Election not found');
      const currentStatus = (snap2.data() as Election).status;
      if (currentStatus === 'tallied') return; // already done — idempotent
      if (currentStatus !== 'closed') {
        throw new Error(`Cannot tally election in status '${currentStatus}'. Election must be 'closed' first.`);
      }
      txn.update(electionRef, {
        status: 'tallied',
        tally,
        talliedAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
    });
    cacheService.deleteByPrefix('elections:');
    return tally;
  }
}

export default ElectionsService;
