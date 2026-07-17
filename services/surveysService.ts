// Surveys Service - CRUD Operations
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  runTransaction,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/constants';
import { withDevMode, isDevMode } from '../utils/devMode';
import { MOCK_SURVEYS } from './mockData';
import { removeUndefined } from '../utils/dataUtils';
import { apiCache } from './cacheService';
import { errorLoggingService } from './errorLoggingService';

// Cache key helpers
const CACHE_KEY_ALL = 'surveys:all';
const cacheKeyById = (id: string) => `surveys:${id}`;
const CACHE_KEY_RESPONSES_PREFIX = 'surveyResponses:';
const cacheKeyResponses = (surveyId: string) => `${CACHE_KEY_RESPONSES_PREFIX}${surveyId}`;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function invalidateSurveysCache(surveyId?: string): void {
  apiCache.delete(CACHE_KEY_ALL);
  if (surveyId) {
    apiCache.delete(cacheKeyById(surveyId));
    apiCache.delete(cacheKeyResponses(surveyId));
  }
}

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

function mapSurveyDoc(docSnap: any): Survey {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    ...data,
    startDate: data.startDate?.toDate?.()?.toISOString() || data.startDate,
    endDate: data.endDate?.toDate?.()?.toISOString() || data.endDate,
    createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
  } as Survey;
}

export class SurveysService {
  // Get all surveys
  static async getAllSurveys(): Promise<Survey[]> {
    if (isDevMode()) return MOCK_SURVEYS as Survey[];

    return apiCache.getOrSet(
      CACHE_KEY_ALL,
      async () => {
        const snapshot = await getDocs(
          query(collection(db, COLLECTIONS.SURVEYS), orderBy('createdAt', 'desc'))
        );
        return snapshot.docs.map(mapSurveyDoc);
      },
      CACHE_TTL_MS,
      'SurveysService.getAllSurveys'
    );
  }

