// Advertisement & Promotions Service
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
  increment,
  QueryDocumentSnapshot,
  DocumentData,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/constants';
import { withDevMode } from '../utils/devMode';
import { toDate } from '../utils/dateUtils';
import { apiCache } from './cacheService';
import { errorLoggingService } from './errorLoggingService';

export interface Advertisement {
  id?: string;
  title: string;
  description: string;
  type: 'Banner' | 'Newsletter' | 'Event Sponsorship' | 'Social Media' | 'Website';
  placement: ('Homepage' | 'Events Page' | 'Newsletter Header' | 'Newsletter Footer' | 'Sidebar' | 'Popup')[];
  targetAudience?: 'All Members' | 'Specific Tier' | 'Specific Role' | 'Custom';
  targetCriteria?: {
    tiers?: string[];
    roles?: string[];
    memberIds?: string[];
  };
  businessProfileId?: string; // Link to business directory
  imageUrl: string;
  linkUrl?: string;
  startDate: Date | Timestamp | string;
  endDate?: Date | Timestamp | string;
  status: 'Active' | 'Scheduled' | 'Expired' | 'Paused';
  impressions: number;
  clicks: number;
  priority: number; // Higher number = higher priority
  budget?: number;
  costPerImpression?: number;
  costPerClick?: number;
  provider?: string;
  logoUrl?: string;
  usageLimit?: number;
  termsAndConditions?: string;
  createdAt: Date | Timestamp;
  updatedAt: Date | Timestamp;
}

export interface BenefitUsage {
  id?: string;
  benefitId: string;
  memberId: string;
  usedAt: Date | Timestamp | string;
  details?: string;
}

export interface PromotionPackage {
  id?: string;
  name: string;
  description: string;
  price: number;
  duration: number; // in days
  features: string[];
  includes: {
    bannerSlots?: number;
    newsletterMentions?: number;
    eventSponsorships?: number;
    socialMediaPosts?: number;
  };
  status: 'Active' | 'Inactive';
  createdAt: Date | Timestamp;
  updatedAt: Date | Timestamp;
}

