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
import { isDevMode } from '../utils/devMode';

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
    if (isDevMode()) {
      return [
        {
          id: 't1',
          name: 'Monthly Networking Event',
          description: 'Standard monthly networking gathering',
          type: 'Social',
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
          type: 'Training',
          defaultLocation: 'Training Room',
          defaultMaxAttendees: 30,
          defaultBudget: 1000,
          checklist: ['Trainer confirmation', 'Materials preparation', 'Venue setup', 'Certificates'],
          requiredResources: ['Projector', 'Whiteboard', 'Training materials'],
          estimatedDuration: 6,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
    }

    try {
      const snapshot = await getDocs(
        query(collection(db, COLLECTIONS.TEMPLATES), orderBy('name'))
      );
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
      })) as EventTemplate[];
    } catch (error) {
      console.error('Error fetching event templates:', error);
      throw error;
    }
  }

  // Get template by ID
  static async getEventTemplateById(templateId: string): Promise<EventTemplate | null> {
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
      console.error('Error fetching event template:', error);
      throw error;
    }
  }

  // Create event template
  static async createEventTemplate(templateData: Omit<EventTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    if (isDevMode()) {
      const newId = `mock-template-${Date.now()}`;
      console.log(`[DEV MODE] Simulating creation of event template with ID: ${newId}`);
      return newId;
    }
    
    try {
      // Filter out undefined values
      const newTemplate: any = {
        name: templateData.name,
        type: templateData.type,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };
      
      if (templateData.description !== undefined) newTemplate.description = templateData.description;
      if (templateData.defaultLocation !== undefined) newTemplate.defaultLocation = templateData.defaultLocation;
      if (templateData.defaultMaxAttendees !== undefined) newTemplate.defaultMaxAttendees = templateData.defaultMaxAttendees;
      
      const docRef = await addDoc(collection(db, COLLECTIONS.TEMPLATES), newTemplate);
      return docRef.id;
    } catch (error) {
      console.error('Error creating event template:', error);
      throw error;
    }
  }

  // Update event template
  static async updateEventTemplate(templateId: string, updates: Partial<EventTemplate>): Promise<void> {
    try {
      const templateRef = doc(db, COLLECTIONS.TEMPLATES, templateId);
      await updateDoc(templateRef, {
        ...updates,
        updatedAt: Timestamp.now(),
      });
    } catch (error) {
      console.error('Error updating event template:', error);
      throw error;
    }
  }

  // Delete event template
  static async deleteEventTemplate(templateId: string): Promise<void> {
    if (isDevMode()) {
      console.log(`[DEV MODE] Simulating deletion of event template ${templateId}`);
      return;
    }
    
    try {
      await deleteDoc(doc(db, COLLECTIONS.TEMPLATES, templateId));
    } catch (error) {
      console.error('Error deleting event template:', error);
      throw error;
    }
  }

  // Activity Plan Templates
  static async getAllActivityPlanTemplates(): Promise<ActivityPlanTemplate[]> {
    if (isDevMode()) {
      return [
        {
          id: 'apt1',
          name: 'Community Service Project Template',
          description: 'Standard template for community service projects',
          type: 'Community',
          defaultObjectives: 'Serve the community, develop leadership skills, build partnerships',
          defaultExpectedImpact: 'Positive community impact, member engagement, media coverage',
          defaultResources: ['Venue', 'Volunteers', 'Materials', 'Marketing'],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
    }

    try {
      const snapshot = await getDocs(
        query(
          collection(db, COLLECTIONS.TEMPLATES),
          where('templateType', '==', 'activityPlan'),
          orderBy('name')
        )
      );
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
      })) as ActivityPlanTemplate[];
    } catch (error) {
      console.error('Error fetching activity plan templates:', error);
      throw error;
    }
  }

  static async createActivityPlanTemplate(templateData: Omit<ActivityPlanTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    if (isDevMode()) {
      return `mock-apt-${Date.now()}`;
    }

    try {
      const newTemplate: any = {
        ...templateData,
        templateType: 'activityPlan',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };
      const docRef = await addDoc(collection(db, COLLECTIONS.TEMPLATES), newTemplate);
      return docRef.id;
    } catch (error) {
      console.error('Error creating activity plan template:', error);
      throw error;
    }
  }

  static async updateActivityPlanTemplate(templateId: string, updates: Partial<ActivityPlanTemplate>): Promise<void> {
    try {
      const templateRef = doc(db, COLLECTIONS.TEMPLATES, templateId);
      await updateDoc(templateRef, {
        ...updates,
        updatedAt: Timestamp.now(),
      });
    } catch (error) {
      console.error('Error updating activity plan template:', error);
      throw error;
    }
  }

  static async deleteActivityPlanTemplate(templateId: string): Promise<void> {
    if (isDevMode()) {
      console.log(`[DEV MODE] Simulating deletion of activity plan template ${templateId}`);
      return;
    }
    
    try {
      await deleteDoc(doc(db, COLLECTIONS.TEMPLATES, templateId));
    } catch (error) {
      console.error('Error deleting activity plan template:', error);
      throw error;
    }
  }

  // Event Budget Templates
  static async getAllEventBudgetTemplates(): Promise<EventBudgetTemplate[]> {
    if (isDevMode()) {
      return [
        {
          id: 'ebt1',
          name: 'Standard Event Budget Template',
          description: 'Template for standard events',
          eventType: 'Social',
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
      ];
    }

    try {
      const snapshot = await getDocs(
        query(
          collection(db, COLLECTIONS.TEMPLATES),
          where('templateType', '==', 'eventBudget'),
          orderBy('name')
        )
      );
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
      })) as EventBudgetTemplate[];
    } catch (error) {
      console.error('Error fetching event budget templates:', error);
      throw error;
    }
  }

  static async createEventBudgetTemplate(templateData: Omit<EventBudgetTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    if (isDevMode()) {
      return `mock-ebt-${Date.now()}`;
    }

    try {
      const newTemplate: any = {
        ...templateData,
        templateType: 'eventBudget',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };
      const docRef = await addDoc(collection(db, COLLECTIONS.TEMPLATES), newTemplate);
      return docRef.id;
    } catch (error) {
      console.error('Error creating event budget template:', error);
      throw error;
    }
  }

  static async updateEventBudgetTemplate(templateId: string, updates: Partial<EventBudgetTemplate>): Promise<void> {
    try {
      const templateRef = doc(db, COLLECTIONS.TEMPLATES, templateId);
      await updateDoc(templateRef, {
        ...updates,
        updatedAt: Timestamp.now(),
      });
    } catch (error) {
      console.error('Error updating event budget template:', error);
      throw error;
    }
  }

  static async deleteEventBudgetTemplate(templateId: string): Promise<void> {
    if (isDevMode()) {
      console.log(`[DEV MODE] Simulating deletion of event budget template ${templateId}`);
      return;
    }
    
    try {
      await deleteDoc(doc(db, COLLECTIONS.TEMPLATES, templateId));
    } catch (error) {
      console.error('Error deleting event budget template:', error);
      throw error;
    }
  }
}

