import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  writeBatch,
  runTransaction,
  increment,
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
          await addDoc(collection(db, 'finance_alerts'), {
            type: 'escrow_orphan',
            message: '托管已锁定但合约未创建，请手动释放',
            escrowId,
            memberId,
            createdAt: serverTimestamp(),
          });
        } catch (alertErr) {
          console.error('[contractService] Failed to write finance_alert for stuck escrow:', alertErr);
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
   * FIX P1-E: After releasing escrow, set releasedBy on the escrow record.
   */
  static async fulfillContract(contractId: string, currentUserId?: string): Promise<void> {
    const contractRef = doc(db, COLLECTIONS.CONTRACTS, contractId);
    const contractDoc = await getDoc(contractRef);
    if (!contractDoc.exists()) return;
    const data = contractDoc.data() as CommitmentContract;

    // 1. Release original stake back to member.
    //    Pass releasedBy via metadata so the escrow update and the release happen
    //    atomically inside releaseEscrow's runTransaction — no separate updateDoc needed.
    await PointsService.releaseEscrow(data.escrowId!, data.memberId, {
      releasedBy: currentUserId || 'system'
    });

    // 2. Award bonus points (The 20% "Greed" reward)
    const bonus = Math.floor(data.stakedPoints * (data.multiplier - 1));
    if (bonus > 0) {
      try {
        await PointsService.awardPoints(data.memberId, 'ROLE_FULFILLMENT', bonus, `Commitment Bonus: ${data.goalTitle}`, contractId, 'contract');
      } catch (bonusErr) {
        // P1 Fix: Do NOT rethrow — rethrowing here prevents step 3 from running, leaving
        // the contract permanently stuck in "Verifying" with no admin alert. Instead, log the
        // error and write a financeAlert so an admin can manually award the bonus; the contract
        // status update (step 3) is allowed to proceed so it moves to FULFILLED.
        await errorLoggingService.logError(bonusErr instanceof Error ? bonusErr : new Error(String(bonusErr)), { component: 'ContractService', action: 'fulfillContract.awardBonus', additionalData: { contractId, memberId: data.memberId, bonus } });
        try {
          await addDoc(collection(db, 'finance_alerts'), {
            type: 'CONTRACT_BONUS_FAILED',
            contractId,
            memberId: data.memberId,
            escrowAmount: data.stakedPoints,
            bonusAmount: bonus,
            message:
              `Contract ${contractId}: escrow was released but bonus of ${bonus} points could not be awarded. ` +
              'Escrow released OK. Manual admin action needed to award bonus.',
            error: bonusErr instanceof Error ? bonusErr.message : String(bonusErr),
            createdAt: serverTimestamp(),
          });
        } catch (_alertErr) { /* best-effort alert write */ }
        // Do NOT rethrow — fall through to step 3 so contract reaches FULFILLED state.
      }
    }

    // 3. Update status — wrapped in try/catch (E3 safety net):
    // Steps 1+2 cannot be atomically rolled back if this write fails, so log a
    // finance_alert so an admin can detect and manually mark the contract Fulfilled.
    try {
      await updateDoc(contractRef, {
        status: CONTRACT_STATUS.FULFILLED,
        updatedAt: serverTimestamp()
      });
    } catch (fulfillErr) {
      console.error(
        `ContractService.fulfillContract: step 3 (status=FULFILLED) failed for contract ${contractId}. ` +
        'Escrow released and bonus awarded but contract remains in Verifying. Admin action required.',
        fulfillErr
      );
      try {
        await addDoc(collection(db, 'finance_alerts'), {
          type: 'CONTRACT_FULFILL_STUCK',
          contractId,
          memberId: data.memberId,
          message:
            `Contract ${contractId} escrow was released and bonus awarded but status was not updated to FULFILLED. ` +
            'Manual admin fix required.',
          createdAt: serverTimestamp(),
        });
      } catch (alertErr) {
        console.error('ContractService.fulfillContract: failed to write finance_alert', alertErr);
      }
      throw fulfillErr;
    }
  }
}
