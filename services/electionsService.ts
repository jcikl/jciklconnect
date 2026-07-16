// Elections Service
// Provides all Firestore operations for the elections collection.
// P0 fix: castElectionVote uses a deterministic ballot doc ID + runTransaction
// to prevent duplicate votes atomically.
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  orderBy,
  serverTimestamp,
  arrayUnion,
  increment,
  runTransaction,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/constants';
import { Election, ElectionBallot } from '../types/governance';
import { isDevMode, withDevMode } from '../utils/devMode';
import { apiCache } from './cacheService';
import { errorLoggingService } from './errorLoggingService';

const CACHE_KEY_ALL = 'elections_all';
const ELECTIONS_TTL = 3 * 60 * 1000; // 3 minutes

export class ElectionsService {

  // ---------------------------------------------------------------------------
  // Cache management
  // ---------------------------------------------------------------------------

  static invalidateElectionsCache(): void {
    apiCache.delete(CACHE_KEY_ALL);
  }

  // ---------------------------------------------------------------------------
  // Read operations
  // ---------------------------------------------------------------------------

  /**
   * Fetch all elections sorted by createdAt desc.
   * Result is cached for 3 minutes.
   */
  static async getElections(): Promise<Election[]> {
    return withDevMode(
      () => [],
      () =>
        apiCache.getOrSet(
          CACHE_KEY_ALL,
          async () => {
            try {
              const snapshot = await getDocs(
                query(
                  collection(db, COLLECTIONS.ELECTIONS),
                  orderBy('createdAt', 'desc')
                )
              );
              return snapshot.docs.map(
                (d) => ({ id: d.id, ...d.data() } as Election)
              );
            } catch (error) {
              errorLoggingService.logError(error as Error, {
                component: 'ElectionsService',
                action: 'getElections',
              });
              throw error;
            }
          },
          ELECTIONS_TTL
        )
    );
  }

  /**
   * Fetch a single election by its Firestore document ID.
   * Returns null if the document does not exist.
   */
  static async getElectionById(electionId: string): Promise<Election | null> {
    return withDevMode(
      () => null,
      async () => {
        try {
          const snap = await getDoc(doc(db, COLLECTIONS.ELECTIONS, electionId));
          if (!snap.exists()) return null;
          return { id: snap.id, ...snap.data() } as Election;
        } catch (error) {
          errorLoggingService.logError(error as Error, {
            component: 'ElectionsService',
            action: 'getElectionById',
          });
          throw error;
        }
      }
    );
  }

  /**
   * Read all ballots cast for a given election (admin-only context).
   * The caller is responsible for enforcing the ADMIN/SUPER_ADMIN role check
   * before calling this method.
   */
  static async getElectionBallots(electionId: string): Promise<ElectionBallot[]> {
    return withDevMode(
      () => [],
      async () => {
        try {
          const ballotsRef = collection(
            db,
            COLLECTIONS.ELECTIONS,
            electionId,
            'electionBallots'
          );
          const snap = await getDocs(ballotsRef);
          return snap.docs.map(
            (d) => ({ id: d.id, ...d.data() } as ElectionBallot)
          );
        } catch (error) {
          errorLoggingService.logError(error as Error, {
            component: 'ElectionsService',
            action: 'getElectionBallots',
          });
          throw error;
        }
      }
    );
  }

  // ---------------------------------------------------------------------------
  // Write operations
  // ---------------------------------------------------------------------------

  /**
   * Create a new election document.
   * Validates that a title (or name) is present and that startDate < endDate
   * before writing.
   * Returns the new document ID.
   */
  static async createElection(
    data: Omit<Election, 'id'>
  ): Promise<string> {
    if (isDevMode()) {
      console.log('[Dev Mode] Would create election:', data);
      return 'mock-election-id';
    }

    if (!data.title && !data.name) {
      throw new Error('Election title is required.');
    }
    if (
      data.startDate &&
      data.endDate &&
      data.startDate >= data.endDate
    ) {
      throw new Error('startDate must be before endDate.');
    }

    try {
      const docRef = await addDoc(collection(db, COLLECTIONS.ELECTIONS), {
        ...data,
        createdAt: serverTimestamp(),
      });
      this.invalidateElectionsCache();
      return docRef.id;
    } catch (error) {
      errorLoggingService.logError(error as Error, {
        component: 'ElectionsService',
        action: 'createElection',
      });
      throw error;
    }
  }

