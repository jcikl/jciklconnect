// Templates Service - Event Templates Management
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
import { withDevMode } from '../utils/devMode';
import { apiCache, CACHE_TTL_5MIN } from './cacheService';
import { errorLoggingService } from './errorLoggingService';

const TEMPLATES_CACHE_PREFIX = 'templates:';

function invalidateTemplatesCache(): void {
  apiCache.deleteByPrefix(TEMPLATES_CACHE_PREFIX);
}

export interface EventTemplate {
  id?: string;
  name: string;
  description?: string;
  type: 'Meeting' | 'Training' | 'Social' | 'Project' | 'International';
  defaultLocation?: string;
  defaultMaxAttendees?: number;
  defaultBudget?: number;
  checklist?: string[];
  requiredResources?: string[];
  estimatedDuration?: number; // in hours
  createdAt: Date | Timestamp;
  updatedAt: Date | Timestamp;
  createdBy?: string;
}

export interface ActivityPlanTemplate {
  id?: string;
  name: string;
  description?: string;
  type: 'Community' | 'Business' | 'Individual' | 'International';
  defaultObjectives?: string;
  defaultExpectedImpact?: string;
  defaultResources?: string[];
  defaultTimeline?: string;
  createdAt: Date | Timestamp;
  updatedAt: Date | Timestamp;
  createdBy?: string;
}

export interface EventBudgetTemplate {
  id?: string;
  name: string;
  description?: string;
  eventType?: 'Meeting' | 'Training' | 'Social' | 'Project' | 'International';
  budgetCategories: Array<{
    category: string;
    estimatedAmount: number;
    description?: string;
  }>;
  totalEstimatedBudget: number;
  createdAt: Date | Timestamp;
  updatedAt: Date | Timestamp;
  createdBy?: string;
}

