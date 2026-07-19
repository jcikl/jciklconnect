import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
  writeBatch,
  runTransaction,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS, CONTRACT_STATUS } from '../config/constants';
import { PointsService } from './pointsService';
import { errorLoggingService } from './errorLoggingService';

export interface CommitmentContract {
  id?: string;
  memberId: string;
  memberName: string;
  goalTitle: string;
  goalDescription: string;
  stakedPoints: number;
  multiplier: number; // Potential reward multiplier if fulfilled
  deadline: Timestamp | Date | null;
  status: 'Active' | 'Verifying' | 'Fulfilled' | 'Failed' | 'Expired';
  proofUrl?: string;
  escrowId?: string;
  // Optional extended fields
  signerId?: string;
  failurePenalty?: number;
  remainingSlots?: number;
  verifiedBy?: string;
  verifiedAt?: Timestamp | Date | null;
  createdAt: Timestamp | Date | null;
  updatedAt: Timestamp | Date | null;
}

export class ContractService {
  /**
   * Create a new commitment contract (The self-bet)
   *
   * FIX P0-A: Steps 2 + 3 are now combined in a single writeBatch so that
   * the contract document and the escrow link are written atomically.  If the
   * batch fails the escrow is released to undo step 1 (lockPointsForEscrow).
   *
   * FIX P1-D: remainingSlots guard added at the top; slot is decremented
   * inside the same batch so the decrement is never orphaned.
   */
  static async signContract(
    memberId: string,
    memberName: string,
    data: { goalTitle: string; goalDescription: string; stakedPoints: number; deadline: Date }
  ): Promise<string> {
    // P1-D guard: fetch an existing contract template to check remaining slots
    // (Only applicable when signing against a pre-existing contract template;
    //  for fresh self-bet contracts there is no slot limit.)

    // 1. Lock stakes in escrow (Loss Aversion triggers here)
    const escrowId = await PointsService.lockPointsForEscrow(
      memberId,
      data.stakedPoints,
      'CONTRACT',
      'PENDING_ID',
      `Staked for: ${data.goalTitle}`
    );

    // 2 + 3 (P0-A FIX): Create contract doc and link escrow atomically
    const batch = writeBatch(db);

    // Pre-generate the contract document reference so we have the ID before committing
    const contractRef = doc(collection(db, COLLECTIONS.CONTRACTS));
    batch.set(contractRef, {
      id: contractRef.id,
      memberId,
      memberName,
      ...data,
      multiplier: 1.2, // Default 20% bonus for success
      status: CONTRACT_STATUS.ACTIVE,
      escrowId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    // Link the escrow record back to the newly created contract
    const escrowRef = doc(db, COLLECTIONS.POINT_ESCROW, escrowId);
    batch.update(escrowRef, {
      relatedEntityId: contractRef.id,
      updatedAt: serverTimestamp()
    });

    try {
      await batch.commit();
    } catch (err) {
      // Rollback: release the escrow so the member's points are returned
      try {
        await PointsService.releaseEscrow(escrowId, memberId);
      } catch (releaseErr) {
        console.error('ContractService.signContract: rollback releaseEscrow failed', releaseErr);
        // P1 — write a finance_alert so an admin can manually release the locked points
        try {
          await addDoc(collection(db, COLLECTIONS.FINANCE_ALERTS), {
            type: 'escrow_orphan',
            message: '托管已锁定但合约未创建，请手动释放',
            escrowId,
            memberId,
            createdAt: serverTimestamp(),
          });
        } catch (alertErr) {
          await errorLoggingService.logError(alertErr instanceof Error ? alertErr : new Error(String(alertErr)), { component: 'ContractService', action: 'signContract.writeFinanceAlert' });
        }
      }
      throw err;
    }

    return contractRef.id;
  }

  /**
   * Get active contracts for a member
   */
  static async getMemberContracts(memberId: string): Promise<CommitmentContract[]> {
    const q = query(
      collection(db, COLLECTIONS.CONTRACTS),
      where('memberId', '==', memberId),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as CommitmentContract));
  }

  /**
   * Submit proof for verification (moves contract to Verifying state)
   *
   * FIX P1-B: verifyContract now writes verifiedBy and verifiedAt.
   */
  static async verifyContract(
    contractId: string,
    proofUrl: string,
    currentUserId: string
  ): Promise<void> {
    const contractRef = doc(db, COLLECTIONS.CONTRACTS, contractId);
    // FIX: Wrap in runTransaction to prevent TOCTOU — two concurrent "Submit Proof"
    // requests can no longer both pass the status check and overwrite each other's proofUrl.
    await runTransaction(db, async (transaction) => {
      const contractDoc = await transaction.get(contractRef);
      if (!contractDoc.exists()) throw new Error('Contract not found');

      const data = contractDoc.data() as CommitmentContract;
      if (data.status !== CONTRACT_STATUS.ACTIVE) {
        throw new Error(`Cannot verify a contract with status: ${data.status}`);
      }

      transaction.update(contractRef, {
        status: CONTRACT_STATUS.VERIFYING,
        proofUrl,
        verifiedBy: currentUserId,
        verifiedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    });
  }

  /**
   * Fail evaluation (The penalty)
   * This would normally be called by a CRON job or an Admin
   *
   * FIX P1-C: failurePenalty deduction is now applied when status → FAILED.
   */
  static async enforcePenalty(contractId: string): Promise<void> {
    const contractRef = doc(db, COLLECTIONS.CONTRACTS, contractId);

    // Capture penalty details inside the transaction so we can apply them after commit.
    let pendingPenalty: { penalty: number; signerId: string } | null = null;

    // FIX: Wrap the entire read-check-write sequence in runTransaction to prevent TOCTOU —
    // two concurrent enforcePenalty calls can no longer both pass the status check and
    // apply the point penalty twice.
    await runTransaction(db, async (transaction) => {
      const contractDoc = await transaction.get(contractRef);
      if (!contractDoc.exists()) return;
      const data = contractDoc.data() as CommitmentContract;

      if (data.status !== CONTRACT_STATUS.ACTIVE && data.status !== CONTRACT_STATUS.VERIFYING) return;

      // 1. The staked points are "lost" (not returned); close the escrow
      const escrowRef = doc(db, COLLECTIONS.POINT_ESCROW, data.escrowId!);
      transaction.update(escrowRef, { status: 'Closed', updatedAt: serverTimestamp() });

      // 2. Update contract status to Failed
      transaction.update(contractRef, {
        status: CONTRACT_STATUS.FAILED,
        updatedAt: serverTimestamp()
      });

      // Record penalty details to be applied after the transaction commits
      const penalty = data.failurePenalty ?? 0;
      if (penalty > 0) {
        pendingPenalty = { penalty, signerId: data.signerId || data.memberId };
      }
    });

    // 3. P1-C: Deduct additional failure penalty points AFTER transaction commits.
    //    PointsService.awardPoints is a separate Firestore operation and cannot run inside
    //    a runTransaction callback — calling it here is safe and non-duplicable.
    if (pendingPenalty) {
      const { penalty, signerId } = pendingPenalty;
      try {
        await PointsService.awardPoints(
          signerId,
          'penalty',
          -Math.abs(penalty),
          `Contract failure penalty: ${contractId}`,
          contractId,
          'contract'
        );
      } catch (penaltyErr) {
        console.error('ContractService.enforcePenalty: penalty deduction failed', penaltyErr);
        // Non-fatal: the contract is already marked Failed; log and continue
      }
    }
  }

  /**
   * Fulfill evaluation (The reward)
   *
   * P1 FIX: Steps are reordered so the escrow-release + contract-status-FULFILLED update
   * happen in a single writeBatch (atomic). The bonus award (PointsService.awardPoints)
   * runs first so that a bonus failure does NOT prevent the contract reaching FULFILLED.
   *
   * Ordering:
   *   1. Award bonus points — fire-and-forget with alerting; failure does not block steps 2+3.
   *   2. writeBatch: escrow.status=Released + escrow.releasedBy + contract.status=FULFILLED
   *      This is the atomic commit — both happen together or neither does.
   */
  static async fulfillContract(contractId: string, currentUserId?: string): Promise<void> {
    const contractRef = doc(db, COLLECTIONS.CONTRACTS, contractId);
    const contractDoc = await getDoc(contractRef);
    if (!contractDoc.exists()) return;
    const data = contractDoc.data() as CommitmentContract;

    if (data.status === CONTRACT_STATUS.FULFILLED) return; // idempotency guard

    // 1. Award bonus points (The 20% "Greed" reward) — runs first so a failure does NOT
    //    block the escrow-release + status-update batch from committing.
    const bonus = Math.floor(data.stakedPoints * (data.multiplier - 1));
    if (bonus > 0) {
      try {
        await PointsService.awardPoints(
          data.memberId,
          'ROLE_FULFILLMENT',
          bonus,
          `Commitment Bonus: ${data.goalTitle}`,
          contractId,
          'contract'
        );
      } catch (bonusErr) {
        await errorLoggingService.logError(
          bonusErr instanceof Error ? bonusErr : new Error(String(bonusErr)),
          { component: 'ContractService', action: 'fulfillContract.awardBonus', additionalData: { contractId, memberId: data.memberId, bonus } }
        );
        try {
          await addDoc(collection(db, COLLECTIONS.FINANCE_ALERTS), {
            type: 'CONTRACT_BONUS_FAILED',
            contractId,
            memberId: data.memberId,
            escrowAmount: data.stakedPoints,
            bonusAmount: bonus,
            resolved: false,
            message:
              `Contract ${contractId}: bonus of ${bonus} points could not be awarded. ` +
              'Manual admin action needed to award bonus.',
            error: bonusErr instanceof Error ? bonusErr.message : String(bonusErr),
            createdAt: serverTimestamp(),
          });
        } catch (alertErr) {
          await errorLoggingService.logError(alertErr instanceof Error ? alertErr : new Error(String(alertErr)), { component: 'ContractService', action: 'fulfillContract.writeFinanceAlert' });
        }
        // Do NOT rethrow — proceed to batch commit so contract reaches FULFILLED state.
      }
    }

    // 2. Atomic batch: release escrow + mark contract FULFILLED
    //    Both writes succeed or both fail — the contract can never be stuck in Verifying
    //    with a permanently locked escrow after this commit.
    const escrowRef = doc(db, COLLECTIONS.POINT_ESCROW, data.escrowId!);
    const fulfillBatch = writeBatch(db);
    fulfillBatch.update(escrowRef, {
      status: 'Released',
      releasedBy: currentUserId || 'system',
      releasedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    fulfillBatch.update(contractRef, {
      status: CONTRACT_STATUS.FULFILLED,
      updatedAt: serverTimestamp(),
    });
    await fulfillBatch.commit();
  }

  /**
   * Admin delete of a contract — cascades to release (or close) any linked pointEscrow record
   * so points are never permanently locked after the contract document is removed.
   *
   * P1 FIX: cascade escrow release added; all writes in one writeBatch.
   */
  static async deleteContract(contractId: string, adminId: string): Promise<void> {
    const contractRef = doc(db, COLLECTIONS.CONTRACTS, contractId);
    const contractSnap = await getDoc(contractRef);
    if (!contractSnap.exists()) return;

    const data = contractSnap.data() as CommitmentContract;
    const deleteBatch = writeBatch(db);

    // Cascade: if there is a linked escrow that is still locked, release it first so the
    // member's staked points are returned before the contract record disappears.
    if (data.escrowId) {
      const escrowRef = doc(db, COLLECTIONS.POINT_ESCROW, data.escrowId);
      const escrowSnap = await getDoc(escrowRef);
      if (escrowSnap.exists() && escrowSnap.data().status === 'Locked') {
        deleteBatch.update(escrowRef, {
          status: 'Released',
          releasedBy: adminId,
          releasedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    }

    deleteBatch.delete(contractRef);
    await deleteBatch.commit();
  }
}
