// Learning Paths & Certificates Service
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
import { TrainingModule } from '../types';

export interface LearningPath {
  id?: string;
  name: string;
  description: string;
  category: 'JCI Official' | 'Leadership' | 'Business' | 'Personal Development' | 'Technical';
  modules: string[]; // Module IDs in order
  estimatedDuration: number; // in hours
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  pointsReward: number;
  certificateIssued: boolean;
  prerequisites?: string[]; // Path IDs that must be completed first
  status: 'Active' | 'Draft' | 'Archived';
  createdAt: Date | Timestamp;
  updatedAt: Date | Timestamp;
}

export interface LearningProgress {
  id?: string;
  memberId: string;
  pathId: string;
  currentModuleIndex: number;
  completedModules: string[];
  startedAt: Date | Timestamp;
  completedAt?: Date | Timestamp;
  progress: number; // 0-100
  certificateIssued: boolean;
  certificateId?: string;
}

export interface Certificate {
  id?: string;
  memberId: string;
  pathId: string;
  pathName: string;
  issuedAt: Date | Timestamp;
  issuedBy: string;
  certificateNumber: string;
  verificationCode: string;
  fileUrl?: string;
  status: 'Active' | 'Revoked';
}

export class LearningPathsService {
  // Get all learning paths
  static async getAllLearningPaths(): Promise<LearningPath[]> {
    if (isDevMode()) {
      return [
        {
          id: 'lp1',
          name: 'JCI Leadership Development',
          description: 'Comprehensive leadership training program',
          category: 'JCI Official',
          modules: ['tm1', 'tm2', 'tm3'],
          estimatedDuration: 40,
          difficulty: 'Intermediate',
          pointsReward: 500,
          certificateIssued: true,
          status: 'Active',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
      ];
    }

    try {
      const snapshot = await getDocs(
        query(collection(db, COLLECTIONS.LEARNING_PATHS || 'learningPaths'), orderBy('createdAt', 'desc'))
      );
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
      })) as LearningPath[];
    } catch (error) {
      console.error('Error fetching learning paths:', error);
      throw error;
    }
  }

  // Get learning path by ID
  static async getLearningPathById(pathId: string): Promise<LearningPath | null> {
    try {
      const docRef = doc(db, COLLECTIONS.LEARNING_PATHS || 'learningPaths', pathId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return {
          id: docSnap.id,
          ...docSnap.data(),
          createdAt: docSnap.data().createdAt?.toDate() || new Date(),
          updatedAt: docSnap.data().updatedAt?.toDate() || new Date(),
        } as LearningPath;
      }
      return null;
    } catch (error) {
      console.error('Error fetching learning path:', error);
      throw error;
    }
  }

  // Get member's learning progress
  static async getMemberProgress(memberId: string, pathId?: string): Promise<LearningProgress[]> {
    try {
      let q = query(
        collection(db, COLLECTIONS.LEARNING_PROGRESS || 'learningProgress'),
        where('memberId', '==', memberId),
        orderBy('startedAt', 'desc')
      );
      
      if (pathId) {
        q = query(q, where('pathId', '==', pathId));
      }

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        startedAt: doc.data().startedAt?.toDate() || new Date(),
        completedAt: doc.data().completedAt?.toDate() || undefined,
      })) as LearningProgress[];
    } catch (error) {
      console.error('Error fetching learning progress:', error);
      throw error;
    }
  }

  // Start a learning path
  static async startLearningPath(memberId: string, pathId: string): Promise<string> {
    try {
      const progress: Omit<LearningProgress, 'id'> = {
        memberId,
        pathId,
        currentModuleIndex: 0,
        completedModules: [],
        startedAt: Timestamp.now(),
        progress: 0,
        certificateIssued: false,
      };
      
      const docRef = await addDoc(collection(db, COLLECTIONS.LEARNING_PROGRESS || 'learningProgress'), progress);
      return docRef.id;
    } catch (error) {
      console.error('Error starting learning path:', error);
      throw error;
    }
  }

  // Update learning progress
  static async updateProgress(
    progressId: string,
    moduleId: string,
    path: LearningPath
  ): Promise<void> {
    try {
      const progressDoc = await getDoc(doc(db, COLLECTIONS.LEARNING_PROGRESS || 'learningProgress', progressId));
      if (!progressDoc.exists()) {
        throw new Error('Progress not found');
      }

      const progress = progressDoc.data() as LearningProgress;
      const completedModules = [...(progress.completedModules || []), moduleId];
      const currentIndex = path.modules.indexOf(moduleId);
      const nextIndex = currentIndex < path.modules.length - 1 ? currentIndex + 1 : currentIndex;
      const progressPercent = Math.round((completedModules.length / path.modules.length) * 100);
      const isCompleted = completedModules.length === path.modules.length;

      const updates: any = {
        completedModules,
        currentModuleIndex: nextIndex,
        progress: progressPercent,
        updatedAt: Timestamp.now(),
      };

      if (isCompleted) {
        updates.completedAt = Timestamp.now();
        
        // Issue certificate if applicable
        if (path.certificateIssued) {
          const certificateId = await this.issueCertificate(
            progress.memberId,
            progress.pathId,
            path.name
          );
          updates.certificateIssued = true;
          updates.certificateId = certificateId;
        }
      }

      await updateDoc(doc(db, COLLECTIONS.LEARNING_PROGRESS || 'learningProgress', progressId), updates);
    } catch (error) {
      console.error('Error updating progress:', error);
      throw error;
    }
  }

  // Issue certificate
  static async issueCertificate(memberId: string, pathId: string, pathName: string): Promise<string> {
    try {
      const certificateNumber = `JCI-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      const verificationCode = Math.random().toString(36).substr(2, 12).toUpperCase();

      const certificate: Omit<Certificate, 'id'> = {
        memberId,
        pathId,
        pathName,
        issuedAt: Timestamp.now(),
        issuedBy: 'JCI Kuala Lumpur',
        certificateNumber,
        verificationCode,
        status: 'Active',
      };

      const docRef = await addDoc(collection(db, COLLECTIONS.CERTIFICATES || 'certificates'), certificate);
      return docRef.id;
    } catch (error) {
      console.error('Error issuing certificate:', error);
      throw error;
    }
  }

  // Get member certificates
  static async getMemberCertificates(memberId: string): Promise<Certificate[]> {
    try {
      const snapshot = await getDocs(
        query(
          collection(db, COLLECTIONS.CERTIFICATES || 'certificates'),
          where('memberId', '==', memberId),
          where('status', '==', 'Active'),
          orderBy('issuedAt', 'desc')
        )
      );
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        issuedAt: doc.data().issuedAt?.toDate() || new Date(),
      })) as Certificate[];
    } catch (error) {
      console.error('Error fetching certificates:', error);
      throw error;
    }
  }

  // Verify certificate
  static async verifyCertificate(certificateNumber: string, verificationCode: string): Promise<Certificate | null> {
    try {
      const snapshot = await getDocs(
        query(
          collection(db, COLLECTIONS.CERTIFICATES || 'certificates'),
          where('certificateNumber', '==', certificateNumber),
          where('verificationCode', '==', verificationCode),
          where('status', '==', 'Active')
        )
      );

      if (snapshot.empty) {
        return null;
      }

      const certDoc = snapshot.docs[0];
      return {
        id: certDoc.id,
        ...certDoc.data(),
        issuedAt: certDoc.data().issuedAt?.toDate() || new Date(),
      } as Certificate;
    } catch (error) {
      console.error('Error verifying certificate:', error);
      throw error;
    }
  }

  // Create learning path
  static async createLearningPath(pathData: Omit<LearningPath, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const newPath = {
        ...pathData,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };
      
      const docRef = await addDoc(collection(db, COLLECTIONS.LEARNING_PATHS || 'learningPaths'), newPath);
      return docRef.id;
    } catch (error) {
      console.error('Error creating learning path:', error);
      throw error;
    }
  }

  // Update learning path
  static async updateLearningPath(pathId: string, updates: Partial<LearningPath>): Promise<void> {
    try {
      const pathRef = doc(db, COLLECTIONS.LEARNING_PATHS || 'learningPaths', pathId);
      await updateDoc(pathRef, {
        ...updates,
        updatedAt: Timestamp.now(),
      });
    } catch (error) {
      console.error('Error updating learning path:', error);
      throw error;
    }
  }

  // Delete learning path
  static async deleteLearningPath(pathId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, COLLECTIONS.LEARNING_PATHS || 'learningPaths', pathId));
    } catch (error) {
      console.error('Error deleting learning path:', error);
      throw error;
    }
  }
}