export class TemplatesService {
  // Get all event templates
  static async getAllEventTemplates(): Promise<EventTemplate[]> {
    return withDevMode<EventTemplate[]>(
      () => [
        {
          id: 't1',
          name: 'Monthly Networking Event',
          description: 'Standard monthly networking gathering',
          type: 'Social' as const,
          defaultLocation: 'JCI KL Office',
          defaultMaxAttendees: 50,
          defaultBudget: 500,
          checklist: ['Venue booking', 'Catering', 'Registration setup', 'Marketing materials'],
          requiredResources: ['Projector', 'Sound system', 'Tables'],
          estimatedDuration: 3,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 't2',
          name: 'Leadership Training Workshop',
          description: 'Standard leadership development workshop',
          type: 'Training' as const,
          defaultLocation: 'Training Room',
          defaultMaxAttendees: 30,
          defaultBudget: 1000,
          checklist: ['Trainer confirmation', 'Materials preparation', 'Venue setup', 'Certificates'],
          requiredResources: ['Projector', 'Whiteboard', 'Training materials'],
          estimatedDuration: 6,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      () => apiCache.getOrSet(
        `${TEMPLATES_CACHE_PREFIX}event:all`,
        async () => {
          try {
            const snapshot = await getDocs(
              query(
                collection(db, COLLECTIONS.TEMPLATES),
                where('templateType', '==', 'EventTemplate'),
                orderBy('name')
              )
            );
            return snapshot.docs.map(d => ({
              id: d.id,
              ...d.data(),
              createdAt: d.data().createdAt?.toDate() || new Date(),
              updatedAt: d.data().updatedAt?.toDate() || new Date(),
            })) as EventTemplate[];
          } catch (error) {
            errorLoggingService.logError(error as Error, { component: 'TemplatesService', action: 'getAllEventTemplates' });
            throw error;
          }
        },
        CACHE_TTL_5MIN
      )
    );
  }

  // Get template by ID
  static async getEventTemplateById(templateId: string): Promise<EventTemplate | null> {
    return withDevMode(
      () => null,
      () => apiCache.getOrSet(
        `${TEMPLATES_CACHE_PREFIX}event:${templateId}`,
        async () => {
          try {
            const docRef = doc(db, COLLECTIONS.TEMPLATES, templateId);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
              return {
                id: docSnap.id,
                ...docSnap.data(),
                createdAt: docSnap.data().createdAt?.toDate() || new Date(),
                updatedAt: docSnap.data().updatedAt?.toDate() || new Date(),
              } as EventTemplate;
            }
            return null;
          } catch (error) {
            errorLoggingService.logError(error as Error, { component: 'TemplatesService', action: 'getEventTemplateById' });
            throw error;
          }
        },
        CACHE_TTL_5MIN
      )
    );
  }

  // Create event template
  static async createEventTemplate(templateData: Omit<EventTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    return withDevMode(
      () => `mock-template-${Date.now()}`,
      async () => {
        try {
          const newTemplate = {
            templateType: 'EventTemplate',
            name: templateData.name,
            type: templateData.type,
            description: templateData.description ?? null,
            defaultLocation: templateData.defaultLocation ?? null,
            defaultMaxAttendees: templateData.defaultMaxAttendees ?? null,
            defaultBudget: templateData.defaultBudget ?? null,
            checklist: templateData.checklist ?? [],
            requiredResources: templateData.requiredResources ?? [],
            estimatedDuration: templateData.estimatedDuration ?? null,
            createdBy: templateData.createdBy ?? null,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
          };
          const docRef = await addDoc(collection(db, COLLECTIONS.TEMPLATES), newTemplate);
          invalidateTemplatesCache();
          return docRef.id;
        } catch (error) {
          errorLoggingService.logError(error as Error, { component: 'TemplatesService', action: 'createEventTemplate' });
          throw error;
        }
      }
    );
  }

  // Update event template
  static async updateEventTemplate(templateId: string, updates: Partial<EventTemplate>): Promise<void> {
    return withDevMode(
      () => {},
      async () => {
        try {
          const templateRef = doc(db, COLLECTIONS.TEMPLATES, templateId);
          await updateDoc(templateRef, {
            ...updates,
            updatedAt: Timestamp.now(),
          });
          invalidateTemplatesCache();
        } catch (error) {
          errorLoggingService.logError(error as Error, { component: 'TemplatesService', action: 'updateEventTemplate' });
          throw error;
        }
      }
    );
  }

  // Delete event template
  static async deleteEventTemplate(templateId: string): Promise<void> {
    return withDevMode(
      () => {},
      async () => {
        try {
          await deleteDoc(doc(db, COLLECTIONS.TEMPLATES, templateId));
          invalidateTemplatesCache();
        } catch (error) {
          errorLoggingService.logError(error as Error, { component: 'TemplatesService', action: 'deleteEventTemplate' });
          throw error;
        }
      }
    );
  }

  // Activity Plan Templates
  static async getAllActivityPlanTemplates(): Promise<ActivityPlanTemplate[]> {
    return withDevMode<ActivityPlanTemplate[]>(
      () => [
        {
          id: 'apt1',
          name: 'Community Service Project Template',
          description: 'Standard template for community service projects',
          type: 'Community' as const,
          defaultObjectives: 'Serve the community, develop leadership skills, build partnerships',
          defaultExpectedImpact: 'Positive community impact, member engagement, media coverage',
          defaultResources: ['Venue', 'Volunteers', 'Materials', 'Marketing'],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      () => apiCache.getOrSet(
        `${TEMPLATES_CACHE_PREFIX}activityPlan:all`,
        async () => {
          try {
            const snapshot = await getDocs(
              query(
                collection(db, COLLECTIONS.TEMPLATES),
                where('templateType', '==', 'activityPlan'),
                orderBy('name')
              )
            );
            return snapshot.docs.map(d => ({
              id: d.id,
              ...d.data(),
              createdAt: d.data().createdAt?.toDate() || new Date(),
              updatedAt: d.data().updatedAt?.toDate() || new Date(),
            })) as ActivityPlanTemplate[];
          } catch (error) {
            errorLoggingService.logError(error as Error, { component: 'TemplatesService', action: 'getAllActivityPlanTemplates' });
            throw error;
          }
        },
        CACHE_TTL_5MIN
      )
    );
  }

  static async createActivityPlanTemplate(templateData: Omit<ActivityPlanTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    return withDevMode(
      () => `mock-apt-${Date.now()}`,
      async () => {
        try {
          const newTemplate: any = {
            ...templateData,
            templateType: 'activityPlan',
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
          };
          const docRef = await addDoc(collection(db, COLLECTIONS.TEMPLATES), newTemplate);
          invalidateTemplatesCache();
          return docRef.id;
        } catch (error) {
          errorLoggingService.logError(error as Error, { component: 'TemplatesService', action: 'createActivityPlanTemplate' });
          throw error;
        }
      }
    );
  }

  static async updateActivityPlanTemplate(templateId: string, updates: Partial<ActivityPlanTemplate>): Promise<void> {
    return withDevMode(
      () => {},
      async () => {
        try {
          const templateRef = doc(db, COLLECTIONS.TEMPLATES, templateId);
          await updateDoc(templateRef, {
            ...updates,
            updatedAt: Timestamp.now(),
          });
          invalidateTemplatesCache();
        } catch (error) {
          errorLoggingService.logError(error as Error, { component: 'TemplatesService', action: 'updateActivityPlanTemplate' });
          throw error;
        }
      }
    );
  }

  static async deleteActivityPlanTemplate(templateId: string): Promise<void> {
    return withDevMode(
      () => {},
      async () => {
        try {
          await deleteDoc(doc(db, COLLECTIONS.TEMPLATES, templateId));
          invalidateTemplatesCache();
        } catch (error) {
          errorLoggingService.logError(error as Error, { component: 'TemplatesService', action: 'deleteActivityPlanTemplate' });
          throw error;
        }
      }
    );
  }

  // Event Budget Templates
  static async getAllEventBudgetTemplates(): Promise<EventBudgetTemplate[]> {
    return withDevMode<EventBudgetTemplate[]>(
      () => [
        {
          id: 'ebt1',
          name: 'Standard Event Budget Template',
          description: 'Template for standard events',
          eventType: 'Social' as const,
          budgetCategories: [
            { category: 'Venue', estimatedAmount: 500, description: 'Event venue rental' },
            { category: 'Catering', estimatedAmount: 800, description: 'Food and beverages' },
            { category: 'Marketing', estimatedAmount: 200, description: 'Promotional materials' },
            { category: 'Equipment', estimatedAmount: 300, description: 'Audio/visual equipment' },
          ],
          totalEstimatedBudget: 1800,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      () => apiCache.getOrSet(
        `${TEMPLATES_CACHE_PREFIX}eventBudget:all`,
        async () => {
          try {
            const snapshot = await getDocs(
              query(
                collection(db, COLLECTIONS.TEMPLATES),
                where('templateType', '==', 'eventBudget'),
                orderBy('name')
              )
            );
            return snapshot.docs.map(d => ({
              id: d.id,
              ...d.data(),
              createdAt: d.data().createdAt?.toDate() || new Date(),
              updatedAt: d.data().updatedAt?.toDate() || new Date(),
            })) as EventBudgetTemplate[];
          } catch (error) {
            errorLoggingService.logError(error as Error, { component: 'TemplatesService', action: 'getAllEventBudgetTemplates' });
            throw error;
          }
        },
        CACHE_TTL_5MIN
      )
    );
  }

  static async createEventBudgetTemplate(templateData: Omit<EventBudgetTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    return withDevMode(
      () => `mock-ebt-${Date.now()}`,
      async () => {
        try {
          const newTemplate: any = {
            ...templateData,
            templateType: 'eventBudget',
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
          };
          const docRef = await addDoc(collection(db, COLLECTIONS.TEMPLATES), newTemplate);
          invalidateTemplatesCache();
          return docRef.id;
        } catch (error) {
          errorLoggingService.logError(error as Error, { component: 'TemplatesService', action: 'createEventBudgetTemplate' });
          throw error;
        }
      }
    );
  }

  static async updateEventBudgetTemplate(templateId: string, updates: Partial<EventBudgetTemplate>): Promise<void> {
    return withDevMode(
      () => {},
      async () => {
        try {
          const templateRef = doc(db, COLLECTIONS.TEMPLATES, templateId);
          await updateDoc(templateRef, {
            ...updates,
            updatedAt: Timestamp.now(),
          });
          invalidateTemplatesCache();
        } catch (error) {
          errorLoggingService.logError(error as Error, { component: 'TemplatesService', action: 'updateEventBudgetTemplate' });
          throw error;
        }
      }
    );
  }

  static async deleteEventBudgetTemplate(templateId: string): Promise<void> {
    return withDevMode(
      () => {},
      async () => {
        try {
          await deleteDoc(doc(db, COLLECTIONS.TEMPLATES, templateId));
          invalidateTemplatesCache();
        } catch (error) {
          errorLoggingService.logError(error as Error, { component: 'TemplatesService', action: 'deleteEventBudgetTemplate' });
          throw error;
        }
      }
    );
  }
}
