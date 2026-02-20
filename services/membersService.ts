// Members Service - CRUD Operations
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
  limit,
  Timestamp,
} from 'firebase/firestore';
import { db, auth } from '../config/firebase';
import { COLLECTIONS, DEFAULT_LO_ID } from '../config/constants';
import { Member, UserRole } from '../types';
import { isDevMode } from '../utils/devMode';
import { MOCK_MEMBERS } from './mockData';

export class MembersService {
  /** Get all members, optionally filtered by loId (for multi-LO). */
  static async getAllMembers(loIdFilter?: string | null): Promise<Member[]> {
    if (isDevMode()) {
      const list = loIdFilter
        ? MOCK_MEMBERS.filter((m: Member) => (m as any).loId === loIdFilter || !(m as any).loId)
        : MOCK_MEMBERS;
      return list;
    }

    try {
      let q;
      if (loIdFilter != null && loIdFilter !== '') {
        q = query(
          collection(db, COLLECTIONS.MEMBERS),
          where('loId', '==', loIdFilter),
          orderBy('updatedAt', 'desc')
        );
      } else {
        q = query(collection(db, COLLECTIONS.MEMBERS));
      }
      const snapshot = await getDocs(q);
      return snapshot.docs.map(d => ({ id: d.id, ...(d.data() as any) } as Member));
    } catch (error) {
      if (isDevMode()) {
        const list = loIdFilter
          ? MOCK_MEMBERS.filter((m: Member) => (m as any).loId === loIdFilter || !(m as any).loId)
          : MOCK_MEMBERS;
        return list;
      }
      console.error('Error fetching members:', error);
      throw error;
    }
  }

  // Get member by ID
  static async getMemberById(memberId: string): Promise<Member | null> {
    if (isDevMode()) {
      return MOCK_MEMBERS.find(m => m.id === memberId) || null;
    }

    try {
      const docRef = doc(db, COLLECTIONS.MEMBERS, memberId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as Member;
      }
      return null;
    } catch (error) {
      console.error('Error fetching member:', error);
      throw error;
    }
  }

  /** Create new member. Caller should pass loId (or use DEFAULT_LO_ID for single-LO). */
  static async createMember(memberData: Omit<Member, 'id'>, createdBy?: string): Promise<string> {
    if (isDevMode()) {
      const mockId = `mock-member-${Date.now()}`;
      return mockId;
    }

    try {
      const now = Timestamp.now();
      const cleanMemberData: Record<string, any> = {};

      Object.keys(memberData).forEach(key => {
        const value = memberData[key as keyof typeof memberData];
        if (value !== undefined) {
          cleanMemberData[key] = value;
        }
      });

      cleanMemberData.createdAt = now;
      cleanMemberData.updatedAt = now;
      if (createdBy != null && createdBy !== '') cleanMemberData.createdBy = createdBy;
      if (cleanMemberData.loId == null || cleanMemberData.loId === '') cleanMemberData.loId = DEFAULT_LO_ID;

      const docRef = await addDoc(collection(db, COLLECTIONS.MEMBERS), cleanMemberData);
      return docRef.id;
    } catch (error) {
      console.error('Error creating member:', error);
      throw error;
    }
  }

  /** Update member. Sets updatedAt and optionally updatedBy (audit). */
  static async updateMember(memberId: string, updates: Partial<Member>, updatedBy?: string): Promise<void> {
    try {
      const memberRef = doc(db, COLLECTIONS.MEMBERS, memberId);

      const cleanUpdates: Record<string, any> = {
        updatedAt: Timestamp.now(),
        ...(updatedBy != null && updatedBy !== '' && { updatedBy }),
      };

      Object.keys(updates).forEach(key => {
        const value = updates[key as keyof Member];
        if (value !== undefined) {
          cleanUpdates[key] = value;
        }
      });

      await updateDoc(memberRef, cleanUpdates);
    } catch (error) {
      console.error('Error updating member:', error);
      throw error;
    }
  }

