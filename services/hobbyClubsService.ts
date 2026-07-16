// Hobby Clubs Service - CRUD Operations
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
  runTransaction,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/constants';
import { HobbyClub, ClubActivity } from '../types';
import { isDevMode, withDevMode } from '../utils/devMode';
import { apiCache } from './cacheService';
import { errorLoggingService } from './errorLoggingService';
import { MOCK_CLUBS } from './mockData';

// --- Cache key prefixes ---
const CACHE_PREFIX_CLUBS = 'hobbyClubs:';
const CACHE_ALL_CLUBS = 'hobbyClubs:all';
const CACHE_TTL = 3 * 60 * 1000; // 3 minutes

function clubKey(clubId: string) {
  return `${CACHE_PREFIX_CLUBS}${clubId}`;
}

export class HobbyClubsService {
  /** Invalidate all hobby-clubs cache entries after any write. */
  static invalidateClubsCache(clubId?: string): void {
    apiCache.delete(CACHE_ALL_CLUBS);
    apiCache.deleteByPrefix(CACHE_PREFIX_CLUBS);
    if (clubId) apiCache.delete(clubKey(clubId));
  }

  // Get all clubs
  static async getAllClubs(): Promise<HobbyClub[]> {
    if (isDevMode()) return MOCK_CLUBS;
    return apiCache.getOrSet(
      CACHE_ALL_CLUBS,
      async () => {
        try {
          const snapshot = await getDocs(
            query(collection(db, COLLECTIONS.HOBBY_CLUBS), orderBy('name', 'asc'))
          );
          return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as HobbyClub));
        } catch (error) {
          errorLoggingService.logError(error as Error, {
            component: 'HobbyClubsService',
            action: 'getAllClubs',
          });
          throw error;
        }
      },
      CACHE_TTL
    );
  }

  // Get club by ID
  static async getClubById(clubId: string): Promise<HobbyClub | null> {
    if (isDevMode()) return MOCK_CLUBS.find(c => c.id === clubId) ?? null;
    return apiCache.getOrSet(
      clubKey(clubId),
      async () => {
        try {
          const docRef = doc(db, COLLECTIONS.HOBBY_CLUBS, clubId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            return { id: docSnap.id, ...docSnap.data() } as HobbyClub;
          }
          return null;
        } catch (error) {
          errorLoggingService.logError(error as Error, {
            component: 'HobbyClubsService',
            action: 'getClubById',
            additionalData: { clubId },
          });
          throw error;
        }
      },
      CACHE_TTL
    );
  }

  // Create club
  static async createClub(clubData: Omit<HobbyClub, 'id' | 'membersCount'>): Promise<string> {
    return withDevMode(
      () => `mock-club-${Date.now()}`,
      async () => {
        try {
          const newClub = {
            ...clubData,
            membersCount: 1, // Creator is first member
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
          };
          const docRef = await addDoc(collection(db, COLLECTIONS.HOBBY_CLUBS), newClub);
          this.invalidateClubsCache();
          return docRef.id;
        } catch (error) {
          errorLoggingService.logError(error as Error, {
            component: 'HobbyClubsService',
            action: 'createClub',
          });
          throw error;
        }
      }
    );
  }

  // Update club
  static async updateClub(clubId: string, updates: Partial<HobbyClub>): Promise<void> {
    if (isDevMode()) return;
    try {
      const clubRef = doc(db, COLLECTIONS.HOBBY_CLUBS, clubId);
      await updateDoc(clubRef, {
        ...updates,
        updatedAt: Timestamp.now(),
      });
      this.invalidateClubsCache(clubId);
    } catch (error) {
      errorLoggingService.logError(error as Error, {
        component: 'HobbyClubsService',
        action: 'updateClub',
        additionalData: { clubId },
      });
      throw error;
    }
  }

  /**
   * Soft-delete a club by setting isDeleted: true.
   * Hard deletion is avoided to prevent stale memberIds references in other documents.
   */
  static async deleteClub(clubId: string): Promise<void> {
    if (isDevMode()) return;
    try {
      const clubRef = doc(db, COLLECTIONS.HOBBY_CLUBS, clubId);
      await updateDoc(clubRef, {
        isDeleted: true,
        updatedAt: Timestamp.now(),
      });
      this.invalidateClubsCache(clubId);
    } catch (error) {
      errorLoggingService.logError(error as Error, {
        component: 'HobbyClubsService',
        action: 'deleteClub',
        additionalData: { clubId },
      });
      throw error;
    }
  }

  /**
   * Join a club.
   * Uses runTransaction to atomically: read current doc → check capacity → add member + increment count.
   * Prevents race conditions where two members join simultaneously and exceed capacity.
   */
  static async joinClub(clubId: string, memberId: string): Promise<void> {
    if (isDevMode()) return;
    try {
      await runTransaction(db, async (txn) => {
        const clubRef = doc(db, COLLECTIONS.HOBBY_CLUBS, clubId);
        const clubSnap = await txn.get(clubRef);
        if (!clubSnap.exists()) throw new Error('Club not found.');

        const data = clubSnap.data();
        const currentMembers: string[] = data.memberIds || [];
        if (currentMembers.includes(memberId)) return; // already a member — idempotent

        const capacity: number | undefined = data.capacity;
        if (capacity !== undefined && currentMembers.length >= capacity) {
          throw new Error('This club has reached its maximum capacity.');
        }

        txn.update(clubRef, {
          memberIds: [...currentMembers, memberId],
          membersCount: currentMembers.length + 1,
          updatedAt: Timestamp.now(),
        });
      });
      this.invalidateClubsCache(clubId);
    } catch (error) {
      errorLoggingService.logError(error as Error, {
        component: 'HobbyClubsService',
        action: 'joinClub',
        additionalData: { clubId, memberId },
      });
      throw error;
    }
  }

  /**
   * Leave a club.
   * Guard: the club lead cannot leave without reassigning first.
   */
  static async leaveClub(clubId: string, memberId: string): Promise<void> {
    if (isDevMode()) return;
    try {
      await runTransaction(db, async (txn) => {
        const clubRef = doc(db, COLLECTIONS.HOBBY_CLUBS, clubId);
        const clubSnap = await txn.get(clubRef);
        if (!clubSnap.exists()) throw new Error('Club not found.');

        const data = clubSnap.data();
        if (data.leadId === memberId) {
          throw new Error('Club lead cannot leave without assigning a new lead first.');
        }

        const currentMembers: string[] = data.memberIds || [];
        txn.update(clubRef, {
          memberIds: currentMembers.filter(id => id !== memberId),
          membersCount: Math.max(0, currentMembers.length - 1),
          updatedAt: Timestamp.now(),
        });
      });
      this.invalidateClubsCache(clubId);
    } catch (error) {
      errorLoggingService.logError(error as Error, {
        component: 'HobbyClubsService',
        action: 'leaveClub',
        additionalData: { clubId, memberId },
      });
      throw error;
    }
  }

  // Get clubs by category
  static async getClubsByCategory(category: HobbyClub['category']): Promise<HobbyClub[]> {
    if (isDevMode()) return MOCK_CLUBS.filter(c => c.category === category);
    const cacheKey = `${CACHE_PREFIX_CLUBS}category:${category}`;
    return apiCache.getOrSet(
      cacheKey,
      async () => {
        try {
          const q = query(
            collection(db, COLLECTIONS.HOBBY_CLUBS),
            where('category', '==', category),
            orderBy('name', 'asc')
          );
          const snapshot = await getDocs(q);
          return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as HobbyClub));
        } catch (error) {
          errorLoggingService.logError(error as Error, {
            component: 'HobbyClubsService',
            action: 'getClubsByCategory',
            additionalData: { category },
          });
          throw error;
        }
      },
      CACHE_TTL
    );
  }

  // Derive the card-display string from the earliest upcoming activity
  private static computeNextActivity(activities: ClubActivity[]): string {
    const now = new Date();
    const upcoming = activities
      .filter(a => a.date && new Date(a.date) >= now)
      .sort((a, b) => a.date.localeCompare(b.date));
    const next = upcoming[0] || [...activities].sort((a, b) => b.date.localeCompare(a.date))[0];
    return next ? `${next.date.replace('T', ' ')} — ${next.description}` : '';
  }

  private static async writeActivities(clubId: string, activities: ClubActivity[]): Promise<void> {
    const clubRef = doc(db, COLLECTIONS.HOBBY_CLUBS, clubId);
    await updateDoc(clubRef, {
      activities,
      nextActivity: this.computeNextActivity(activities),
      updatedAt: Timestamp.now(),
    });
    this.invalidateClubsCache(clubId);
  }

  // Read a club's activities
  static async getActivities(clubId: string): Promise<ClubActivity[]> {
    const club = await this.getClubById(clubId);
    return club?.activities || [];
  }

  // Add a club activity
  static async addActivity(clubId: string, date: string, description: string): Promise<void> {
    if (isDevMode()) return;
    try {
      const activities = await this.getActivities(clubId);
      activities.push({
        id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        date,
        description,
      });
      await this.writeActivities(clubId, activities);
    } catch (error) {
      errorLoggingService.logError(error as Error, {
        component: 'HobbyClubsService',
        action: 'addActivity',
        additionalData: { clubId },
      });
      throw error;
    }
  }

  // Update a club activity
  static async updateActivity(clubId: string, activityId: string, updates: Partial<Omit<ClubActivity, 'id'>>): Promise<void> {
    if (isDevMode()) return;
    try {
      const activities = await this.getActivities(clubId);
      const idx = activities.findIndex(a => a.id === activityId);
      if (idx === -1) throw new Error('Activity not found');
      activities[idx] = { ...activities[idx], ...updates };
      await this.writeActivities(clubId, activities);
    } catch (error) {
      errorLoggingService.logError(error as Error, {
        component: 'HobbyClubsService',
        action: 'updateActivity',
        additionalData: { clubId, activityId },
      });
      throw error;
    }
  }

  // Delete a club activity
  static async deleteActivity(clubId: string, activityId: string): Promise<void> {
    if (isDevMode()) return;
    try {
      const activities = await this.getActivities(clubId);
      await this.writeActivities(clubId, activities.filter(a => a.id !== activityId));
    } catch (error) {
      errorLoggingService.logError(error as Error, {
        component: 'HobbyClubsService',
        action: 'deleteActivity',
        additionalData: { clubId, activityId },
      });
      throw error;
    }
  }

  /** @deprecated kept for backward compatibility — adds an activity */
  static async scheduleActivity(clubId: string, activityDate: string, description: string): Promise<void> {
    return this.addActivity(clubId, activityDate, description);
  }

  // Get club members
  static async getClubMembers(clubId: string): Promise<string[]> {
    if (isDevMode()) return [];
    try {
      const club = await this.getClubById(clubId);
      return club?.memberIds || [];
    } catch (error) {
      errorLoggingService.logError(error as Error, {
        component: 'HobbyClubsService',
        action: 'getClubMembers',
        additionalData: { clubId },
      });
      throw error;
    }
  }
}
