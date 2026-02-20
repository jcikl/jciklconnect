// Business Directory Service - CRUD Operations
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
import { BusinessProfile } from '../types';
import { isDevMode } from '../utils/devMode';
import { MOCK_BUSINESSES } from './mockData';

export class BusinessDirectoryService {
  // Aggregate business profiles from Members
  static async getAllBusinesses(): Promise<BusinessProfile[]> {
    if (isDevMode()) {
      return MOCK_BUSINESSES;
    }

    try {
      // Query members who have a company name
      const q = query(collection(db, COLLECTIONS.MEMBERS), orderBy('companyName', 'asc'));
      const snapshot = await getDocs(q);

      const businesses: BusinessProfile[] = [];

      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.companyName) {
          businesses.push({
            id: doc.id,
            memberId: doc.id,
            companyName: data.companyName,
            industry: data.industry || 'Other',
            description: data.companyDescription || '',
            website: data.companyWebsite || '',
            offer: data.specialOffer || '',
            logo: data.companyLogoUrl || '',
            internationalConnections: data.internationalConnections || [],
            // Map other fields if necessary
          });
        }
      });

      return businesses;
    } catch (error) {
      console.error('Error fetching business profiles:', error);
      throw error;
    }
  }

  // Get business by ID (which is member ID in this aggregation model)
  static async getBusinessById(businessId: string): Promise<BusinessProfile | null> {
    try {
      const docRef = doc(db, COLLECTIONS.MEMBERS, businessId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.companyName) {
          return {
            id: docSnap.id,
            memberId: docSnap.id,
            companyName: data.companyName,
            industry: data.industry || 'Other',
            description: data.companyDescription || '',
            website: data.companyWebsite || '',
            offer: data.specialOffer || '',
            logo: data.companyLogoUrl || '',
            internationalConnections: data.internationalConnections || [],
          };
        }
      }
      return null;
    } catch (error) {
      console.error('Error fetching business profile:', error);
      throw error;
    }
  }

  // Search businesses
  static async searchBusinesses(searchTerm: string): Promise<BusinessProfile[]> {
    try {
      const allBusinesses = await this.getAllBusinesses();
      const lowerSearchTerm = searchTerm.toLowerCase();

      return allBusinesses.filter(business =>
        business.companyName.toLowerCase().includes(lowerSearchTerm) ||
        business.industry.toLowerCase().includes(lowerSearchTerm) ||
        business.description?.toLowerCase().includes(lowerSearchTerm)
      );
    } catch (error) {
      console.error('Error searching businesses:', error);
      throw error;
    }
  }

  // Get businesses by industry
  static async getBusinessesByIndustry(industry: string): Promise<BusinessProfile[]> {
    try {
      // Note: This relies on exact string match. Search might be better for partials.
      const q = query(
        collection(db, COLLECTIONS.MEMBERS),
        where('industry', '==', industry),
        orderBy('companyName', 'asc')
      );

      const snapshot = await getDocs(q);
      const businesses: BusinessProfile[] = [];

      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.companyName) {
          businesses.push({
            id: doc.id,
            memberId: doc.id,
            companyName: data.companyName,
            industry: data.industry || 'Other',
            description: data.companyDescription || '',
            website: data.companyWebsite || '',
            offer: data.specialOffer || '',
            logo: data.companyLogoUrl || '',
            internationalConnections: data.internationalConnections || [],
          });
        }
      });

      return businesses;
    } catch (error) {
      console.error('Error fetching businesses by industry:', error);
      throw error;
    }
  }
}

