// Member Benefits Service
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/constants';
import { isDevMode } from '../utils/devMode';
import { toDate } from '../utils/dateUtils';
import { removeUndefined } from '../utils/dataUtils';

export interface MemberBenefit {
  id?: string;
  name: string;
  description: string;
  type: 'Discount' | 'Exclusive Access' | 'Free Service' | 'Priority' | 'Other';
  category: 'Event' | 'Training' | 'Business' | 'Social' | 'General';
  discountPercentage?: number;
  discountAmount?: number;
  eligibilityCriteria: {
    tier?: string[];
    role?: string[];
    points?: number;
    joinDate?: string; // Minimum join date
    custom?: string; // Custom eligibility rules
  };
  validFrom: Date | Timestamp | string;
  validUntil?: Date | Timestamp | string;
  usageLimit?: number; // Per member
  currentUsage: number; // Total usage count
  status: 'Active' | 'Inactive' | 'Expired';
  provider?: string; // Business/partner providing the benefit
  termsAndConditions?: string;
  createdAt: Date | Timestamp;
  updatedAt: Date | Timestamp;
}

export interface BenefitUsage {
  id?: string;
  memberId: string;
  benefitId: string;
  usedAt: Date | Timestamp;
  details?: string;
}

export class MemberBenefitsService {
  // Get all benefits
  static async getAllBenefits(): Promise<MemberBenefit[]> {
    if (isDevMode()) {
      return [
        {
          id: 'b1',
          name: '20% Off Event Tickets',
          description: 'Exclusive discount on all JCI events',
          type: 'Discount',
          category: 'Event',
          discountPercentage: 20,
          eligibilityCriteria: {
            tier: ['Silver', 'Gold', 'Platinum'],
          },
          validFrom: new Date('2024-01-01'),
          status: 'Active',
          currentUsage: 45,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
        {
          id: 'b2',
          name: 'Free Leadership Training',
          description: 'Complimentary access to all leadership training modules',
          type: 'Free Service',
          category: 'Training',
          eligibilityCriteria: {
            tier: ['Gold', 'Platinum'],
            points: 1000,
          },
          validFrom: new Date('2024-01-01'),
          status: 'Active',
          currentUsage: 12,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
        {
          id: 'b3',
          name: 'Priority Event Registration',
          description: 'Early access to register for popular events',
          type: 'Priority',
          category: 'Event',
          eligibilityCriteria: {
            tier: ['Platinum'],
          },
          validFrom: new Date('2024-01-01'),
          status: 'Active',
          currentUsage: 8,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
      ];
    }

    try {
      const snapshot = await getDocs(
        query(collection(db, COLLECTIONS.MEMBER_BENEFITS || 'memberBenefits'), orderBy('createdAt', 'desc'))
      );
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        validFrom: doc.data().validFrom?.toDate?.() || doc.data().validFrom,
        validUntil: doc.data().validUntil?.toDate?.() || doc.data().validUntil,
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
      })) as MemberBenefit[];
    } catch (error) {
      console.error('Error fetching benefits:', error);
      throw error;
    }
  }

  // Get benefit by ID
  static async getBenefitById(benefitId: string): Promise<MemberBenefit | null> {
    try {
      const docRef = doc(db, COLLECTIONS.MEMBER_BENEFITS || 'memberBenefits', benefitId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return {
          id: docSnap.id,
          ...docSnap.data(),
          validFrom: docSnap.data().validFrom?.toDate?.() || docSnap.data().validFrom,
          validUntil: docSnap.data().validUntil?.toDate?.() || docSnap.data().validUntil,
          createdAt: docSnap.data().createdAt?.toDate() || new Date(),
          updatedAt: docSnap.data().updatedAt?.toDate() || new Date(),
        } as MemberBenefit;
      }
      return null;
    } catch (error) {
      console.error('Error fetching benefit:', error);
      throw error;
    }
  }

  // Get benefits eligible for a member
  static async getEligibleBenefits(memberId: string, memberTier: string, memberPoints: number, memberRole: string, joinDate: string): Promise<MemberBenefit[]> {
    try {
      const allBenefits = await this.getAllBenefits();
      const activeBenefits = allBenefits.filter(b => b.status === 'Active');

      const now = new Date();
      return activeBenefits.filter(benefit => {
        // Check validity period
        const validFrom = toDate(benefit.validFrom);
        if (validFrom > now) return false;

        if (benefit.validUntil) {
          const validUntil = toDate(benefit.validUntil);
          if (validUntil < now) return false;
        }

        // Check eligibility criteria
        const criteria = benefit.eligibilityCriteria;

        if (criteria.tier && criteria.tier.length > 0) {
          if (!criteria.tier.includes(memberTier)) return false;
        }

        if (criteria.role && criteria.role.length > 0) {
          if (!criteria.role.includes(memberRole)) return false;
        }

        if (criteria.points !== undefined) {
          if (memberPoints < criteria.points) return false;
        }

        if (criteria.joinDate) {
          const minJoinDate = new Date(criteria.joinDate);
          const memberJoinDate = new Date(joinDate);
          if (memberJoinDate < minJoinDate) return false;
        }

        return true;
      });
    } catch (error) {
      console.error('Error getting eligible benefits:', error);
      throw error;
    }
  }

