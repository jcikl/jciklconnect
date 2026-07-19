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
import { apiCache } from './cacheService';
import { logError as logServiceError } from './errorLoggingService';

const SPONSORSHIPS_CACHE_PREFIX = 'sponsorships:';
const SPONSORSHIPS_CACHE_TTL = 3 * 60 * 1000; // 3 minutes

export function invalidateSponsorshipsCache(): void {
  apiCache.deleteByPrefix(SPONSORSHIPS_CACHE_PREFIX);
}

const MOCK_SPONSORSHIPS: SponsorshipRecord[] = [
  { id: 'mock-s1', memberId: 'm1', memberName: 'Alex Rivera', sponsorName: 'Tech Corp', amount: 5000, date: '2026-05-15', description: 'Annual Summit sponsor' },
  { id: 'mock-s2', memberId: 'm2', memberName: 'Sarah Jenkins', sponsorName: 'Beverages Inc', amount: 1200, date: '2026-06-01', description: 'Sports day hydration' }
];

// P1 TODO (rules): Firestore rules currently restrict create/update/delete to isBoard().
// ADMIN and SUPER_ADMIN writes are silently rejected because their roles are not included
// in the isBoard() helper. Fix: update firestore.rules to add isAdmin() || isBoard() for
// the sponsorships collection write rules. No service-layer change needed.

// P1 TODO (denormalization): memberName is written once at creation and never synced when
// a member's display name changes. To fix, membersService.updateMember should query
// sponsorships by memberId and batch-update memberName whenever member.name changes.

export class SponsorshipsService {
  static async getAllSponsorships(): Promise<SponsorshipRecord[]> {
    return withDevMode(
      () => [...MOCK_SPONSORSHIPS],
      async () => {
    const cacheKey = `${SPONSORSHIPS_CACHE_PREFIX}all`;
    const cached = apiCache.get<SponsorshipRecord[]>(cacheKey);
    if (cached) return cached;
    try {
      const q = query(
        collection(db, COLLECTIONS.SPONSORSHIPS),
        orderBy('date', 'desc')
      );
      const snapshot = await getDocs(q);
      const result = snapshot.docs.map(docSnap => {
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
        } as SponsorshipRecord;
      });
      apiCache.set(cacheKey, result, SPONSORSHIPS_CACHE_TTL);
      return result;
    } catch (error) {
      logServiceError(error as Error, { action: 'SponsorshipsService.getAllSponsorships' });
      throw error;
    }
});
  }

  static async getSponsorshipsByMember(memberId: string): Promise<SponsorshipRecord[]> {
    return withDevMode(
      () => MOCK_SPONSORSHIPS.filter(s => s.memberId === memberId),
      async () => {
    const cacheKey = `${SPONSORSHIPS_CACHE_PREFIX}member:${memberId}`;
    const cached = apiCache.get<SponsorshipRecord[]>(cacheKey);
    if (cached) return cached;
    try {
      const q = query(
        collection(db, COLLECTIONS.SPONSORSHIPS),
        where('memberId', '==', memberId)
      );
      const snapshot = await getDocs(q);
      const result = snapshot.docs.map(docSnap => {
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
        } as SponsorshipRecord;
      });
      apiCache.set(cacheKey, result, SPONSORSHIPS_CACHE_TTL);
      return result;
    } catch (error) {
      logServiceError(error as Error, { action: 'SponsorshipsService.getSponsorshipsByMember' });
      throw error;
    }
});
  }

  /**
   * P2: pass transactionId in data to link the sponsorship to a finance transaction.
   * If a transactionId is provided it is stored on the document for cross-reference;
   * no automatic transaction creation is performed here — callers must create the
   * matching finance transaction separately and pass its ID.
   */
  static async createSponsorship(data: Omit<SponsorshipRecord, 'id'>): Promise<string> {
    return withDevMode(
      async () => {
        const mockId = `mock-sponsorship-${Date.now()}`;
        console.log(`[DEV MODE] Created mock sponsorship:`, data);
        invalidateSponsorshipsCache();
        try {
          await PointsService.recalculateMemberRadarStats(data.memberId);
        } catch (radarErr) {
          logServiceError(radarErr as Error, { action: '[DEV] SponsorshipsService.createSponsorship → recalculateMemberRadarStats' });
        }
        return mockId;
      },
      async () => {
    try {
      const docRef = await addDoc(collection(db, COLLECTIONS.SPONSORSHIPS), {
        ...data,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
      invalidateSponsorshipsCache();
      // Recalculate member points and radar stats — non-fatal if it fails
      try {
        await PointsService.recalculateMemberRadarStats(data.memberId);
      } catch (radarErr) {
        logServiceError(radarErr as Error, { action: 'SponsorshipsService.createSponsorship → recalculateMemberRadarStats' });
      }
      return docRef.id;
    } catch (error) {
      logServiceError(error as Error, { action: 'SponsorshipsService.createSponsorship' });
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
      invalidateSponsorshipsCache();
      // Recalculate for current and potentially previous member — non-fatal if it fails
      const membersToRecalc = new Set<string>();
      if (updates.memberId) membersToRecalc.add(updates.memberId);
      if (previousMemberId && previousMemberId !== updates.memberId) membersToRecalc.add(previousMemberId);
      for (const mid of membersToRecalc) {
        try {
          await PointsService.recalculateMemberRadarStats(mid);
        } catch (radarErr) {
          logServiceError(radarErr as Error, { action: `SponsorshipsService.updateSponsorship → recalculateMemberRadarStats(${mid})` });
        }
      }
    } catch (error) {
      logServiceError(error as Error, { action: 'SponsorshipsService.updateSponsorship' });
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
      invalidateSponsorshipsCache();
      // Recalculate member points and radar stats — non-fatal if it fails
      try {
        await PointsService.recalculateMemberRadarStats(memberId);
      } catch (radarErr) {
        logServiceError(radarErr as Error, { action: 'SponsorshipsService.deleteSponsorship → recalculateMemberRadarStats' });
      }
    } catch (error) {
      logServiceError(error as Error, { action: 'SponsorshipsService.deleteSponsorship' });
      throw error;
    }
});
  }
}
