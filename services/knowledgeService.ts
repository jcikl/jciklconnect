// Knowledge & Learning Service - CRUD Operations
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
import { TrainingModule, Document } from '../types';
import { isDevMode } from '../utils/devMode';
import { MOCK_TRAININGS, MOCK_DOCUMENTS } from './mockData';

export class KnowledgeService {
  // Get all training modules
  static async getAllTrainingModules(): Promise<TrainingModule[]> {
    if (isDevMode()) {
      return MOCK_TRAININGS;
    }

    try {
      const snapshot = await getDocs(
        query(collection(db, COLLECTIONS.TRAINING_MODULES), orderBy('title', 'asc'))
      );
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as TrainingModule));
    } catch (error) {
      console.error('Error fetching training modules:', error);
      throw error;
    }
  }

  // Get training module by ID
  static async getTrainingModuleById(moduleId: string): Promise<TrainingModule | null> {
    try {
      const docRef = doc(db, COLLECTIONS.TRAINING_MODULES, moduleId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as TrainingModule;
      }
      return null;
    } catch (error) {
      console.error('Error fetching training module:', error);
      throw error;
    }
  }

  // Create training module
  static async createTrainingModule(moduleData: Omit<TrainingModule, 'id'>): Promise<string> {
    try {
      const newModule = {
        ...moduleData,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      const docRef = await addDoc(collection(db, COLLECTIONS.TRAINING_MODULES), newModule);
      return docRef.id;
    } catch (error) {
      console.error('Error creating training module:', error);
      throw error;
    }
  }

  // Update training module
  static async updateTrainingModule(moduleId: string, updates: Partial<TrainingModule>): Promise<void> {
    try {
      const moduleRef = doc(db, COLLECTIONS.TRAINING_MODULES, moduleId);
      await updateDoc(moduleRef, {
        ...updates,
        updatedAt: Timestamp.now(),
      });
    } catch (error) {
      console.error('Error updating training module:', error);
      throw error;
    }
  }

  // Get all documents
  static async getAllDocuments(): Promise<Document[]> {
    if (isDevMode()) {
      return MOCK_DOCUMENTS;
    }

    try {
      const snapshot = await getDocs(
        query(collection(db, COLLECTIONS.DOCUMENTS), orderBy('uploadedDate', 'desc'))
      );
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        uploadedDate: doc.data().uploadedDate?.toDate?.()?.toISOString() || doc.data().uploadedDate,
      } as Document));
    } catch (error) {
      console.error('Error fetching documents:', error);
      throw error;
    }
  }

  // Create document
  static async createDocument(documentData: Omit<Document, 'id'>): Promise<string> {
    try {
      const newDocument = {
        ...documentData,
        uploadedDate: Timestamp.now(),
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      const docRef = await addDoc(collection(db, COLLECTIONS.DOCUMENTS), newDocument);
      return docRef.id;
    } catch (error) {
      console.error('Error creating document:', error);
      throw error;
    }
  }

  // Delete document
  static async deleteDocument(documentId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, COLLECTIONS.DOCUMENTS, documentId));
    } catch (error) {
      console.error('Error deleting document:', error);
      throw error;
    }
  }

  // Get documents by category
  static async getDocumentsByCategory(category: Document['category']): Promise<Document[]> {
    try {
      const q = query(
        collection(db, COLLECTIONS.DOCUMENTS),
        where('category', '==', category),
        orderBy('uploadedDate', 'desc')
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        uploadedDate: doc.data().uploadedDate?.toDate?.()?.toISOString() || doc.data().uploadedDate,
      } as Document));
    } catch (error) {
      console.error('Error fetching documents by category:', error);
      throw error;
    }
  }

  // Search documents
  static async searchDocuments(searchTerm: string): Promise<Document[]> {
    if (isDevMode()) {
      const allDocs = await this.getAllDocuments();
      const term = searchTerm.toLowerCase();
      return allDocs.filter(doc =>
        doc.name.toLowerCase().includes(term) ||
        doc.description?.toLowerCase().includes(term) ||
        doc.category?.toLowerCase().includes(term)
      );
    }

    try {
      // Firestore doesn't support full-text search natively
      // This is a simple implementation - consider using Algolia for production
      const allDocs = await this.getAllDocuments();
      const term = searchTerm.toLowerCase();

      return allDocs.filter(doc =>
        doc.name.toLowerCase().includes(term) ||
        doc.description?.toLowerCase().includes(term) ||
        doc.category?.toLowerCase().includes(term)
      );
    } catch (error) {
      console.error('Error searching documents:', error);
      throw error;
    }
  }

  // Search training modules
  static async searchTrainingModules(searchTerm: string): Promise<TrainingModule[]> {
    if (isDevMode()) {
      const allModules = await this.getAllTrainingModules();
      const term = searchTerm.toLowerCase();
      return allModules.filter(module =>
        module.title.toLowerCase().includes(term) ||
        module.type?.toLowerCase().includes(term)
      );
    }

    try {
      const allModules = await this.getAllTrainingModules();
      const term = searchTerm.toLowerCase();

      return allModules.filter(module =>
        module.title.toLowerCase().includes(term) ||
        module.type?.toLowerCase().includes(term)
      );
    } catch (error) {
      console.error('Error searching training modules:', error);
      throw error;
    }
  }

  // Get all unique categories
  static async getAllCategories(): Promise<string[]> {
    try {
      const allDocs = await this.getAllDocuments();
      const categories = new Set<string>();
      allDocs.forEach(doc => {
        if (doc.category) {
          categories.add(doc.category);
        }
      });
      return Array.from(categories).sort();
    } catch (error) {
      console.error('Error fetching categories:', error);
      throw error;
    }
  }
}
