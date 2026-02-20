// Surveys Service - CRUD Operations
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
import { MOCK_SURVEYS } from './mockData';
import { removeUndefined } from '../utils/dataUtils';

export interface Survey {
  id: string;
  title: string;
  description: string;
  questions: SurveyQuestion[];
  targetAudience: 'All Members' | 'Board' | 'Project Leads' | 'Specific Group';
  specificMemberIds?: string[]; // For 'Specific Group' audience
  status: 'Draft' | 'Active' | 'Closed';
  startDate: string;
  endDate: string;
  responsesCount: number;
  createdBy: string;
  createdAt: string;
  distributionChannels?: ('email' | 'in-app' | 'link')[];
  shareableLink?: string;
}

export interface SurveyQuestion {
  id: string;
  type: 'text' | 'multiple-choice' | 'rating' | 'yes-no' | 'date' | 'number' | 'email' | 'phone' | 'matrix' | 'ranking' | 'file-upload';
  question: string;
  options?: string[]; // For multiple-choice, matrix rows/columns, ranking
  matrixRows?: string[]; // For matrix questions
  matrixColumns?: string[]; // For matrix questions
  placeholder?: string; // For text, number, email, phone inputs
  min?: number; // For number, rating
  max?: number; // For number, rating
  step?: number; // For number
  required: boolean;
  conditionalLogic?: ConditionalLogic; // Conditional display logic
  helpText?: string; // Help text for the question
}

export interface ConditionalLogic {
  showIf: {
    questionId: string; // ID of the question to check
    operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'is_empty' | 'is_not_empty';
    value: any; // Value to compare against
  };
}

export interface SurveyResponse {
  id: string;
  surveyId: string;
  memberId: string;
  answers: Record<string, any>;
  submittedAt: string;
}



export class SurveysService {
  // Get all surveys
  static async getAllSurveys(): Promise<Survey[]> {
    if (isDevMode()) {
      return MOCK_SURVEYS;
    }

    try {
      const snapshot = await getDocs(
        query(collection(db, COLLECTIONS.SURVEYS), orderBy('createdAt', 'desc'))
      );
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        startDate: doc.data().startDate?.toDate?.()?.toISOString() || doc.data().startDate,
        endDate: doc.data().endDate?.toDate?.()?.toISOString() || doc.data().endDate,
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
      } as Survey));
    } catch (error) {
      console.error('Error fetching surveys:', error);
      throw error;
    }
  }

  // Get survey by ID
  static async getSurveyById(surveyId: string): Promise<Survey | null> {
    try {
      const docRef = doc(db, COLLECTIONS.SURVEYS, surveyId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return {
          id: docSnap.id,
          ...docSnap.data(),
          startDate: docSnap.data().startDate?.toDate?.()?.toISOString() || docSnap.data().startDate,
          endDate: docSnap.data().endDate?.toDate?.()?.toISOString() || docSnap.data().endDate,
          createdAt: docSnap.data().createdAt?.toDate?.()?.toISOString() || docSnap.data().createdAt,
        } as Survey;
      }
      return null;
    } catch (error) {
      console.error('Error fetching survey:', error);
      throw error;
    }
  }

  // Create survey
  static async createSurvey(surveyData: Omit<Survey, 'id' | 'responsesCount' | 'createdAt'>): Promise<string> {
    if (isDevMode()) {
      // In dev mode, return a mock ID
      return `mock-survey-${Date.now()}`;
    }

    try {
      const newSurvey = {
        ...surveyData,
        responsesCount: 0,
        startDate: Timestamp.fromDate(new Date(surveyData.startDate)),
        endDate: Timestamp.fromDate(new Date(surveyData.endDate)),
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      const cleanSurvey = removeUndefined(newSurvey);
      const docRef = await addDoc(collection(db, COLLECTIONS.SURVEYS), cleanSurvey);
      return docRef.id;
    } catch (error) {
      console.error('Error creating survey:', error);
      throw error;
    }
  }

  // Update survey
  static async updateSurvey(surveyId: string, updates: Partial<Survey>): Promise<void> {
    try {
      const surveyRef = doc(db, COLLECTIONS.SURVEYS, surveyId);
      const updateData: any = {
        ...updates,
        updatedAt: Timestamp.now(),
      };

      if (updates.startDate) {
        updateData.startDate = Timestamp.fromDate(new Date(updates.startDate));
      }
      if (updates.endDate) {
        updateData.endDate = Timestamp.fromDate(new Date(updates.endDate));
      }

      const cleanUpdates = removeUndefined(updateData);
      await updateDoc(surveyRef, cleanUpdates);
    } catch (error) {
      console.error('Error updating survey:', error);
      throw error;
    }
  }

  // Delete survey
  static async deleteSurvey(surveyId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, COLLECTIONS.SURVEYS, surveyId));
    } catch (error) {
      console.error('Error deleting survey:', error);
      throw error;
    }
  }

  // Submit survey response
  static async submitResponse(responseData: Omit<SurveyResponse, 'id' | 'submittedAt'>): Promise<string> {
    try {
      const newResponse = {
        ...responseData,
        submittedAt: Timestamp.now(),
      };

      const cleanResponse = removeUndefined(newResponse);
      const docRef = await addDoc(collection(db, COLLECTIONS.SURVEY_RESPONSES), cleanResponse);

      // Update survey response count
      const surveyRef = doc(db, COLLECTIONS.SURVEYS, responseData.surveyId);
      const surveySnap = await getDoc(surveyRef);
      if (surveySnap.exists()) {
        await updateDoc(surveyRef, {
          responsesCount: (surveySnap.data().responsesCount || 0) + 1,
        });
      }

      return docRef.id;
    } catch (error) {
      console.error('Error submitting survey response:', error);
      throw error;
    }
  }

  // Get survey responses
  static async getSurveyResponses(surveyId: string): Promise<SurveyResponse[]> {
    try {
      const q = query(
        collection(db, COLLECTIONS.SURVEY_RESPONSES),
        where('surveyId', '==', surveyId),
        orderBy('submittedAt', 'desc')
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        submittedAt: doc.data().submittedAt?.toDate?.()?.toISOString() || doc.data().submittedAt,
      } as SurveyResponse));
    } catch (error) {
      console.error('Error fetching survey responses:', error);
      throw error;
    }
  }

  // Distribute survey to selected channels
  static async distributeSurvey(
    surveyId: string,
    channels: ('email' | 'in-app' | 'link')[]
  ): Promise<{ emailsSent: number; notificationsSent: number }> {
    if (isDevMode()) {
      console.log(`[DEV MODE] Would distribute survey ${surveyId} via channels: ${channels.join(', ')}`);
      return { emailsSent: 0, notificationsSent: 0 };
    }

    try {
      const survey = await this.getSurveyById(surveyId);
      if (!survey) {
        throw new Error('Survey not found');
      }

      // In production, this would:
      // 1. Send emails if 'email' channel is selected
      // 2. Create in-app notifications if 'in-app' channel is selected
      // 3. Generate shareable link if 'link' channel is selected

      // For now, return mock results
      const emailsSent = channels.includes('email') ? 10 : 0;
      const notificationsSent = channels.includes('in-app') ? 5 : 0;

      // Update survey with distribution channels
      await this.updateSurvey(surveyId, {
        distributionChannels: channels,
        shareableLink: channels.includes('link') ? `https://jci-kl.app/survey/${surveyId}` : undefined,
      });

      return { emailsSent, notificationsSent };
    } catch (error) {
      console.error('Error distributing survey:', error);
      throw error;
    }
  }
}



