// Event Feedback Service - Collects and manages event feedback
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/constants';
import { isDevMode } from '../utils/devMode';

export interface EventFeedback {
  id?: string;
  eventId: string;
  memberId: string;
  rating: number; // 1-5
  overallSatisfaction: number; // 1-5
  contentQuality?: number; // 1-5
  organization?: number; // 1-5
  venue?: number; // 1-5
  comments?: string;
  wouldRecommend?: boolean;
  suggestions?: string;
  submittedAt: Date | Timestamp;
}

export interface EventFeedbackSummary {
  eventId: string;
  totalResponses: number;
  averageRating: number;
  averageSatisfaction: number;
  averageContentQuality?: number;
  averageOrganization?: number;
  averageVenue?: number;
  recommendationRate: number; // percentage
  commonThemes: string[];
  feedbacks: EventFeedback[];
}

export class EventFeedbackService {
  // Submit feedback for an event
  static async submitFeedback(feedback: Omit<EventFeedback, 'id' | 'submittedAt'>): Promise<string> {
    if (isDevMode()) {
      console.log('[Dev Mode] Would submit feedback:', feedback);
      return 'mock-feedback-id';
    }

    try {
      const feedbackData = {
        ...feedback,
        submittedAt: Timestamp.now(),
      };

      const docRef = await addDoc(collection(db, COLLECTIONS.EVENT_FEEDBACK || 'eventFeedback'), feedbackData);
      return docRef.id;
    } catch (error) {
      console.error('Error submitting feedback:', error);
      throw error;
    }
  }

  // Get feedback for a specific event
  static async getEventFeedback(eventId: string): Promise<EventFeedback[]> {
    if (isDevMode()) {
      return [];
    }

    try {
      const snapshot = await getDocs(
        query(
          collection(db, COLLECTIONS.EVENT_FEEDBACK || 'eventFeedback'),
          where('eventId', '==', eventId)
        )
      );

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        submittedAt: doc.data().submittedAt?.toDate?.() || doc.data().submittedAt,
      } as EventFeedback));
    } catch (error) {
      console.error('Error fetching event feedback:', error);
      throw error;
    }
  }

  // Get feedback summary for an event
  static async getFeedbackSummary(eventId: string): Promise<EventFeedbackSummary> {
    try {
      const feedbacks = await this.getEventFeedback(eventId);

      if (feedbacks.length === 0) {
        return {
          eventId,
          totalResponses: 0,
          averageRating: 0,
          averageSatisfaction: 0,
          recommendationRate: 0,
          commonThemes: [],
          feedbacks: [],
        };
      }

      const totalResponses = feedbacks.length;
      const averageRating = feedbacks.reduce((sum, f) => sum + f.rating, 0) / totalResponses;
      const averageSatisfaction = feedbacks.reduce((sum, f) => sum + f.overallSatisfaction, 0) / totalResponses;
      
      const contentQualityFeedbacks = feedbacks.filter(f => f.contentQuality);
      const averageContentQuality = contentQualityFeedbacks.length > 0
        ? contentQualityFeedbacks.reduce((sum, f) => sum + (f.contentQuality || 0), 0) / contentQualityFeedbacks.length
        : undefined;

      const organizationFeedbacks = feedbacks.filter(f => f.organization);
      const averageOrganization = organizationFeedbacks.length > 0
        ? organizationFeedbacks.reduce((sum, f) => sum + (f.organization || 0), 0) / organizationFeedbacks.length
        : undefined;

      const venueFeedbacks = feedbacks.filter(f => f.venue);
      const averageVenue = venueFeedbacks.length > 0
        ? venueFeedbacks.reduce((sum, f) => sum + (f.venue || 0), 0) / venueFeedbacks.length
        : undefined;

      const wouldRecommendCount = feedbacks.filter(f => f.wouldRecommend === true).length;
      const recommendationRate = (wouldRecommendCount / totalResponses) * 100;

      // Extract common themes from comments (simple keyword extraction)
      const allComments = feedbacks
        .filter(f => f.comments)
        .map(f => f.comments?.toLowerCase() || '');
      
      const commonThemes: string[] = [];
      const keywords = ['great', 'good', 'excellent', 'improve', 'better', 'enjoyed', 'helpful', 'organized'];
      keywords.forEach(keyword => {
        const count = allComments.filter(c => c.includes(keyword)).length;
        if (count >= totalResponses * 0.2) { // Mentioned by at least 20% of respondents
          commonThemes.push(keyword);
        }
      });

      return {
        eventId,
        totalResponses,
        averageRating: Math.round(averageRating * 10) / 10,
        averageSatisfaction: Math.round(averageSatisfaction * 10) / 10,
        averageContentQuality: averageContentQuality ? Math.round(averageContentQuality * 10) / 10 : undefined,
        averageOrganization: averageOrganization ? Math.round(averageOrganization * 10) / 10 : undefined,
        averageVenue: averageVenue ? Math.round(averageVenue * 10) / 10 : undefined,
        recommendationRate: Math.round(recommendationRate * 10) / 10,
        commonThemes,
        feedbacks,
      };
    } catch (error) {
      console.error('Error getting feedback summary:', error);
      throw error;
    }
  }

  // Check if member has already submitted feedback
  static async hasMemberSubmittedFeedback(eventId: string, memberId: string): Promise<boolean> {
    if (isDevMode()) {
      return false;
    }

    try {
      const snapshot = await getDocs(
        query(
          collection(db, COLLECTIONS.EVENT_FEEDBACK || 'eventFeedback'),
          where('eventId', '==', eventId),
          where('memberId', '==', memberId)
        )
      );

      return !snapshot.empty;
    } catch (error) {
      console.error('Error checking feedback submission:', error);
      return false;
    }
  }
}

