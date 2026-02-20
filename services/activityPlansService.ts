// Activity Plans Service - CRUD Operations
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

export interface ActivityPlan {
  id?: string;
  title: string;
  description: string;
  /** @deprecated use pillar + category + type instead */
  type?: 'Community' | 'Business' | 'Individual' | 'International';
  level?: 'JCI' | 'National' | 'Area' | 'Local';
  pillar?: 'Individual' | 'Community' | 'Business' | 'International' | 'LOM' | 'Chapter';
  category?: 'programs' | 'skill_development' | 'events' | 'projects';
  /** Project type from PROJECT_TYPES_BY_CATEGORY */
  projectType?: string;
  proposedDate: string;
  proposedBudget: number;
  eventStartDate?: string;
  eventEndDate?: string;
  eventStartTime?: string;
  eventEndTime?: string;
  objectives: string;
  expectedImpact: string;
  targetAudience?: string;
  resources?: string[];
  timeline?: string;
  status: 'Draft' | 'Submitted' | 'Under Review' | 'Approved' | 'Rejected' | 'Active';
  submittedBy: string;
  submittedDate?: Date | Timestamp;
  reviewedBy?: string;
  reviewedDate?: Date | Timestamp;
  reviewComments?: string;
  version: number;
  previousVersionId?: string;
  attachments?: string[];
  createdAt: Date | Timestamp;
  updatedAt: Date | Timestamp;
  /** Parent project/activity this plan belongs to (when created from project view) */
  parentProjectId?: string;
}

export class ActivityPlansService {
  // Get all activity plans
  static async getAllActivityPlans(): Promise<ActivityPlan[]> {
    if (isDevMode()) {
      return [
        {
          id: 'ap1',
          title: 'Summer Leadership Summit',
          description: 'Annual leadership development program for young professionals',
          type: 'Community',
          proposedDate: '2024-07-15',
          proposedBudget: 15000,
          objectives: 'Develop leadership skills, network building, community impact',
          expectedImpact: '50+ participants, 10+ partnerships, media coverage',
          status: 'Under Review',
          submittedBy: 'u1',
          version: 1,
          createdAt: new Date('2024-01-10'),
          updatedAt: new Date('2024-01-15'),
        },
        {
          id: 'ap2',
          title: 'Business Networking Mixer',
          description: 'Quarterly networking event for members and local businesses',
          type: 'Business',
          proposedDate: '2024-03-20',
          proposedBudget: 5000,
          objectives: 'Facilitate business connections, member engagement',
          expectedImpact: '100+ attendees, 20+ business connections',
          status: 'Draft',
          submittedBy: 'u2',
          version: 1,
          createdAt: new Date('2024-02-01'),
          updatedAt: new Date('2024-02-05'),
        },
      ];
    }

    try {
      const snapshot = await getDocs(
        query(
          collection(db, COLLECTIONS.PROJECTS),
          where('status', 'in', ['Draft', 'Submitted', 'Under Review', 'Rejected']),
          orderBy('createdAt', 'desc')
        )
      );
      return snapshot.docs.map(d => ({
        id: d.id,
        ...d.data(),
        proposedDate: d.data().proposedDate?.toDate?.()?.toISOString?.() ?? d.data().proposedDate,
        submittedDate: d.data().submittedDate?.toDate?.() ?? d.data().submittedDate,
        reviewedDate: d.data().reviewedDate?.toDate?.() ?? d.data().reviewedDate,
        createdAt: d.data().createdAt?.toDate?.() ?? new Date(),
        updatedAt: d.data().updatedAt?.toDate?.() ?? new Date(),
      })) as ActivityPlan[];
    } catch (error) {
      console.error('Error fetching activity plans:', error);
      throw error;
    }
  }

  // Get activity plan by ID (from projects collection)
  static async getActivityPlanById(planId: string): Promise<ActivityPlan | null> {
    try {
      const docRef = doc(db, COLLECTIONS.PROJECTS, planId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return {
          id: docSnap.id,
          ...docSnap.data(),
          proposedDate: docSnap.data().proposedDate?.toDate?.()?.toISOString() || docSnap.data().proposedDate,
          submittedDate: docSnap.data().submittedDate?.toDate?.() || docSnap.data().submittedDate,
          reviewedDate: docSnap.data().reviewedDate?.toDate?.() || docSnap.data().reviewedDate,
          createdAt: docSnap.data().createdAt?.toDate() || new Date(),
          updatedAt: docSnap.data().updatedAt?.toDate() || new Date(),
        } as ActivityPlan;
      }
      return null;
    } catch (error) {
      console.error('Error fetching activity plan:', error);
      throw error;
    }
  }

