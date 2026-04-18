import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  query, 
  where, 
  orderBy, 
  serverTimestamp
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
  deadline: any;
  status: 'Active' | 'Verifying' | 'Fulfilled' | 'Failed' | 'Expired';
  proofUrl?: string;
  escrowId?: string;
  createdAt: any;
  updatedAt: any;
}

export class ContractService {
  /**
   * Create a new commitment contract (The self-bet)
   */
  static async signContract(
    memberId: string, 
    memberName: string, 
    data: { goalTitle: string; goalDescription: string; stakedPoints: number; deadline: Date }
  ): Promise<string> {
    // 1. Lock stakes in escrow (Loss Aversion triggers here)
    const escrowId = await PointsService.lockPointsForEscrow(
      memberId,
      data.stakedPoints,
      'CONTRACT',
      'PENDING_ID',
      `Staked for: ${data.goalTitle}`
    );

    // 2. Create Contract record
    const contractRef = await addDoc(collection(db, COLLECTIONS.CONTRACTS), {
      memberId,
      memberName,
      ...data,
      multiplier: 1.2, // Default 20% bonus for success
      status: 'Active',
      escrowId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    // 3. Link escrow
    const escrowRef = doc(db, COLLECTIONS.POINT_ESCROW, escrowId);
    await updateDoc(escrowRef, { relatedEntityId: contractRef.id });

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
   * Fail evaluation (The penalty)
   * This would normally be called by a CRON job or an Admin
   */
  static async enforcePenalty(contractId: string): Promise<void> {
     const contractRef = doc(db, COLLECTIONS.CONTRACTS, contractId);
     const contractDoc = await getDoc(contractRef);
     if (!contractDoc.exists()) return;
     const data = contractDoc.data() as CommitmentContract;

     if (data.status !== 'Active') return;

     // 1. The staked points are "lost" (not returned)
     // In a simple system, we just mark escrow as CLOSED without transfer
     const escrowRef = doc(db, COLLECTIONS.POINT_ESCROW, data.escrowId!);
     await updateDoc(escrowRef, { status: 'Closed', updatedAt: serverTimestamp() });

     // 2. Update contract status
     await updateDoc(contractRef, {
       status: 'Failed',
       updatedAt: serverTimestamp()
     });
  }

  /**
   * Fulfill evaluation (The reward)
   */
  static async fulfillContract(contractId: string): Promise<void> {
    const contractRef = doc(db, COLLECTIONS.CONTRACTS, contractId);
    const contractDoc = await getDoc(contractRef);
    if (!contractDoc.exists()) return;
    const data = contractDoc.data() as CommitmentContract;

    // 1. Release original stake back to member
    await PointsService.releaseEscrow(data.escrowId!, data.memberId);

    // 2. Award bonus points (The 20% "Greed" reward)
    const bonus = Math.floor(data.stakedPoints * (data.multiplier - 1));
    if (bonus > 0) {
      // Assuming a system activity for bonuses
      await PointsService.awardPoints(data.memberId, bonus, 'ROLE_FULFILLMENT', `Commitment Bonus: ${data.goalTitle}`);
    }

    // 3. Update status
    await updateDoc(contractRef, {
       status: 'Fulfilled',
       updatedAt: serverTimestamp()
    });
  }
}
