// Flagship Projects Service - CRUD Operations
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/constants';
import { FlagshipProject } from '../types';
import { withDevMode } from '../utils/devMode';
import { MOCK_FLAGSHIP_PROJECTS } from './mockData';

// Local in-memory store for Dev Mode simulation
let devFlagshipProjects: FlagshipProject[] = [...MOCK_FLAGSHIP_PROJECTS];

export class FlagshipProjectsService {
  // Get all flagship projects
  static async getAllProjects(): Promise<FlagshipProject[]> {
    return withDevMode(
      () => devFlagshipProjects,
      async () => {
        try {
          const snapshot = await getDocs(
            query(collection(db, COLLECTIONS.FLAGSHIP_PROJECTS), orderBy('createdAt', 'desc'))
          );
          return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate?.()?.toISOString?.() ?? doc.data().createdAt,
            updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString?.() ?? doc.data().updatedAt,
          } as FlagshipProject));
        } catch (error) {
          console.error('Error fetching flagship projects:', error);
          // Fallback
          return devFlagshipProjects;
        }
      }
    );
  }

  // Get flagship project by ID
  static async getProjectById(id: string): Promise<FlagshipProject | null> {
    return withDevMode(
      () => devFlagshipProjects.find(p => p.id === id) || null,
      async () => {
        try {
          const docRef = doc(db, COLLECTIONS.FLAGSHIP_PROJECTS, id);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            return { id: docSnap.id, ...docSnap.data() } as FlagshipProject;
          }
          return null;
        } catch (error) {
          console.error('Error fetching flagship project:', error);
          throw error;
        }
      }
    );
  }

  // Create new flagship project
  static async createProject(projectData: Omit<FlagshipProject, 'id'>): Promise<string> {
    return withDevMode(
      () => {
        const newId = `mock-flagship-${Date.now()}`;
        const newProject: FlagshipProject = {
          id: newId,
          ...projectData,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        devFlagshipProjects = [newProject, ...devFlagshipProjects];
        return newId;
      },
      async () => {
        try {
          const payload = {
            ...projectData,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
          };
          const docRef = await addDoc(collection(db, COLLECTIONS.FLAGSHIP_PROJECTS), payload);
          return docRef.id;
        } catch (error) {
          console.error('Error creating flagship project:', error);
          throw error;
        }
      }
    );
  }

  // Update flagship project
  static async updateProject(id: string, updates: Partial<FlagshipProject>): Promise<void> {
    return withDevMode(
      () => {
        devFlagshipProjects = devFlagshipProjects.map(p =>
          p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p
        );
      },
      async () => {
        try {
          const docRef = doc(db, COLLECTIONS.FLAGSHIP_PROJECTS, id);
          await updateDoc(docRef, {
            ...updates,
            updatedAt: Timestamp.now(),
          });
        } catch (error) {
          console.error('Error updating flagship project:', error);
          throw error;
        }
      }
    );
  }

  // Delete flagship project
  static async deleteProject(id: string): Promise<void> {
    return withDevMode(
      () => {
        devFlagshipProjects = devFlagshipProjects.filter(p => p.id !== id);
      },
      async () => {
        try {
          await deleteDoc(doc(db, COLLECTIONS.FLAGSHIP_PROJECTS, id));
        } catch (error) {
          console.error('Error deleting flagship project:', error);
          throw error;
        }
      }
    );
  }
}
