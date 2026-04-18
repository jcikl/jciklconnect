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
  Timestamp,
  serverTimestamp
} from 'firebase/firestore';
import { isDevMode } from '../utils/devMode';
import { db } from '../config/firebase';
import { COLLECTIONS, BOUNTY_STATUS } from '../config/constants';
import { PointsService } from './pointsService';

export interface Bounty {
  id?: string;
  posterId: string;
  posterName: string;
  title: string;
  description: string;
  rewardPoints: number;
  category: 'BUSINESS' | 'COMMUNITY' | 'INDIVIDUAL' | 'INTERNATIONAL';
  status: 'Open' | 'Claimed' | 'Submitted' | 'Completed' | 'Cancelled';
  urgency: 'Low' | 'Medium' | 'High' | 'Critical';
  deadline?: string;
  tags?: string[];
  claimantId?: string;
  claimantName?: string;
  escrowId?: string;
  createdAt: any;
  updatedAt: any;
}

export class BountyService {
  private static mockBounties: Bounty[] = [
    {
      id: 'b-mock-1',
      posterId: 'u4',
      posterName: 'Jessica Day',
      title: 'Regional HQ Referral for Logistics Tech',
      description: 'Need a warm introduction to a Decision Maker in a Tier-1 Logistics Firm for our new AI route optimization tool.',
      rewardPoints: 1200,
      category: 'BUSINESS',
      status: 'Open',
      urgency: 'High',
      tags: ['referral', 'tech', 'logistics'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'b-mock-2',
      posterId: 'u1',
      posterName: 'Alex Rivera',
      title: 'Community Garden Mural Artist',
      description: 'Seeking a talented artist to design and paint a mural for the new JCI community garden project.',
      rewardPoints: 500,
      category: 'COMMUNITY',
      status: 'Open',
      urgency: 'Medium',
      tags: ['art', 'community', 'garden'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'b-mock-3',
      posterId: 'u2',
      posterName: 'Sarah Chen',
      title: 'Financial Audit for NGO',
      description: 'Need assistance with preparing audit documents for a local charity partner.',
      rewardPoints: 800,
      category: 'INDIVIDUAL',
      status: 'Open',
      urgency: 'Critical',
      tags: ['finance', 'audit', 'charity'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];
  /**
   * Post a new bounty (Locks points immediately)
   */
  static async postBounty(
    memberId: string, 
    memberName: string, 
    data: Omit<Bounty, 'posterId' | 'posterName' | 'status' | 'createdAt' | 'updatedAt' | 'escrowId'>
  ): Promise<string> {
    if (isDevMode()) {
      const newBounty: Bounty = {
        ...data,
        id: `mock-bounty-${Date.now()}`,
        posterId: memberId,
        posterName: memberName,
        status: 'Open',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      this.mockBounties.unshift(newBounty);
      return newBounty.id!;
    }

    // 1. Lock points in escrow
    const escrowId = await PointsService.lockPointsForEscrow(
      memberId,
      data.rewardPoints,
      'BOUNTY',
      'TEMP_PENDING', // Will update after doc creation
      `Bounty: ${data.title}`
    );

    // 2. Create Bounty Record
    const bountyRef = await addDoc(collection(db, COLLECTIONS.BOUNTIES), {
      ...data,
      posterId: memberId,
      posterName: memberName,
      status: 'Open',
      escrowId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    // 3. Link escrow to bounty ID
    const escrowRef = doc(db, COLLECTIONS.POINT_ESCROW, escrowId);
    await updateDoc(escrowRef, { relatedEntityId: bountyRef.id });

    return bountyRef.id;
  }

  /**
   * List all available bounties
   */
  static async getOpenBounties(): Promise<Bounty[]> {
    if (isDevMode()) {
      return [...this.mockBounties].filter(b => b.status === 'Open');
    }

    try {
      const q = query(
        collection(db, COLLECTIONS.BOUNTIES),
        where('status', '==', 'Open'),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Bounty));
    } catch (error) {
      console.error('Error fetching bounties:', error);
      if (isDevMode()) return [...this.mockBounties].filter(b => b.status === 'Open');
      throw error;
    }
  }

  /**
   * Claim a bounty (Locks it for the claimant)
   */
  static async claimBounty(bountyId: string, claimantId: string, claimantName: string): Promise<void> {
    if (isDevMode()) {
      const index = this.mockBounties.findIndex(b => b.id === bountyId);
      if (index !== -1) {
        this.mockBounties[index] = {
          ...this.mockBounties[index],
          status: 'Claimed',
          claimantId,
          claimantName,
          updatedAt: new Date().toISOString()
        };
      }
      return;
    }

    const bountyRef = doc(db, COLLECTIONS.BOUNTIES, bountyId);
    const bountyDoc = await getDoc(bountyRef);
    
    if (!bountyDoc.exists()) throw new Error('Bounty not found');
    if (bountyDoc.data().status !== 'Open') throw new Error('Bounty is no longer available');
    if (bountyDoc.data().posterId === claimantId) throw new Error('Cannot claim your own bounty');

    await updateDoc(bountyRef, {
      status: 'Claimed',
      claimantId,
      claimantName,
      updatedAt: serverTimestamp()
    });
  }

  /**
   * Complete Bounty & Release Points (Wolf Logic: Finalizing the swap)
   */
  static async finalizeBounty(bountyId: string): Promise<void> {
    if (isDevMode()) {
      const index = this.mockBounties.findIndex(b => b.id === bountyId);
      if (index !== -1) {
        this.mockBounties[index] = {
          ...this.mockBounties[index],
          status: 'Completed',
          updatedAt: new Date().toISOString()
        };
      }
      return;
    }

    const bountyRef = doc(db, COLLECTIONS.BOUNTIES, bountyId);
    const bountyDoc = await getDoc(bountyRef);

    if (!bountyDoc.exists()) throw new Error('Bounty not found');
    const data = bountyDoc.data() as Bounty;

    if (!data.escrowId || !data.claimantId) throw new Error('Incomplete bounty state');

    // 1. Release points to claimant
    await PointsService.releaseEscrow(data.escrowId, data.claimantId);

    // 2. Update status
    await updateDoc(bountyRef, {
      status: 'Completed',
      updatedAt: serverTimestamp()
    });
  }
}