  // Get survey by ID
  static async getSurveyById(surveyId: string): Promise<Survey | null> {
    if (isDevMode()) {
      return (MOCK_SURVEYS as Survey[]).find(s => s.id === surveyId) ?? null;
    }

    return apiCache.getOrSet(
      cacheKeyById(surveyId),
      async () => {
        const docRef = doc(db, COLLECTIONS.SURVEYS, surveyId);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) return null;
        return mapSurveyDoc(docSnap);
      },
      CACHE_TTL_MS,
      'SurveysService.getSurveyById'
    );
  }

  // Create survey
  static async createSurvey(surveyData: Omit<Survey, 'id' | 'responsesCount' | 'createdAt'>): Promise<string> {
    if (isDevMode()) return `mock-survey-${Date.now()}`;

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
      invalidateSurveysCache();
      return docRef.id;
    } catch (error) {
      errorLoggingService.logError(error as Error, { component: 'SurveysService', action: 'createSurvey' });
      throw error;
    }
  }

  // Update survey
  static async updateSurvey(surveyId: string, updates: Partial<Survey>): Promise<void> {
    if (isDevMode()) return;

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
      invalidateSurveysCache(surveyId);
    } catch (error) {
      errorLoggingService.logError(error as Error, { component: 'SurveysService', action: 'updateSurvey' });
      throw error;
    }
  }

  // Delete survey — also batch-deletes all associated responses
  static async deleteSurvey(surveyId: string): Promise<void> {
    if (isDevMode()) return;

    try {
      // Fetch all responses for this survey
      const responsesSnap = await getDocs(
        query(collection(db, COLLECTIONS.SURVEY_RESPONSES), where('surveyId', '==', surveyId))
      );

      const batch = writeBatch(db);
      // Delete all child response documents
      responsesSnap.docs.forEach(responseDoc => batch.delete(responseDoc.ref));
      // Delete the survey document itself
      batch.delete(doc(db, COLLECTIONS.SURVEYS, surveyId));

      await batch.commit();
      invalidateSurveysCache(surveyId);
    } catch (error) {
      errorLoggingService.logError(error as Error, { component: 'SurveysService', action: 'deleteSurvey' });
      throw error;
    }
  }

  // Submit survey response — uses runTransaction to prevent duplicate submissions
  // and to atomically increment responsesCount.
  static async submitResponse(responseData: Omit<SurveyResponse, 'id' | 'submittedAt'>): Promise<string> {
    if (isDevMode()) return `mock-response-${Date.now()}`;

    try {
      const surveyRef = doc(db, COLLECTIONS.SURVEYS, responseData.surveyId);
      const responsesCol = collection(db, COLLECTIONS.SURVEY_RESPONSES);

      let newResponseId: string;

      await runTransaction(db, async (tx) => {
        // 1. Verify survey exists and is still Active
        const surveySnap = await tx.get(surveyRef);
        if (!surveySnap.exists()) {
          throw new Error(`Survey ${responseData.surveyId} not found`);
        }
        if (surveySnap.data().status !== 'Active') {
          throw new Error('Survey is not accepting responses');
        }

        // 2. Check for existing response from this member (duplicate prevention)
        // NOTE: runTransaction cannot run queries; we query outside the transaction
        // and use the result as an optimistic check. The Firestore security rules
        // must also enforce the uniqueness constraint server-side.
        // We re-read a sentinel doc keyed by (surveyId, memberId) to make the
        // duplicate check truly atomic.
        const sentinelId = `${responseData.surveyId}_${responseData.memberId}`;
        const sentinelRef = doc(db, COLLECTIONS.SURVEY_RESPONSES, sentinelId);
        const sentinelSnap = await tx.get(sentinelRef);
        if (sentinelSnap.exists()) {
          throw new Error('You have already submitted a response to this survey');
        }

        // 3. Write sentinel (idempotency guard) + increment count — both inside tx
        const submittedAt = Timestamp.now();
        const payload = removeUndefined({
          ...responseData,
          submittedAt,
          _isSentinel: true, // mark so we can distinguish if needed
        });
        tx.set(sentinelRef, payload);

        const currentCount = surveySnap.data().responsesCount || 0;
        tx.update(surveyRef, { responsesCount: currentCount + 1, updatedAt: submittedAt });

        newResponseId = sentinelId;
      });

      invalidateSurveysCache(responseData.surveyId);
      return newResponseId!;
    } catch (error) {
      errorLoggingService.logError(error as Error, { component: 'SurveysService', action: 'submitResponse' });
      throw error;
    }
  }

  // Get survey responses
  static async getSurveyResponses(surveyId: string): Promise<SurveyResponse[]> {
    if (isDevMode()) return [];

    return apiCache.getOrSet(
      cacheKeyResponses(surveyId),
      async () => {
        const q = query(
          collection(db, COLLECTIONS.SURVEY_RESPONSES),
          where('surveyId', '==', surveyId),
          orderBy('submittedAt', 'desc')
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({
          id: d.id,
          ...d.data(),
          submittedAt: d.data().submittedAt?.toDate?.()?.toISOString() || d.data().submittedAt,
        } as SurveyResponse));
      },
      CACHE_TTL_MS,
      'SurveysService.getSurveyResponses'
    );
  }

  // Distribute survey — sends in-app notifications to target members
  static async distributeSurvey(
    surveyId: string,
    channels: ('email' | 'in-app' | 'link')[]
  ): Promise<{ emailsSent: number; notificationsSent: number }> {
    if (isDevMode()) return { emailsSent: 0, notificationsSent: 0 };

    try {
      const survey = await this.getSurveyById(surveyId);
      if (!survey) {
        throw new Error('Survey not found');
      }

      let notificationsSent = 0;

      // Dispatch in-app notifications
      if (channels.includes('in-app')) {
        const { CommunicationService } = await import('./communicationService');

        // Determine target member IDs
        let targetMemberIds: string[] = [];
        if (survey.targetAudience === 'Specific Group' && survey.specificMemberIds?.length) {
          targetMemberIds = survey.specificMemberIds;
        } else if (survey.targetAudience === 'All Members') {
          const { MembersService } = await import('./membersService');
          const allMembers = await MembersService.getAllMembers();
          targetMemberIds = allMembers
            .filter(m => m.role !== 'INACTIVE')
            .map(m => m.id!)
            .filter(Boolean);
        } else if (survey.targetAudience === 'Board') {
          const { MembersService } = await import('./membersService');
          const allMembers = await MembersService.getAllMembers();
          targetMemberIds = allMembers
            .filter(m => m.role === 'BOARD' || m.role === 'ADMIN' || m.role === 'SUPER_ADMIN')
            .map(m => m.id!)
            .filter(Boolean);
        } else {
          // Fallback: notify creator only and log intent
          errorLoggingService.logInfo(
            `distributeSurvey: in-app broadcast for audience "${survey.targetAudience}" — individual member IDs not resolved; sending to creator only`,
            { component: 'SurveysService', action: 'distributeSurvey' }
          );
          targetMemberIds = [survey.createdBy];
        }

        if (targetMemberIds.length === 0) {
          throw new Error('No target members resolved for in-app distribution');
        }

        // Send in batches of 50 to avoid Firestore write bursts / function timeouts
        const NOTIFY_BATCH_SIZE = 50;
        const notifMessage = survey.description
          ? `${survey.description} — Please complete the survey before ${survey.endDate}.`
          : `Please complete the survey before ${survey.endDate}.`;

        for (let i = 0; i < targetMemberIds.length; i += NOTIFY_BATCH_SIZE) {
          const batchIds = targetMemberIds.slice(i, i + NOTIFY_BATCH_SIZE);
          const batchResults = await Promise.all(
            batchIds.map(memberId =>
              CommunicationService.createNotification({
                memberId,
                title: `New Survey: ${survey.title}`,
                message: notifMessage,
                type: 'info',
              }).catch(err => {
                errorLoggingService.logError(err, { component: 'SurveysService', action: `distributeSurvey:notify:${memberId}` });
                return null;
              })
            )
          );
          notificationsSent += batchResults.filter(r => r !== null).length;
        }
      }

      // Email channel: logged as intent (email infra not yet wired)
      if (channels.includes('email')) {
        errorLoggingService.logInfo(
          `distributeSurvey: email channel requested for survey ${surveyId} but email sending is not yet implemented`,
          { component: 'SurveysService', action: 'distributeSurvey' }
        );
      }

      // Fix 12 (P2): throw early if 'link' channel is requested but base URL is not configured,
      // preventing undefined from being stored as the shareableLink in Firestore.
      const baseUrl = import.meta.env.VITE_APP_BASE_URL;
      if (channels.includes('link') && !baseUrl) {
        throw new Error('Cannot generate shareable link: VITE_APP_BASE_URL environment variable is not configured.');
      }
      const shareableLink = baseUrl ? `${baseUrl}/survey/${surveyId}` : undefined;

      // Update survey record with distribution channels and optional shareable link
      await this.updateSurvey(surveyId, {
        distributionChannels: channels,
        shareableLink: channels.includes('link') ? shareableLink : undefined,
      });

      return { emailsSent: 0, notificationsSent };
    } catch (error) {
      errorLoggingService.logError(error as Error, { component: 'SurveysService', action: 'distributeSurvey' });
      throw error;
    }
  }
}