const MOCK_AD: Advertisement = {
  id: 'ad1',
  title: 'Tech Solutions Inc.',
  description: 'Premium IT services for JCI members',
  type: 'Banner',
  placement: ['Homepage'],
  targetAudience: 'All Members',
  imageUrl: 'https://via.placeholder.com/728x90',
  linkUrl: 'https://example.com',
  startDate: new Date('2024-01-01'),
  endDate: new Date('2099-12-31'),
  status: 'Active',
  impressions: 1250,
  clicks: 45,
  priority: 5,
  costPerImpression: 0,
  costPerClick: 0,
  provider: 'Mock',
  usageLimit: 0,
  termsAndConditions: '',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const COLL = COLLECTIONS.ADVERTISEMENTS || 'advertisements';
const CACHE_TTL = 3 * 60 * 1000; // 3 minutes
const CACHE_KEY_ALL = 'ads:all';
const CACHE_KEY_ACTIVE_PREFIX = 'ads:active:';
const CACHE_KEY_PACKAGES = 'pkgs:promotionPackages';

function mapDoc(docSnap: QueryDocumentSnapshot<DocumentData>): Advertisement {
  const d = docSnap.data();
  return {
    id: docSnap.id,
    ...d,
    startDate: d.startDate?.toDate?.() || d.startDate,
    endDate: d.endDate?.toDate?.() || d.endDate,
    createdAt: d.createdAt?.toDate() || new Date(),
    updatedAt: d.updatedAt?.toDate() || new Date(),
  } as Advertisement;
}

export class AdvertisementService {
  // ── Cache helpers ──────────────────────────────────────────────────────────
  static invalidateAdsCache(): void {
    apiCache.deleteByPrefix('ads:');
  }

  static invalidatePackagesCache(): void {
    apiCache.deleteByPrefix('pkgs:');
  }

  // ── Get all advertisements ─────────────────────────────────────────────────
  static async getAllAdvertisements(): Promise<Advertisement[]> {
    return withDevMode(
      () => [MOCK_AD],
      () =>
        apiCache.getOrSet<Advertisement[]>(
          CACHE_KEY_ALL,
          async () => {
            try {
              const snapshot = await getDocs(query(collection(db, COLL)));
              const ads = snapshot.docs.map(mapDoc);
              return ads.sort((a, b) => {
                if (a.priority !== b.priority) return (b.priority || 0) - (a.priority || 0);
                const aDate = a.createdAt instanceof Date ? a.createdAt : new Date();
                const bDate = b.createdAt instanceof Date ? b.createdAt : new Date();
                return bDate.getTime() - aDate.getTime();
              });
            } catch (error) {
              errorLoggingService.logError(error as Error, { action: 'AdvertisementService.getAllAdvertisements' });
              throw error;
            }
          },
          CACHE_TTL,
          'AdvertisementService.getAllAdvertisements'
        )
    );
  }

  // ── Get active advertisements for a placement ──────────────────────────────
  static async getActiveAdvertisements(placement: string): Promise<Advertisement[]> {
    return withDevMode(
      () => [MOCK_AD],
      () => {
        const cacheKey = `${CACHE_KEY_ACTIVE_PREFIX}${placement}`;
        return apiCache.getOrSet<Advertisement[]>(
          cacheKey,
          async () => {
            try {
              const now = new Date();
              const q = query(collection(db, COLL), where('status', '==', 'Active'));
              const snapshot = await getDocs(q);
              const ads = snapshot.docs.map(mapDoc);

              const activeAds: Advertisement[] = [];
              for (const ad of ads) {
                const placements = Array.isArray(ad.placement) ? ad.placement : [ad.placement];
                if (!placements.includes(placement as any)) continue;

                const startDate = toDate(ad.startDate);
                if (startDate > now) continue;

                if (ad.endDate) {
                  const endDate = toDate(ad.endDate);
                  if (endDate < now) {
                    // Fire-and-forget: mark expired ads so future queries are cleaner
                    updateDoc(doc(db, COLL, ad.id!), {
                      status: 'Expired',
                      updatedAt: Timestamp.now(),
                    })
                      .then(() => this.invalidateAdsCache())
                      .catch(err => errorLoggingService.logWarning('广告副作用失败', { action: 'ad-side-effect', additionalData: { error: (err as Error)?.message } }));
                    continue;
                  }
                }

                activeAds.push(ad);
              }

              return activeAds.sort((a, b) => (b.priority || 0) - (a.priority || 0));
            } catch (error) {
              errorLoggingService.logError(error as Error, { action: 'AdvertisementService.getActiveAdvertisements', additionalData: { placement } });
              throw error;
            }
          },
          CACHE_TTL,
          'AdvertisementService.getActiveAdvertisements'
        );
      }
    );
  }

  // ── Record impression (fire-and-forget, no cache clear needed) ─────────────
  static async recordImpression(adId: string): Promise<void> {
    return withDevMode(
      () => {},
      async () => {
        try {
          const adRef = doc(db, COLL, adId);
          await updateDoc(adRef, { impressions: increment(1), updatedAt: Timestamp.now() });
        } catch (error) {
          // Metrics are best-effort; do not surface to user but do log
          errorLoggingService.logError(error as Error, { action: 'AdvertisementService.recordImpression', additionalData: { adId } });
        }
      }
    );
  }

  // ── Record click (fire-and-forget, no cache clear needed) ──────────────────
  static async recordClick(adId: string): Promise<void> {
    return withDevMode(
      () => {},
      async () => {
        try {
          const adRef = doc(db, COLL, adId);
          await updateDoc(adRef, { clicks: increment(1), updatedAt: Timestamp.now() });
        } catch (error) {
          errorLoggingService.logError(error as Error, { action: 'AdvertisementService.recordClick', additionalData: { adId } });
        }
      }
    );
  }

  // ── Create advertisement ───────────────────────────────────────────────────
  // FIX P1: all Advertisement fields are now written explicitly, defaulting to
  // null/0/'' when caller does not supply them, so no field is ever silently omitted.
  static async createAdvertisement(
    adData: Omit<Advertisement, 'id' | 'createdAt' | 'updatedAt' | 'impressions' | 'clicks'>
  ): Promise<string> {
    return withDevMode(
      () => `mock-ad-${Date.now()}`,
      async () => {
        try {
          const newAd = {
            title: adData.title,
            description: adData.description,
            type: adData.type,
            placement: adData.placement,
            imageUrl: adData.imageUrl ?? '',
            logoUrl: adData.logoUrl ?? null,
            linkUrl: adData.linkUrl ?? null,
            targetAudience: adData.targetAudience ?? null,
            targetCriteria: adData.targetCriteria ?? null,
            businessProfileId: adData.businessProfileId ?? null,
            status: adData.status ?? 'Scheduled',
            priority: adData.priority ?? 0,
            budget: adData.budget ?? null,
            costPerImpression: adData.costPerImpression ?? null,
            costPerClick: adData.costPerClick ?? null,
            provider: adData.provider ?? null,
            usageLimit: adData.usageLimit ?? null,
            termsAndConditions: adData.termsAndConditions ?? null,
            impressions: 0,
            clicks: 0,
            startDate: Timestamp.fromDate(toDate(adData.startDate)),
            endDate: adData.endDate ? Timestamp.fromDate(toDate(adData.endDate)) : null,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
          };

          const docRef = await addDoc(collection(db, COLL), newAd);
          this.invalidateAdsCache();
          return docRef.id;
        } catch (error) {
          errorLoggingService.logError(error as Error, { action: 'AdvertisementService.createAdvertisement' });
          throw error;
        }
      }
    );
  }

  // ── Update advertisement ───────────────────────────────────────────────────
  static async updateAdvertisement(adId: string, updates: Partial<Advertisement>): Promise<void> {
    return withDevMode(
      () => {},
      async () => {
        try {
          const adRef = doc(db, COLL, adId);
          const updateData: any = { updatedAt: Timestamp.now() };

          if (updates.title !== undefined) updateData.title = updates.title;
          if (updates.description !== undefined) updateData.description = updates.description;
          if (updates.type !== undefined) updateData.type = updates.type;
          if (updates.placement !== undefined) updateData.placement = updates.placement;
          if (updates.imageUrl !== undefined) updateData.imageUrl = updates.imageUrl;
          if (updates.logoUrl !== undefined) updateData.logoUrl = updates.logoUrl;
          if (updates.linkUrl !== undefined) updateData.linkUrl = updates.linkUrl;
          if (updates.budget !== undefined) updateData.budget = updates.budget;
          if (updates.targetAudience !== undefined) updateData.targetAudience = updates.targetAudience;
          if (updates.targetCriteria !== undefined) updateData.targetCriteria = updates.targetCriteria;
          if (updates.status !== undefined) updateData.status = updates.status;
          if (updates.priority !== undefined) updateData.priority = updates.priority;
          if (updates.costPerImpression !== undefined) updateData.costPerImpression = updates.costPerImpression;
          if (updates.costPerClick !== undefined) updateData.costPerClick = updates.costPerClick;
          if (updates.provider !== undefined) updateData.provider = updates.provider;
          if (updates.usageLimit !== undefined) updateData.usageLimit = updates.usageLimit;
          if (updates.termsAndConditions !== undefined) updateData.termsAndConditions = updates.termsAndConditions;
          if (updates.startDate) updateData.startDate = Timestamp.fromDate(toDate(updates.startDate));
          if (updates.endDate) updateData.endDate = Timestamp.fromDate(toDate(updates.endDate));

          await updateDoc(adRef, updateData);
          this.invalidateAdsCache();
        } catch (error) {
          errorLoggingService.logError(error as Error, { action: 'AdvertisementService.updateAdvertisement', additionalData: { adId } });
          throw error;
        }
      }
    );
  }

  // ── Delete advertisement ───────────────────────────────────────────────────
  static async deleteAdvertisement(adId: string): Promise<void> {
    return withDevMode(
      () => {},
      async () => {
        try {
          await deleteDoc(doc(db, COLL, adId));
          this.invalidateAdsCache();
        } catch (error) {
          errorLoggingService.logError(error as Error, { action: 'AdvertisementService.deleteAdvertisement', additionalData: { adId } });
          throw error;
        }
      }
    );
  }

  // ── Get promotion packages ─────────────────────────────────────────────────
  static async getPromotionPackages(): Promise<PromotionPackage[]> {
    return withDevMode(
      () => [],
      () =>
        apiCache.getOrSet<PromotionPackage[]>(
          CACHE_KEY_PACKAGES,
          async () => {
            try {
              const snapshot = await getDocs(
                query(
                  collection(db, COLLECTIONS.PROMOTION_PACKAGES),
                  orderBy('price', 'asc')
                )
              );
              return snapshot.docs.map(d => ({
                id: d.id,
                ...d.data(),
                createdAt: d.data().createdAt?.toDate() || new Date(),
                updatedAt: d.data().updatedAt?.toDate() || new Date(),
              })) as PromotionPackage[];
            } catch (error) {
              errorLoggingService.logError(error as Error, { action: 'AdvertisementService.getPromotionPackages' });
              throw error;
            }
          },
          CACHE_TTL,
          'AdvertisementService.getPromotionPackages'
        )
    );
  }

  // ── Get benefit usage history ──────────────────────────────────────────────
  static async getBenefitUsageHistory(benefitId?: string, memberId?: string): Promise<BenefitUsage[]> {
    return withDevMode(
      () => [],
      async () => {
        try {
          const conditions: any[] = [];
          if (benefitId) conditions.push(where('benefitId', '==', benefitId));
          if (memberId) conditions.push(where('memberId', '==', memberId));

          const q =
            conditions.length > 0
              ? query(
                  collection(db, COLLECTIONS.BENEFIT_USAGE || 'benefitUsage'),
                  ...conditions,
                  orderBy('usedAt', 'desc')
                )
              : query(
                  collection(db, COLLECTIONS.BENEFIT_USAGE || 'benefitUsage'),
                  orderBy('usedAt', 'desc')
                );

          const snapshot = await getDocs(q);
          return snapshot.docs.map(d => ({
            id: d.id,
            ...d.data(),
            usedAt: d.data().usedAt?.toDate?.() || d.data().usedAt,
          })) as BenefitUsage[];
        } catch (error) {
          errorLoggingService.logError(error as Error, { action: 'AdvertisementService.getBenefitUsageHistory' });
          return [];
        }
      }
    );
  }
}
