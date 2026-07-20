// Business Directory Service - CRUD Operations
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/constants';
import { BusinessProfile } from '../types';
import { withDevMode } from '../utils/devMode';
import { MOCK_BUSINESSES } from './mockData';
import { MembersService } from './membersService';
import { apiCache } from './cacheService';
import { errorLoggingService } from './errorLoggingService';

const CACHE_KEY_ALL_PUBLIC = 'businessDirectory:public:all';
const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes

function invalidateBusinessDirectoryCache(): void {
  apiCache.delete(CACHE_KEY_ALL_PUBLIC);
}

function cacheKeyById(id: string): string {
  return `businessDirectory:byId:${id}`;
}

export function mapMemberToBusinessProfile(id: string, data: Record<string, unknown>): BusinessProfile | null {
  const business = (data.business ?? {}) as Record<string, unknown>;
  const general = (data.general ?? {}) as Record<string, unknown>;
  const companyName =
    (data.companyName as string | undefined) ||
    (business.companyName as string | undefined);

  if (!companyName?.trim()) {
    return null;
  }

  const businessCategory = data.businessCategory ?? business.businessCategory;

  return {
    id,
    memberId: id,
    ownerName:
      (data.name as string | undefined) ||
      (general.name as string | undefined) ||
      (general.fullName as string | undefined) ||
      'Unknown',
    companyName,
    industry: (data.industry as string | undefined) || (business.industry as string | undefined) || 'Other',
    description:
      ((data.business as Record<string, unknown> | undefined)?.companyDescription as string | undefined) ||
      (data.companyDescription as string | undefined) ||
      (business.introduction as string | undefined) ||
      '',
    website:
      (data.companyWebsite as string | undefined) ||
      (business.companyWebsite as string | undefined) ||
      '',
    offer:
      (data.specialOffer as string | undefined) ||
      (business.specialOffer as string | undefined) ||
      '',
    logo:
      (data.companyLogoUrl as string | undefined) ||
      (business.companyLogoUrl as string | undefined) ||
      '',
    internationalConnections: (data.internationalConnections as BusinessProfile['internationalConnections']) || [],
    businessCategory: Array.isArray(businessCategory) ? businessCategory.join(', ') : ((businessCategory as string) || ''),
    acceptsInternationalBusiness:
      (data.acceptInternationalBusiness as boolean | undefined) ??
      (business.acceptInternationalBusiness as boolean | undefined) ??
      false,
    globalNetworkEnabled: (data.globalNetworkEnabled as boolean | undefined) || false,
    internationalPartnershipTypes: (data.internationalPartnershipTypes as BusinessProfile['internationalPartnershipTypes']) || [],
  };
}

function mapListingDoc(id: string, data: Record<string, unknown>): BusinessProfile {
  return {
    id,
    memberId: (data.memberId as string | undefined) || id,
    ownerName: (data.ownerName as string | undefined) || 'Unknown',
    companyName: (data.companyName as string | undefined) || '',
    industry: (data.industry as string | undefined) || 'Other',
    description: (data.description as string | undefined) || '',
    website: (data.website as string | undefined) || '',
    offer: (data.offer as string | undefined) || '',
    logo: (data.logo as string | undefined) || '',
    internationalConnections: (data.internationalConnections as BusinessProfile['internationalConnections']) || [],
    businessCategory: (data.businessCategory as string | undefined) || '',
    acceptsInternationalBusiness: (data.acceptsInternationalBusiness as boolean | undefined) || false,
    globalNetworkEnabled: (data.globalNetworkEnabled as boolean | undefined) || false,
    internationalPartnershipTypes: (data.internationalPartnershipTypes as BusinessProfile['internationalPartnershipTypes']) || [],
  };
}

