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
import { withDevMode } from '../utils/devMode';
import { SponsorshipRecord } from '../types';
import { PointsService } from './pointsService';

const MOCK_SPONSORSHIPS: SponsorshipRecord[] = [
  { id: 'mock-s1', memberId: 'm1', memberName: 'Alex Rivera', sponsorName: 'Tech Corp', amount: 5000, date: '2026-05-15', description: 'Annual Summit sponsor' },
  { id: 'mock-s2', memberId: 'm2', memberName: 'Sarah Jenkins', sponsorName: 'Beverages Inc', amount: 1200, date: '2026-06-01', description: 'Sports day hydration' }
];

export class SponsorshipsService {
  static async getAllSponsorships(): Promise<SponsorshipRecord[]> {
    return withDevMode(
      () => [...MOCK_SPONSORSHIPS],
      async () => {
    try {
      const q = query(
        collection(db, COLLECTIONS.SPONSORSHIPS),
        orderBy('date', 'desc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(docSnap => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          memberId: d.memberId,
          memberName: d.memberName,
          sponsorName: d.sponsorName,
          amount: d.amount,
          date: d.date,
          description: d.description,
          createdAt: d.createdAt,
          updatedAt: d.updatedAt,
        };
      });
    } catch (error) {
      console.error('Error fetching sponsorships:', error);
      return [];
    }
});
  }

  static async getSponsorshipsByMember(memberId: string): Promise<SponsorshipRecord[]> {
    return withDevMode(
      () => MOCK_SPONSORSHIPS.filter(s => s.memberId === memberId),
      async () => {
    try {
      const q = query(
        collection(db, COLLECTIONS.SPONSORSHIPS),
        where('memberId', '==', memberId)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(docSnap => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          memberId: d.memberId,
          memberName: d.memberName,
          sponsorName: d.sponsorName,
          amount: d.amount,
          date: d.date,
          description: d.description,
          createdAt: d.createdAt,
          updatedAt: d.updatedAt,
        };
      });
    } catch (error) {
      console.error('Error fetching sponsorships by member:', error);
      return [];
    }
});
  }

  static async createSponsorship(data: Omit<SponsorshipRecord, 'id'>): Promise<string> {
    return withDevMode(
      async () => {
        const mockId = `mock-sponsorship-${Date.now()}`;
        console.log(`[DEV MODE] Created mock sponsorship:`, data);
        // Trigger dynamic recalculate (mock console log)
        await PointsService.recalculateMemberRadarStats(data.memberId);
        return mockId;
      },
      async () => {
    try {
      const docRef = await addDoc(collection(db, COLLECTIONS.SPONSORSHIPS), {
        ...data,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
      // Recalculate member points and radar stats
      await PointsService.recalculateMemberRadarStats(data.memberId);
      return docRef.id;
    } catch (error) {
      console.error('Error creating sponsorship:', error);
      throw error;
    }
});
  }

  static async updateSponsorship(id: string, updates: Partial<SponsorshipRecord>, previousMemberId?: string): Promise<void> {
    return withDevMode(
      async () => {
        console.log(`[DEV MODE] Updated mock sponsorship ${id}:`, updates);
        if (updates.memberId) {
          await PointsService.recalculateMemberRadarStats(updates.memberId);
        }
        if (previousMemberId && previousMemberId !== updates.memberId) {
          await PointsService.recalculateMemberRadarStats(previousMemberId);
        }
      },
      async () => {
    try {
      const docRef = doc(db, COLLECTIONS.SPONSORSHIPS, id);
      await updateDoc(docRef, {
        ...updates,
        updatedAt: Timestamp.now(),
      });
      // Recalculate for current and potentially previous member if securing member was changed
      if (updates.memberId) {
        await PointsService.recalculateMemberRadarStats(updates.memberId);
      }
      if (previousMemberId && previousMemberId !== updates.memberId) {
        await PointsService.recalculateMemberRadarStats(previousMemberId);
      }
    } catch (error) {
      console.error('Error updating sponsorship:', error);
      throw error;
    }
});
  }

  static async deleteSponsorship(id: string, memberId: string): Promise<void> {
    return withDevMode(
      async () => {
        console.log(`[DEV MODE] Deleted mock sponsorship ${id}`);
        await PointsService.recalculateMemberRadarStats(memberId);
      },
      async () => {
    try {
      const docRef = doc(db, COLLECTIONS.SPONSORSHIPS, id);
      await deleteDoc(docRef);
      // Recalculate member points and radar stats
      await PointsService.recalculateMemberRadarStats(memberId);
    } catch (error) {
      console.error('Error deleting sponsorship:', error);
      throw error;
    }
});
  }
}
