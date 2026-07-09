// Hobby Clubs Service - CRUD Operations
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
import { HobbyClub, ClubActivity } from '../types';
import { isDevMode } from '../utils/devMode';
import { MOCK_CLUBS } from './mockData';

export class HobbyClubsService {
  // Get all clubs
  static async getAllClubs(): Promise<HobbyClub[]> {
    if (isDevMode()) {
      return MOCK_CLUBS;
    }
    
    try {
      const snapshot = await getDocs(
        query(collection(db, COLLECTIONS.HOBBY_CLUBS), orderBy('name', 'asc'))
      );
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as HobbyClub));
    } catch (error) {
      console.error('Error fetching hobby clubs:', error);
      throw error;
    }
  }

  // Get club by ID
  static async getClubById(clubId: string): Promise<HobbyClub | null> {
    try {
      const docRef = doc(db, COLLECTIONS.HOBBY_CLUBS, clubId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as HobbyClub;
      }
      return null;
    } catch (error) {
      console.error('Error fetching hobby club:', error);
      throw error;
    }
  }

  // Create club
  static async createClub(clubData: Omit<HobbyClub, 'id' | 'membersCount'>): Promise<string> {
    if (isDevMode()) {
      const newId = `mock-club-${Date.now()}`;
      console.log(`[DEV MODE] Simulating creation of hobby club with ID: ${newId}`);
      return newId;
    }
    
    try {
      const newClub = {
        ...clubData,
        membersCount: 1, // Creator is first member
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };
      
      const docRef = await addDoc(collection(db, COLLECTIONS.HOBBY_CLUBS), newClub);
      return docRef.id;
    } catch (error) {
      console.error('Error creating hobby club:', error);
      throw error;
    }
  }

  // Update club
  static async updateClub(clubId: string, updates: Partial<HobbyClub>): Promise<void> {
    try {
      const clubRef = doc(db, COLLECTIONS.HOBBY_CLUBS, clubId);
      await updateDoc(clubRef, {
        ...updates,
        updatedAt: Timestamp.now(),
      });
    } catch (error) {
      console.error('Error updating hobby club:', error);
      throw error;
    }
  }

  // Delete club
  static async deleteClub(clubId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, COLLECTIONS.HOBBY_CLUBS, clubId));
    } catch (error) {
      console.error('Error deleting hobby club:', error);
      throw error;
    }
  }

  // Join club
  static async joinClub(clubId: string, memberId: string): Promise<void> {
    if (isDevMode()) {
      // In dev mode, just return without doing anything
      return;
    }
    
    try {
      const clubRef = doc(db, COLLECTIONS.HOBBY_CLUBS, clubId);
      const clubSnap = await getDoc(clubRef);
      
      if (clubSnap.exists()) {
        const currentMembers = clubSnap.data().memberIds || [];
        if (!currentMembers.includes(memberId)) {
          await updateDoc(clubRef, {
            memberIds: [...currentMembers, memberId],
            membersCount: (clubSnap.data().membersCount || 0) + 1,
            updatedAt: Timestamp.now(),
          });
        }
      }
    } catch (error) {
      console.error('Error joining club:', error);
      throw error;
    }
  }

  // Leave club
  static async leaveClub(clubId: string, memberId: string): Promise<void> {
    try {
      const clubRef = doc(db, COLLECTIONS.HOBBY_CLUBS, clubId);
      const clubSnap = await getDoc(clubRef);
      
      if (clubSnap.exists()) {
        const currentMembers = clubSnap.data().memberIds || [];
        await updateDoc(clubRef, {
          memberIds: currentMembers.filter((id: string) => id !== memberId),
          membersCount: Math.max(0, (clubSnap.data().membersCount || 1) - 1),
          updatedAt: Timestamp.now(),
        });
      }
    } catch (error) {
      console.error('Error leaving club:', error);
      throw error;
    }
  }

  // Get clubs by category
  static async getClubsByCategory(category: HobbyClub['category']): Promise<HobbyClub[]> {
    try {
      const q = query(
        collection(db, COLLECTIONS.HOBBY_CLUBS),
        where('category', '==', category),
        orderBy('name', 'asc')
      );
      
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as HobbyClub));
    } catch (error) {
      console.error('Error fetching clubs by category:', error);
      throw error;
    }
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
  }

  // Read a club's activities (migrates a legacy `nextActivity` string on the fly for display)
  static async getActivities(clubId: string): Promise<ClubActivity[]> {
    const club = await this.getClubById(clubId);
    return club?.activities || [];
  }

  // Add a club activity
  static async addActivity(clubId: string, date: string, description: string): Promise<void> {
    try {
      const activities = await this.getActivities(clubId);
      activities.push({
        id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        date,
        description,
      });
      await this.writeActivities(clubId, activities);
    } catch (error) {
      console.error('Error adding activity:', error);
      throw error;
    }
  }

  // Update a club activity
  static async updateActivity(clubId: string, activityId: string, updates: Partial<Omit<ClubActivity, 'id'>>): Promise<void> {
    try {
      const activities = await this.getActivities(clubId);
      const idx = activities.findIndex(a => a.id === activityId);
      if (idx === -1) throw new Error('Activity not found');
      activities[idx] = { ...activities[idx], ...updates };
      await this.writeActivities(clubId, activities);
    } catch (error) {
      console.error('Error updating activity:', error);
      throw error;
    }
  }

  // Delete a club activity
  static async deleteActivity(clubId: string, activityId: string): Promise<void> {
    try {
      const activities = await this.getActivities(clubId);
      await this.writeActivities(clubId, activities.filter(a => a.id !== activityId));
    } catch (error) {
      console.error('Error deleting activity:', error);
      throw error;
    }
  }

  /** @deprecated kept for backward compatibility — adds an activity */
  static async scheduleActivity(clubId: string, activityDate: string, description: string): Promise<void> {
    return this.addActivity(clubId, activityDate, description);
  }

  // Get club members
  static async getClubMembers(clubId: string): Promise<string[]> {
    try {
      const clubRef = doc(db, COLLECTIONS.HOBBY_CLUBS, clubId);
      const clubSnap = await getDoc(clubRef);
      
      if (clubSnap.exists()) {
        return clubSnap.data().memberIds || [];
      }
      return [];
    } catch (error) {
      console.error('Error fetching club members:', error);
      throw error;
    }
  }
}

