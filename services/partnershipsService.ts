import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/constants';
import { withDevMode } from '../utils/devMode';
import { Partnership } from '../types';
import { apiCache } from './cacheService';
import { errorLoggingService } from './errorLoggingService';

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

/**
 * Partnership data is stored in the `advertisements` Firestore collection
 * (COLLECTIONS.ADVERTISEMENTS). ALL reads AND writes use this single
 * canonical collection — the old code accidentally wrote to a separate
 * `partnerships` collection that nobody reads, causing created/updated
 * records to be permanently invisible on the user-facing page.
 *
 * FIX P0 (2026-07-17): unified all operations to COLLECTIONS.ADVERTISEMENTS.
 */
const COLL = COLLECTIONS.ADVERTISEMENTS || 'advertisements';
const CACHE_KEY = 'partnerships:all';
const CACHE_TTL = 3 * 60 * 1000; // 3 minutes

export class PartnershipsService {
  static invalidatePartnershipsCache(): void {
    apiCache.deleteByPrefix('partnerships:');
    // Also bust the shared ads cache so AdvertisementService sees changes too
    apiCache.deleteByPrefix('ads:');
  }

  /**
   * Get all partnerships (mapped from the advertisements collection).
   * Active-only filter is applied client-side after the Firestore read
   * because the advertisements collection uses 'Active'/'Inactive' status
   * values that don't map 1:1 to Partnership status without reading all docs.
   */
  static async getAllPartnerships(): Promise<Partnership[]> {
    return withDevMode(
      () => [...MOCK_PARTNERSHIPS],
      () =>
        apiCache.getOrSet<Partnership[]>(
          CACHE_KEY,
          async () => {
            try {
              const snapshot = await getDocs(query(collection(db, COLL)));

              if (snapshot.empty) {
                return [...MOCK_PARTNERSHIPS];
              }

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
                  logo: d.logoUrl || '',
                  banner: d.imageUrl || '',
                  eligbleRoles: d.targetCriteria?.tiers ||
                    d.targetCriteria?.roles || [
                      'probation member', 'official member', 'paid_due_member',
                      'associate member', 'lifetime member',
                    ],
                  status: (d.status === 'Active' ? 'active' : 'inactive') as 'active' | 'inactive',
                };
              });

              return results;
            } catch (error) {
              // Guest users will hit permission-denied — fall back to mock data
              errorLoggingService.logWarning(
                '[PartnershipsService] Cannot read advertisements (falling back to mock data)',
                { additionalData: { error: String(error) } }
              );
              return [...MOCK_PARTNERSHIPS];
            }
          },
          CACHE_TTL,
          'PartnershipsService.getAllPartnerships'
        )
    );
  }

  /**
   * Create a new partnership record.
   * FIX P0: writes to COLLECTIONS.ADVERTISEMENTS (same as getAllPartnerships reads).
   * Maps Partnership fields back to Advertisement document shape.
   */
  static async createPartnership(data: Omit<Partnership, 'id'>): Promise<string> {
    return withDevMode(
      () => {
        const mockId = `mock-partnership-${Date.now()}`;
        console.log(`[DEV MODE] Simulating creation of partnership with ID: ${mockId}`);
        return mockId;
      },
      async () => {
        try {
          const docRef = await addDoc(collection(db, COLL), {
            // Map Partnership → Advertisement fields
            title: data.name,
            description: data.memberBenefits || '',
            linkUrl: data.redeemMethod || null,
            logoUrl: data.logo || null,
            imageUrl: data.banner || null,
            targetCriteria: data.eligbleRoles?.length
              ? { roles: data.eligbleRoles }
              : null,
            status: data.status === 'active' ? 'Active' : 'Inactive',
            type: 'Banner', // default type for partnerships
            placement: ['Homepage'],
            impressions: 0,
            clicks: 0,
            priority: 0,
            startDate: data.period?.startDate
              ? Timestamp.fromDate(new Date(data.period.startDate))
              : Timestamp.now(),
            endDate: data.period?.endDate
              ? Timestamp.fromDate(new Date(data.period.endDate))
              : null,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
          });
          this.invalidatePartnershipsCache();
          return docRef.id;
        } catch (error) {
          errorLoggingService.logError(error as Error, { action: 'PartnershipsService.createPartnership' });
          throw error;
        }
      }
    );
  }

  /**
   * Update an existing partnership.
   * FIX P0: updates COLLECTIONS.ADVERTISEMENTS (same collection as reads).
   */
  static async updatePartnership(id: string, updates: Partial<Partnership>): Promise<void> {
    return withDevMode(
      () => { console.log(`[DEV MODE] Simulating update of partnership ${id}`); },
      async () => {
        try {
          const updateData: any = { updatedAt: Timestamp.now() };
          if (updates.name !== undefined) updateData.title = updates.name;
          if (updates.memberBenefits !== undefined) updateData.description = updates.memberBenefits;
          if (updates.redeemMethod !== undefined) updateData.linkUrl = updates.redeemMethod;
          if (updates.logo !== undefined) updateData.logoUrl = updates.logo;
          if (updates.banner !== undefined) updateData.imageUrl = updates.banner;
          if (updates.eligbleRoles !== undefined) updateData.targetCriteria = { roles: updates.eligbleRoles };
          if (updates.status !== undefined) updateData.status = updates.status === 'active' ? 'Active' : 'Inactive';
          if (updates.period?.startDate !== undefined)
            updateData.startDate = Timestamp.fromDate(new Date(updates.period.startDate));
          if (updates.period?.endDate !== undefined)
            updateData.endDate = Timestamp.fromDate(new Date(updates.period.endDate));

          const docRef = doc(db, COLL, id);
          await updateDoc(docRef, updateData);
          this.invalidatePartnershipsCache();
        } catch (error) {
          errorLoggingService.logError(error as Error, { action: 'PartnershipsService.updatePartnership', additionalData: { id } });
          throw error;
        }
      }
    );
  }

  /**
   * Delete a partnership.
   * FIX P0: deletes from COLLECTIONS.ADVERTISEMENTS (same collection as reads).
   */
  static async deletePartnership(id: string): Promise<void> {
    return withDevMode(
      () => { console.log(`[DEV MODE] Simulating deletion of partnership ${id}`); },
      async () => {
        try {
          const docRef = doc(db, COLL, id);
          await deleteDoc(docRef);
          this.invalidatePartnershipsCache();
        } catch (error) {
          errorLoggingService.logError(error as Error, { action: 'PartnershipsService.deletePartnership', additionalData: { id } });
          throw error;
        }
      }
    );
  }
}
