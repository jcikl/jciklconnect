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
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/constants';
import { isDevMode } from '../utils/devMode';
import { toDate } from '../utils/dateUtils';

export interface Advertisement {
  id?: string;
  title: string;
  description: string;
  type: 'Banner' | 'Newsletter' | 'Event Sponsorship' | 'Social Media' | 'Website';
  placement: 'Homepage' | 'Events Page' | 'Newsletter Header' | 'Newsletter Footer' | 'Sidebar' | 'Popup';
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
  createdAt: Date | Timestamp;
  updatedAt: Date | Timestamp;
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

export class AdvertisementService {
  // Get all advertisements
  static async getAllAdvertisements(): Promise<Advertisement[]> {
    if (isDevMode()) {
      return [
        {
          id: 'ad1',
          title: 'Tech Solutions Inc.',
          description: 'Premium IT services for JCI members',
          type: 'Banner',
          placement: 'Homepage',
          targetAudience: 'All Members',
          imageUrl: 'https://via.placeholder.com/728x90',
          linkUrl: 'https://example.com',
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-12-31'),
          status: 'Active',
          impressions: 1250,
          clicks: 45,
          priority: 5,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
      ];
    }

    try {
      const snapshot = await getDocs(
        query(collection(db, COLLECTIONS.ADVERTISEMENTS || 'advertisements'), orderBy('priority', 'desc'), orderBy('createdAt', 'desc'))
      );
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        startDate: doc.data().startDate?.toDate?.() || doc.data().startDate,
        endDate: doc.data().endDate?.toDate?.() || doc.data().endDate,
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
      })) as Advertisement[];
    } catch (error) {
      console.error('Error fetching advertisements:', error);
      throw error;
    }
  }

  // Get active advertisements for placement
  static async getActiveAdvertisements(placement: Advertisement['placement']): Promise<Advertisement[]> {
    try {
      const now = new Date();
      const allAds = await this.getAllAdvertisements();

      return allAds.filter(ad => {
        if (ad.placement !== placement) return false;
        if (ad.status !== 'Active') return false;

        const startDate = toDate(ad.startDate);
        if (startDate > now) return false;

        if (ad.endDate) {
          const endDate = toDate(ad.endDate);
          if (endDate < now) return false;
        }

        return true;
      }).sort((a, b) => b.priority - a.priority);
    } catch (error) {
      console.error('Error fetching active advertisements:', error);
      throw error;
    }
  }

  // Record advertisement impression
  static async recordImpression(adId: string): Promise<void> {
    try {
      const adRef = doc(db, COLLECTIONS.ADVERTISEMENTS || 'advertisements', adId);
      const adDoc = await getDoc(adRef);

      if (adDoc.exists()) {
        const currentImpressions = adDoc.data().impressions || 0;
        await updateDoc(adRef, {
          impressions: currentImpressions + 1,
          updatedAt: Timestamp.now(),
        });
      }
    } catch (error) {
      console.error('Error recording impression:', error);
      // Don't throw - this is a non-critical operation
    }
  }

  // Record advertisement click
  static async recordClick(adId: string): Promise<void> {
    try {
      const adRef = doc(db, COLLECTIONS.ADVERTISEMENTS || 'advertisements', adId);
      const adDoc = await getDoc(adRef);

      if (adDoc.exists()) {
        const currentClicks = adDoc.data().clicks || 0;
        await updateDoc(adRef, {
          clicks: currentClicks + 1,
          updatedAt: Timestamp.now(),
        });
      }
    } catch (error) {
      console.error('Error recording click:', error);
      // Don't throw - this is a non-critical operation
    }
  }

  // Create advertisement
  static async createAdvertisement(adData: Omit<Advertisement, 'id' | 'createdAt' | 'updatedAt' | 'impressions' | 'clicks'>): Promise<string> {
    if (isDevMode()) {
      const mockId = `mock-ad-${Date.now()}`;
      console.log(`[DEV MODE] Simulating creation of advertisement with ID: ${mockId}`);
      return mockId;
    }
    try {
      const newAd: any = {
        title: adData.title,
        description: adData.description,
        type: adData.type,
        placement: adData.placement,
        impressions: 0,
        clicks: 0,
        startDate: Timestamp.fromDate(toDate(adData.startDate)),
        endDate: adData.endDate ? Timestamp.fromDate(toDate(adData.endDate)) : null,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      // Only include optional fields if they are defined
      if (adData.imageUrl !== undefined) newAd.imageUrl = adData.imageUrl;
      if (adData.linkUrl !== undefined) newAd.linkUrl = adData.linkUrl;
      if (adData.budget !== undefined) newAd.budget = adData.budget;
      if (adData.targetAudience !== undefined) newAd.targetAudience = adData.targetAudience;
      if (adData.targetCriteria !== undefined) newAd.targetCriteria = adData.targetCriteria;
      if (adData.status !== undefined) newAd.status = adData.status;

      const docRef = await addDoc(collection(db, COLLECTIONS.ADVERTISEMENTS || 'advertisements'), newAd);
      return docRef.id;
    } catch (error) {
      console.error('Error creating advertisement:', error);
      throw error;
    }
  }

  // Update advertisement
  static async updateAdvertisement(adId: string, updates: Partial<Advertisement>): Promise<void> {
    if (isDevMode()) {
      console.log(`[DEV MODE] Simulating update of advertisement ${adId} with updates:`, updates);
      return;
    }
    try {
      const adRef = doc(db, COLLECTIONS.ADVERTISEMENTS || 'advertisements', adId);
      const updateData: any = {
        updatedAt: Timestamp.now(),
      };

      // Only include defined fields
      if (updates.title !== undefined) updateData.title = updates.title;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.type !== undefined) updateData.type = updates.type;
      if (updates.placement !== undefined) updateData.placement = updates.placement;
      if (updates.imageUrl !== undefined) updateData.imageUrl = updates.imageUrl;
      if (updates.linkUrl !== undefined) updateData.linkUrl = updates.linkUrl;
      if (updates.budget !== undefined) updateData.budget = updates.budget;
      if (updates.targetAudience !== undefined) updateData.targetAudience = updates.targetAudience;
      if (updates.targetCriteria !== undefined) updateData.targetCriteria = updates.targetCriteria;
      if (updates.status !== undefined) updateData.status = updates.status;

      if (updates.startDate) {
        updateData.startDate = Timestamp.fromDate(toDate(updates.startDate));
      }
      if (updates.endDate) {
        updateData.endDate = Timestamp.fromDate(toDate(updates.endDate));
      }

      await updateDoc(adRef, updateData);
    } catch (error) {
      console.error('Error updating advertisement:', error);
      throw error;
    }
  }

  // Delete advertisement
  static async deleteAdvertisement(adId: string): Promise<void> {
    if (isDevMode()) {
      console.log(`[DEV MODE] Simulating deletion of advertisement ${adId}`);
      return;
    }
    try {
      await deleteDoc(doc(db, COLLECTIONS.ADVERTISEMENTS || 'advertisements', adId));
    } catch (error) {
      console.error('Error deleting advertisement:', error);
      throw error;
    }
  }

  // Get promotion packages
  static async getPromotionPackages(): Promise<PromotionPackage[]> {
    if (isDevMode()) {
      console.log('[DEV MODE] Returning mock promotion packages');
      return [];
    }
    try {
      const snapshot = await getDocs(
        query(collection(db, COLLECTIONS.PROMOTION_PACKAGES || 'promotionPackages'), orderBy('price', 'asc'))
      );
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
      })) as PromotionPackage[];
    } catch (error) {
      console.error('Error fetching promotion packages:', error);
      throw error;
    }
  }
}

