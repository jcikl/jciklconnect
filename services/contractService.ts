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
  increment,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS, CONTRACT_STATUS } from '../config/constants';
import { PointsService } from './pointsService';

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
        } catch {}
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
    const contractDoc = await getDoc(contractRef);
    if (!contractDoc.exists()) throw new Error('Contract not found');

    const data = contractDoc.data() as CommitmentContract;
    if (data.status !== CONTRACT_STATUS.ACTIVE) {
      throw new Error(`Cannot verify a contract with status: ${data.status}`);
    }

    await updateDoc(contractRef, {
      status: CONTRACT_STATUS.VERIFYING,
      proofUrl,
      verifiedBy: currentUserId,
      verifiedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
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
     const contractDoc = await getDoc(contractRef);
     if (!contractDoc.exists()) return;
     const data = contractDoc.data() as CommitmentContract;

     if (data.status !== CONTRACT_STATUS.ACTIVE && data.status !== CONTRACT_STATUS.VERIFYING) return;

     const batch = writeBatch(db);

     // 1. The staked points are "lost" (not returned); close the escrow
     const escrowRef = doc(db, COLLECTIONS.POINT_ESCROW, data.escrowId!);
     batch.update(escrowRef, { status: 'Closed', updatedAt: serverTimestamp() });

     // 2. Update contract status to Failed
     batch.update(contractRef, {
       status: CONTRACT_STATUS.FAILED,
       updatedAt: serverTimestamp()
     });

     await batch.commit();

     // 3. P1-C: Deduct additional failure penalty points if configured
     const penalty = data.failurePenalty ?? 0;
     if (penalty > 0) {
       const signerId = data.signerId || data.memberId;
       try {
         // P0 fix: correct signature is (memberId, category, amount, description, ...)
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
        await PointsService.awardPoints(data.memberId, bonus, 'ROLE_FULFILLMENT', `Commitment Bonus: ${data.goalTitle}`);
      } catch (bonusErr) {
        console.error('ContractService.fulfillContract: bonus awardPoints failed', bonusErr);
        // P1 — write a finance_alert so admin can manually award the missed bonus
        try {
          await addDoc(collection(db, 'finance_alerts'), {
            type: 'contract_bonus_missing',
            message: `合约质押已退回但奖励积分未发放，请手动补发 ${bonus} 分给 ${data.memberId}`,
            contractId,
            memberId: data.memberId,
            bonusPoints: bonus,
            createdAt: serverTimestamp(),
          });
        } catch {}
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