export class BusinessDirectoryService {
  static async syncPublicListing(memberId: string, data: Record<string, unknown>): Promise<void> {
    return withDevMode(
      () => {},
      async () => {
        const profile = mapMemberToBusinessProfile(memberId, data);
        const listingRef = doc(db, COLLECTIONS.PUBLIC_BUSINESS_LISTINGS, memberId);

        try {
          if (!profile) {
            try {
              await deleteDoc(listingRef);
            } catch {
              // Listing may not exist yet — deletion is best-effort.
            }
          } else {
            await setDoc(listingRef, { ...profile, memberId, updatedAt: Timestamp.now() }, { merge: true });
          }
          // Invalidate caches so next read reflects the update immediately.
          invalidateBusinessDirectoryCache();
          apiCache.delete(cacheKeyById(memberId));
        } catch (error) {
          errorLoggingService.logError(error as Error, {
            component: 'BusinessDirectoryService',
            action: 'syncPublicListing',
            additionalData: { memberId },
          });
          // Re-throw so callers can decide whether to surface a warning.
          throw error;
        }
      }
    );
  }

  static async getAllBusinesses(publicOnly = false): Promise<BusinessProfile[]> {
    return withDevMode(
      () => MOCK_BUSINESSES,
      async () => {
        if (publicOnly) {
          // Unauthenticated path: read from the public denormalised collection (cached).
          return apiCache.getOrSet(CACHE_KEY_ALL_PUBLIC, async () => {
            try {
              const snapshot = await getDocs(
                query(
                  collection(db, COLLECTIONS.PUBLIC_BUSINESS_LISTINGS),
                  orderBy('companyName'),
                  limit(200)
                )
              );
              return snapshot.docs
                .map((docSnap) => mapListingDoc(docSnap.id, docSnap.data() as Record<string, unknown>))
                .filter((p) => p.companyName?.trim());
            } catch (error) {
              errorLoggingService.logError(error as Error, {
                component: 'BusinessDirectoryService',
                action: 'getAllBusinesses:public',
              });
              throw error;
            }
          }, CACHE_TTL_MS);
        }

        try {
          // Authenticated path: MembersService already caches internally.
          const members = await MembersService.getAllMembers();
          return members
            .map((m) => mapMemberToBusinessProfile(m.id, m as unknown as Record<string, unknown>))
            .filter((profile): profile is BusinessProfile => profile !== null)
            .sort((a, b) => a.companyName.localeCompare(b.companyName));
        } catch (error) {
          errorLoggingService.logError(error as Error, {
            component: 'BusinessDirectoryService',
            action: 'getAllBusinesses:authenticated',
          });
          throw error;
        }
      }
    );
  }

  static async getBusinessById(businessId: string): Promise<BusinessProfile | null> {
    return withDevMode(
      () => MOCK_BUSINESSES.find((b) => b.id === businessId) || null,
      async () => {
        const key = cacheKeyById(businessId);
        return apiCache.getOrSet(key, async () => {
          try {
            const listingSnap = await getDoc(doc(db, COLLECTIONS.PUBLIC_BUSINESS_LISTINGS, businessId));
            if (listingSnap.exists()) {
              return mapListingDoc(listingSnap.id, listingSnap.data());
            }

            const memberSnap = await getDoc(doc(db, COLLECTIONS.MEMBERS, businessId));
            if (memberSnap.exists()) {
              return mapMemberToBusinessProfile(memberSnap.id, memberSnap.data());
            }
            return null;
          } catch (error) {
            errorLoggingService.logError(error as Error, {
              component: 'BusinessDirectoryService',
              action: 'getBusinessById',
              additionalData: { businessId },
            });
            throw error;
          }
        }, CACHE_TTL_MS);
      }
    );
  }

  static async searchBusinesses(searchTerm: string): Promise<BusinessProfile[]> {
    const allBusinesses = await this.getAllBusinesses();
    const lowerSearchTerm = searchTerm.toLowerCase();
    return allBusinesses.filter(business =>
      business.companyName.toLowerCase().includes(lowerSearchTerm) ||
      business.industry.toLowerCase().includes(lowerSearchTerm) ||
      business.description?.toLowerCase().includes(lowerSearchTerm)
    );
  }

  static async getBusinessesByIndustry(industry: string): Promise<BusinessProfile[]> {
    try {
      const q = query(
        collection(db, COLLECTIONS.PUBLIC_BUSINESS_LISTINGS),
        where('industry', '==', industry),
        orderBy('companyName', 'asc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map((docSnap) => mapListingDoc(docSnap.id, docSnap.data()));
    } catch (error) {
      errorLoggingService.logError(error instanceof Error ? error : new Error(String(error)), { context: 'BusinessDirectoryService.getBusinessesByIndustry', industry });
      throw error;
    }
  }
}