  // Get activity plans for a specific project (parentProjectId)
  static async getActivityPlansByProjectId(projectId: string): Promise<ActivityPlan[]> {
    if (isDevMode()) {
      return [
        {
          id: 'ap-p1',
          title: 'Venue & Catering Plan',
          description: 'Detailed plan for venue booking and catering arrangements',
          type: 'Community',
          parentProjectId: projectId,
          proposedDate: '2024-06-01',
          proposedBudget: 8000,
          objectives: 'Secure venue, finalize menu',
          expectedImpact: 'Smooth event execution',
          status: 'Draft',
          submittedBy: 'u1',
          version: 1,
          createdAt: new Date('2024-01-15'),
          updatedAt: new Date('2024-01-15'),
        },
      ];
    }
    try {
      const snapshot = await getDocs(
        query(
          collection(db, COLLECTIONS.ACTIVITY_PLANS),
          where('parentProjectId', '==', projectId),
          orderBy('createdAt', 'desc')
        )
      );
      return snapshot.docs.map(d => ({
        id: d.id,
        ...d.data(),
        proposedDate: d.data().proposedDate?.toDate?.()?.toISOString?.() ?? d.data().proposedDate,
        submittedDate: d.data().submittedDate?.toDate?.() ?? d.data().submittedDate,
        reviewedDate: d.data().reviewedDate?.toDate?.() ?? d.data().reviewedDate,
        createdAt: d.data().createdAt?.toDate?.() ?? new Date(),
        updatedAt: d.data().updatedAt?.toDate?.() ?? new Date(),
      })) as ActivityPlan[];
    } catch (error) {
      console.error('Error fetching activity plans by project:', error);
      throw error;
    }
  }

  // Get activity plans by status
  static async getActivityPlansByStatus(status: ActivityPlan['status']): Promise<ActivityPlan[]> {
    try {
      const snapshot = await getDocs(
        query(
          collection(db, COLLECTIONS.PROJECTS),
          where('status', '==', status),
          orderBy('createdAt', 'desc')
        )
      );
      return snapshot.docs.map(d => ({
        id: d.id,
        ...d.data(),
        proposedDate: d.data().proposedDate?.toDate?.()?.toISOString?.() ?? d.data().proposedDate,
        submittedDate: d.data().submittedDate?.toDate?.() ?? d.data().submittedDate,
        reviewedDate: d.data().reviewedDate?.toDate?.() ?? d.data().reviewedDate,
        createdAt: d.data().createdAt?.toDate?.() ?? new Date(),
        updatedAt: d.data().updatedAt?.toDate?.() ?? new Date(),
      })) as ActivityPlan[];
    } catch (error) {
      console.error('Error fetching activity plans by status:', error);
      throw error;
    }
  }

  // Create activity plan (stored in projects collection)
  static async createActivityPlan(planData: Omit<ActivityPlan, 'id' | 'createdAt' | 'updatedAt' | 'version'>): Promise<string> {
    try {
      const cleanPlanData: Record<string, unknown> = {
        version: 1,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };
      Object.keys(planData).forEach(key => {
        const value = planData[key as keyof typeof planData];
        if (value !== undefined) {
          if (key === 'proposedDate' && value) {
            cleanPlanData.proposedDate = Timestamp.fromDate(new Date(value as string | Date));
          } else if (key === 'submittedDate' || key === 'reviewedDate') {
            cleanPlanData[key] = value instanceof Date ? Timestamp.fromDate(value) : value;
          } else {
            cleanPlanData[key] = value;
          }
        }
      });

      const docRef = await addDoc(collection(db, COLLECTIONS.PROJECTS), cleanPlanData);
      return docRef.id;
    } catch (error) {
      console.error('Error creating activity plan:', error);
      throw error;
    }
  }