  // Create benefit
  static async createBenefit(benefitData: Omit<MemberBenefit, 'id' | 'createdAt' | 'updatedAt' | 'currentUsage'>): Promise<string> {
    if (isDevMode()) {
      const mockId = `mock-benefit-${Date.now()}`;
      console.log(`[DEV MODE] Simulating creation of benefit with ID: ${mockId}`);
      return mockId;
    }
    try {
      const newBenefit: any = {
        name: benefitData.name,
        description: benefitData.description,
        type: benefitData.type,
        category: benefitData.category,
        eligibilityCriteria: benefitData.eligibilityCriteria,
        currentUsage: 0,
        validFrom: Timestamp.fromDate(toDate(benefitData.validFrom)),
        validUntil: benefitData.validUntil ? Timestamp.fromDate(toDate(benefitData.validUntil)) : null,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      // Only include discount fields if they are defined
      if (benefitData.discountPercentage !== undefined) {
        newBenefit.discountPercentage = benefitData.discountPercentage;
      }
      if (benefitData.discountAmount !== undefined) {
        newBenefit.discountAmount = benefitData.discountAmount;
      }

      const cleanBenefit = removeUndefined(newBenefit);
      const docRef = await addDoc(collection(db, COLLECTIONS.MEMBER_BENEFITS || 'memberBenefits'), cleanBenefit);
      return docRef.id;
    } catch (error) {
      console.error('Error creating benefit:', error);
      throw error;
    }
  }

  // Update benefit
  static async updateBenefit(benefitId: string, updates: Partial<MemberBenefit>): Promise<void> {
    if (isDevMode()) {
      console.log(`[DEV MODE] Simulating update of benefit ${benefitId} with updates:`, updates);
      return;
    }
    try {
      const benefitRef = doc(db, COLLECTIONS.MEMBER_BENEFITS || 'memberBenefits', benefitId);
      const updateData: any = {
        updatedAt: Timestamp.now(),
      };

      // Only include defined fields
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.type !== undefined) updateData.type = updates.type;
      if (updates.category !== undefined) updateData.category = updates.category;
      if (updates.eligibilityCriteria !== undefined) updateData.eligibilityCriteria = updates.eligibilityCriteria;
      if (updates.discountPercentage !== undefined) updateData.discountPercentage = updates.discountPercentage;
      if (updates.discountAmount !== undefined) updateData.discountAmount = updates.discountAmount;

      if (updates.validFrom) {
        updateData.validFrom = Timestamp.fromDate(toDate(updates.validFrom));
      }
      if (updates.validUntil) {
        updateData.validUntil = Timestamp.fromDate(toDate(updates.validUntil));
      }

      const cleanUpdate = removeUndefined(updateData);
      await updateDoc(benefitRef, cleanUpdate);
    } catch (error) {
      console.error('Error updating benefit:', error);
      throw error;
    }
  }

  // Delete benefit
  static async deleteBenefit(benefitId: string): Promise<void> {
    if (isDevMode()) {
      console.log(`[DEV MODE] Simulating deletion of benefit ${benefitId}`);
      return;
    }
    try {
      await deleteDoc(doc(db, COLLECTIONS.MEMBER_BENEFITS || 'memberBenefits', benefitId));
    } catch (error) {
      console.error('Error deleting benefit:', error);
      throw error;
    }
  }

  // Record benefit usage
  static async recordBenefitUsage(memberId: string, benefitId: string, details?: string): Promise<void> {
    try {
      // Record usage
      await addDoc(collection(db, COLLECTIONS.BENEFIT_USAGE || 'benefitUsage'), {
        memberId,
        benefitId,
        usedAt: Timestamp.now(),
        details,
      });

      // Update benefit usage count
      const benefit = await this.getBenefitById(benefitId);
      if (benefit) {
        await this.updateBenefit(benefitId, {
          currentUsage: (benefit.currentUsage || 0) + 1,
        });
      }
    } catch (error) {
      console.error('Error recording benefit usage:', error);
      throw error;
    }
  }

  // Get benefit usage history
  static async getBenefitUsageHistory(benefitId?: string, memberId?: string): Promise<BenefitUsage[]> {
    try {
      let q = query(collection(db, COLLECTIONS.BENEFIT_USAGE || 'benefitUsage'), orderBy('usedAt', 'desc'));

      if (benefitId) {
        q = query(q, where('benefitId', '==', benefitId));
      }
      if (memberId) {
        q = query(q, where('memberId', '==', memberId));
      }

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        usedAt: doc.data().usedAt?.toDate() || new Date(),
      })) as BenefitUsage[];
    } catch (error) {
      console.error('Error fetching benefit usage:', error);
      throw error;
    }
  }
}