  // Delete member
  static async deleteMember(memberId: string): Promise<void> {
    if (isDevMode()) {
      const index = MOCK_MEMBERS.findIndex(m => m.id === memberId);
      if (index !== -1) {
        MOCK_MEMBERS.splice(index, 1);
      }
      return;
    }

    try {
      // Prevent unnecessary Firestore permission errors by checking current user's role
      const currentUid = auth?.currentUser?.uid || null;
      if (!currentUid) {
        const e: any = new Error('User not authenticated');
        e.code = 'permission-denied';
        throw e;
      }

      // Read current user's member doc to verify ADMIN role
      const currentMemberDoc = await getDoc(doc(db, COLLECTIONS.MEMBERS, currentUid));
      const currentRole = currentMemberDoc.exists() ? (currentMemberDoc.data() as any).role : null;
      const myLoId = currentMemberDoc.exists() ? (currentMemberDoc.data() as any).loId ?? null : null;
      if (currentRole !== 'ADMIN') {
        const e: any = new Error('User lacks ADMIN role for deletion');
        e.code = 'permission-denied';
        console.warn(`Delete blocked: user ${currentUid} with role=${currentRole} attempted to delete member ${memberId}`);
        throw e;
      }

      // Read target member doc to enforce LO-level delete rule (matches Firestore rules)
      const targetDoc = await getDoc(doc(db, COLLECTIONS.MEMBERS, memberId));
      const targetLoId = targetDoc.exists() ? (targetDoc.data() as any).loId ?? null : null;

      // Firestore rule requires (resource == null || resourceInMyLo(resource.data)).
      // If target has an loId and current admin has a different loId, deny client-side to avoid permission error.
      if (targetLoId != null && myLoId != null && targetLoId !== myLoId) {
        const e: any = new Error('Cannot delete member from a different LO');
        e.code = 'permission-denied';
        console.warn(`Delete blocked by LO mismatch: user ${currentUid} lo=${myLoId} target ${memberId} lo=${targetLoId}`);
        throw e;
      }

      await deleteDoc(doc(db, COLLECTIONS.MEMBERS, memberId));
    } catch (error) {
      console.error('Error deleting member:', error, 'memberId=', memberId);
      throw error;
    }
  }

  // Search members
  static async searchMembers(searchTerm: string): Promise<Member[]> {
    try {
      // Firestore doesn't support full-text search natively
      // This is a simple implementation - consider using Algolia for production
      const allMembers = await this.getAllMembers();
      const term = searchTerm.toLowerCase();

      return allMembers.filter(member =>
        member.name.toLowerCase().includes(term) ||
        member.email.toLowerCase().includes(term) ||
        member.skills.some(skill => skill.toLowerCase().includes(term))
      );
    } catch (error) {
      console.error('Error searching members:', error);
      throw error;
    }
  }

  // Get members by role
  static async getMembersByRole(role: UserRole): Promise<Member[]> {
    try {
      const q = query(
        collection(db, COLLECTIONS.MEMBERS),
        where('role', '==', role)
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...(doc.data() as any),
      } as Member));
    } catch (error) {
      console.error('Error fetching members by role:', error);
      throw error;
    }
  }

  // Get member by email (for account linking)
  static async getMemberByEmail(email: string): Promise<Member | null> {
    if (isDevMode()) {
      return MOCK_MEMBERS.find(m => m.email.toLowerCase() === email.toLowerCase()) || null;
    }

    try {
      const q = query(
        collection(db, COLLECTIONS.MEMBERS),
        where('email', '==', email)
      );

      const snapshot = await getDocs(q);
      if (snapshot.empty) return null;

      // Return the first match
      const doc = snapshot.docs[0];
      return { id: doc.id, ...(doc.data() as any) } as Member;
    } catch (error) {
      console.error('Error fetching member by email:', error);
      throw error;
    }
  }

  // Get members at risk (churn prediction)
  static async getMembersAtRisk(): Promise<Member[]> {
    try {
      const q = query(
        collection(db, COLLECTIONS.MEMBERS),
        where('churnRisk', 'in', ['High', 'Medium'])
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...(doc.data() as any),
      } as Member));
    } catch (error) {
      console.error('Error fetching members at risk:', error);
      throw error;
    }
  }

  // Update member role (for Board transitions)
  static async updateMemberRole(memberId: string, newRole: UserRole): Promise<void> {
    try {
      await this.updateMember(memberId, { role: newRole });
    } catch (error) {
      console.error('Error updating member role:', error);
      throw error;
    }
  }

  // Assign mentor
  static async assignMentor(memberId: string, mentorId: string): Promise<void> {
    try {
      await this.updateMember(memberId, { mentorId });

      // Also update mentor's menteeIds
      const mentor = await this.getMemberById(mentorId);
      if (mentor) {
        const menteeIds = mentor.menteeIds || [];
        if (!menteeIds.includes(memberId)) {
          await this.updateMember(mentorId, {
            menteeIds: [...menteeIds, memberId],
          });
        }
      }
    } catch (error) {
      console.error('Error assigning mentor:', error);
      throw error;
    }
  }
}

