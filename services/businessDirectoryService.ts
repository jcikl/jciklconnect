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
  Timestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/constants';
import { BusinessProfile } from '../types';
import { isDevMode } from '../utils/devMode';
import { MOCK_BUSINESSES } from './mockData';

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
    if (isDevMode()) return;

    const profile = mapMemberToBusinessProfile(memberId, data);
    const listingRef = doc(db, COLLECTIONS.PUBLIC_BUSINESS_LISTINGS, memberId);

    if (!profile) {
      try {
        await deleteDoc(listingRef);
      } catch {
        // Listing may not exist yet.
      }
      return;
    }

    await setDoc(listingRef, { ...profile, memberId, updatedAt: Timestamp.now() }, { merge: true });
  }

  static async getAllBusinesses(): Promise<BusinessProfile[]> {
    if (isDevMode()) {
      return MOCK_BUSINESSES;
    }

    try {
      // Read directly from members collection so all members with a companyName
      // are included — not just those synced to the PUBLIC_BUSINESS_LISTINGS cache.
      const snapshot = await getDocs(collection(db, COLLECTIONS.MEMBERS));
      return snapshot.docs
        .map((docSnap) => mapMemberToBusinessProfile(docSnap.id, docSnap.data() as Record<string, unknown>))
        .filter((profile): profile is BusinessProfile => profile !== null)
        .sort((a, b) => a.companyName.localeCompare(b.companyName));
    } catch (error) {
      console.error('Error fetching business profiles:', error);
      throw error;
    }
  }

  static async getBusinessById(businessId: string): Promise<BusinessProfile | null> {
    if (isDevMode()) {
      return MOCK_BUSINESSES.find((b) => b.id === businessId) || null;
    }

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
      console.error('Error fetching business profile:', error);
      throw error;
    }
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
      console.error('Error fetching businesses by industry:', error);
      throw error;
    }
  }
}