  // Update activity plan
  static async updateActivityPlan(planId: string, updates: Partial<ActivityPlan>): Promise<void> {
    try {
      const planRef = doc(db, COLLECTIONS.PROJECTS, planId);
      
      // Filter out undefined values - Firestore doesn't accept undefined
      const updateData: Record<string, any> = {
        updatedAt: Timestamp.now(),
      };
      
      // Only include defined values (not undefined)
      Object.keys(updates).forEach(key => {
        const value = updates[key as keyof typeof updates];
        if (value !== undefined) {
          if (key === 'proposedDate' && value) {
            updateData.proposedDate = Timestamp.fromDate(new Date(value as string | Date));
          } else {
            updateData[key] = value;
          }
        }
      });
      
      await updateDoc(planRef, updateData);
    } catch (error) {
      console.error('Error updating activity plan:', error);
      throw error;
    }
  }

  // Submit activity plan for review
  static async submitActivityPlan(planId: string, submittedBy: string): Promise<void> {
    try {
      await this.updateActivityPlan(planId, {
        status: 'Submitted',
        submittedBy,
        submittedDate: new Date(),
      });
    } catch (error) {
      console.error('Error submitting activity plan:', error);
      throw error;
    }
  }

  // Review activity plan (approve/reject)
  static async reviewActivityPlan(
    planId: string,
    decision: 'Approved' | 'Rejected',
    reviewedBy: string,
    comments?: string
  ): Promise<void> {
    if (isDevMode()) {
      console.log(`[Dev Mode] Would review activity plan ${planId}: ${decision}`);
      return;
    }

    try {
      const plan = await this.getActivityPlanById(planId);
      if (!plan) {
        throw new Error('Activity plan not found');
      }

      await this.updateActivityPlan(planId, {
        status: decision,
        reviewedBy,
        reviewedDate: new Date(),
        reviewComments: comments,
      });

      // Send notification to plan submitter
      try {
        const { CommunicationService } = await import('./communicationService');
        await CommunicationService.createNotification({
          memberId: plan.submittedBy,
          title: `Activity Plan ${decision}: ${plan.title}`,
          message: comments 
            ? `Your activity plan has been ${decision.toLowerCase()}. Comments: ${comments}`
            : `Your activity plan has been ${decision.toLowerCase()}.`,
          type: decision === 'Approved' ? 'success' : 'warning',
        });
      } catch (notifError) {
        console.error('Error sending review notification:', notifError);
        // Don't throw - notification failure shouldn't block the review
      }
    } catch (error) {
      console.error('Error reviewing activity plan:', error);
      throw error;
    }
  }

  // Create new version of activity plan
  static async createNewVersion(planId: string, updates: Partial<ActivityPlan>, submittedBy: string): Promise<string> {
    try {
      const existingPlan = await this.getActivityPlanById(planId);
      if (!existingPlan) {
        throw new Error('Activity plan not found');
      }

      const newVersion: Record<string, unknown> = {
        version: existingPlan.version + 1,
        previousVersionId: planId,
        status: 'Draft' as const,
        submittedBy,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      // Copy existing plan data (excluding id and version-related fields)
      Object.keys(existingPlan).forEach(key => {
        if (key !== 'id' && key !== 'version' && key !== 'previousVersionId' && 
            key !== 'submittedDate' && key !== 'reviewedBy' && key !== 'reviewedDate' && 
            key !== 'reviewComments' && key !== 'createdAt' && key !== 'updatedAt') {
          const value = existingPlan[key as keyof ActivityPlan];
          if (value !== undefined) {
            newVersion[key] = value;
          }
        }
      });

      // Apply updates (excluding undefined values)
      Object.keys(updates).forEach(key => {
        const value = updates[key as keyof typeof updates];
        if (value !== undefined) {
          newVersion[key] = value;
        }
      });

      const docRef = await addDoc(collection(db, COLLECTIONS.PROJECTS), newVersion);
      return docRef.id;
    } catch (error) {
      console.error('Error creating new version:', error);
      throw error;
    }
  }

  // Delete activity plan
  static async deleteActivityPlan(planId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, COLLECTIONS.PROJECTS, planId));
    } catch (error) {
      console.error('Error deleting activity plan:', error);
      throw error;
    }
  }
}

