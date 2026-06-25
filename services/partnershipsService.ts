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
import { Partnership } from '../types';

/**
 * Default mock partnerships used as fallback when Firestore is inaccessible
 * (e.g. guest user without read permissions)
 */
const MOCK_PARTNERSHIPS: Partnership[] = [
  {
    id: 'mock-p1',
    name: 'Gym Fitness Co',
    period: { startDate: '2026-01-01', endDate: '2026-12-31' },
    memberBenefits: '15% off all gym membership tiers and free assessment.',
    redeemMethod: 'Show your JCI membership card at checkout and use code JCI15GYM.',
    banner: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&q=80&w=400',
    eligbleRoles: ['official member', 'paid_due_member', 'lifetime member'],
    status: 'active',
  },
  {
    id: 'mock-p2',
    name: 'Urban Coffee Roast',
    period: { startDate: '2026-01-01', endDate: '2026-06-30' },
    memberBenefits: 'Buy 1 Free 1 on all Espresso-based drinks on weekdays.',
    redeemMethod: 'Scan the JCI app barcode at the counter to redeem.',
    banner: 'https://images.unsplash.com/photo-1507133750040-4a8f57021571?auto=format&fit=crop&q=80&w=400',
    eligbleRoles: ['probation member', 'official member', 'paid_due_member', 'associate member', 'lifetime member'],
    status: 'active',
  },
  {
    id: 'mock-p3',
    name: 'Hotel Premium Resort',
    period: { startDate: '2026-02-01', endDate: '2026-12-31' },
    memberBenefits: '10% off room bookings with complimentary buffet breakfast.',
    redeemMethod: 'Enter promo code JCIHOTEL10 on the resort booking site.',
    banner: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&q=80&w=400',
    eligbleRoles: ['paid_due_member', 'lifetime member'],
    status: 'active',
  },
];

/** Convert a Firestore Timestamp / Date / string to 'YYYY-MM-DD' */
function toDateString(val: any): string {
  if (!val) return '';
  if (typeof val === 'string') return val.split('T')[0];
  if (val.toDate) return val.toDate().toISOString().split('T')[0]; // Firestore Timestamp
  if (val instanceof Date) return val.toISOString().split('T')[0];
  return '';
}

export class PartnershipsService {
  /**
   * Get all partnerships.
   *
   * IMPORTANT: Partnership data is managed through the admin panel's
   * "Partnership & Promotions" page, which stores records in the
   * `advertisements` Firestore collection (COLLECTIONS.ADVERTISEMENTS).
   *
   * This method reads from `advertisements`, maps each Advertisement
   * document into the Partnership interface, and returns it.
   *
   * For guest users who lack Firestore read permissions, it gracefully
   * falls back to in-memory mock data.
   */
  static async getAllPartnerships(): Promise<Partnership[]> {
    if (isDevMode()) {
      return [...MOCK_PARTNERSHIPS];
    }

    try {
      // Read from the advertisements collection — the actual source of partnership data
      const snapshot = await getDocs(
        query(collection(db, COLLECTIONS.ADVERTISEMENTS || 'advertisements'))
      );

      if (snapshot.empty) {
        console.log('[PartnershipsService] advertisements collection is empty, returning mock data.');
        return [...MOCK_PARTNERSHIPS];
      }

      // Map Advertisement documents → Partnership interface
      const results: Partnership[] = snapshot.docs.map(docSnap => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          name: d.title || 'Untitled Partner',
          period: {
            startDate: toDateString(d.startDate),
            endDate: toDateString(d.endDate),
          },
          memberBenefits: d.description || '',
          redeemMethod: d.linkUrl || d.description || '',
          banner: d.logoUrl || '',
          eligbleRoles: d.targetCriteria?.tiers || d.targetCriteria?.roles || [
            'probation member', 'official member', 'paid_due_member',
            'associate member', 'lifetime member',
          ],
          status: (d.status === 'Active' ? 'active' : 'inactive') as 'active' | 'inactive',
        };
      });

      console.log(`[PartnershipsService] Loaded ${results.length} partnerships from advertisements collection.`);
      return results;
    } catch (error) {
      // Guest users will hit permission-denied here — gracefully fall back
      console.warn('[PartnershipsService] Cannot read advertisements (falling back to mock data):', error);
      return [...MOCK_PARTNERSHIPS];
    }
  }

  // Create a new partnership
  static async createPartnership(data: Omit<Partnership, 'id'>): Promise<string> {
    if (isDevMode()) {
      const mockId = `mock-partnership-${Date.now()}`;
      console.log(`[DEV MODE] Simulating creation of partnership with ID: ${mockId}`);
      return mockId;
    }
    try {
      const docRef = await addDoc(collection(db, COLLECTIONS.PARTNERSHIPS || 'partnerships'), {
        ...data,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
      return docRef.id;
    } catch (error) {
      console.error('Error creating partnership:', error);
      throw error;
    }
  }

  // Update partnership
  static async updatePartnership(id: string, updates: Partial<Partnership>): Promise<void> {
    if (isDevMode()) {
      console.log(`[DEV MODE] Simulating update of partnership ${id}`);
      return;
    }
    try {
      const docRef = doc(db, COLLECTIONS.PARTNERSHIPS || 'partnerships', id);
      await updateDoc(docRef, {
        ...updates,
        updatedAt: Timestamp.now(),
      });
    } catch (error) {
      console.error('Error updating partnership:', error);
      throw error;
    }
  }

  // Delete partnership
  static async deletePartnership(id: string): Promise<void> {
    if (isDevMode()) {
      console.log(`[DEV MODE] Simulating deletion of partnership ${id}`);
      return;
    }
    try {
      const docRef = doc(db, COLLECTIONS.PARTNERSHIPS || 'partnerships', id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Error deleting partnership:', error);
      throw error;
    }
  }
}