  /**
   * Partially update an election document.
   * Invalidates the elections cache on success.
   */
  static async updateElection(
    electionId: string,
    data: Partial<Election>
  ): Promise<void> {
    if (isDevMode()) {
      console.log('[Dev Mode] Would update election:', electionId, data);
      return;
    }
    try {
      await updateDoc(doc(db, COLLECTIONS.ELECTIONS, electionId), {
        ...data,
        updatedAt: serverTimestamp(),
      });
      this.invalidateElectionsCache();
    } catch (error) {
      errorLoggingService.logError(error as Error, {
        component: 'ElectionsService',
        action: 'updateElection',
      });
      throw error;
    }
  }

  /**
   * Cast a vote for a candidate in an election.
   *
   * P0 duplicate-prevention: the ballot document ID is deterministically
   * derived as `electionId_voterId`.  A Firestore transaction reads that
   * document first — if it already exists the voter has already voted and the
   * transaction throws immediately without writing anything.  This makes the
   * check-and-set atomic even under concurrent requests.
   */
  static async castElectionVote(
    electionId: string,
    candidateId: string,
    voterId: string
  ): Promise<void> {
    if (isDevMode()) {
      console.log('[Dev Mode] Would cast vote:', { electionId, candidateId, voterId });
      return;
    }

    const ballotDocId = `${electionId}_${voterId}`;
    const ballotDocRef = doc(
      db,
      COLLECTIONS.ELECTIONS,
      electionId,
      'electionBallots',
      ballotDocId
    );
    const electionRef = doc(db, COLLECTIONS.ELECTIONS, electionId);

    try {
      await runTransaction(db, async (transaction) => {
        const ballotSnap = await transaction.get(ballotDocRef);
        if (ballotSnap.exists()) {
          throw new Error('You have already voted in this election.');
        }
        transaction.set(ballotDocRef, {
          electionId,
          candidateId,
          voterId,
          castAt: serverTimestamp(),
        });
        transaction.update(electionRef, {
          votedBy: arrayUnion(voterId),
          totalVotes: increment(1),
        });
      });
      this.invalidateElectionsCache();
    } catch (error) {
      errorLoggingService.logError(error as Error, {
        component: 'ElectionsService',
        action: 'castElectionVote',
      });
      throw error;
    }
  }

  /**
   * Tally all ballots for an election, write results back to the election
   * document, and mark the election as completed.
   *
   * Returns a map of candidateId → vote count.
   */
  static async tallyElection(
    electionId: string
  ): Promise<Record<string, number>> {
    if (isDevMode()) {
      console.log('[Dev Mode] Would tally election:', electionId);
      return {};
    }
    try {
      const ballotsRef = collection(
        db,
        COLLECTIONS.ELECTIONS,
        electionId,
        'electionBallots'
      );
      const ballotsSnap = await getDocs(ballotsRef);

      const tally: Record<string, number> = {};
      ballotsSnap.docs.forEach((ballotDoc) => {
        const data = ballotDoc.data();
        const cid = data.candidateId as string | undefined;
        if (cid) {
          tally[cid] = (tally[cid] ?? 0) + 1;
        }
      });

      await updateDoc(doc(db, COLLECTIONS.ELECTIONS, electionId), {
        results: tally,
        status: 'Completed' as Election['status'],
        electionStatus: 'completed' as Election['electionStatus'],
        talliedAt: serverTimestamp(),
      });

      this.invalidateElectionsCache();
      return tally;
    } catch (error) {
      errorLoggingService.logError(error as Error, {
        component: 'ElectionsService',
        action: 'tallyElection',
      });
      throw error;
    }
  }
}
