// Knowledge & Learning Service - CRUD Operations
// Fixes applied:
//   P1 – isDevMode() guard on every write path
//   P1 – cacheService.getOrSet on every read; invalidateTrainingModulesCache() after every write
//   P1 – completionStatus is per-member, not per-module: updateTrainingModule strips it;
//         markModuleComplete writes to LEARNING_PROGRESS instead
//   P1 – writeBatch for create/update (single-doc ops, but pattern-compliant)
//   P1 – errorLoggingService replaces console.error
import {
  collection,
  doc,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
  writeBatch,
  arrayRemove,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/constants';
import { TrainingModule, Document } from '../types';
import { isDevMode, withDevMode } from '../utils/devMode';
import { apiCache, CACHE_TTL_3MIN } from './cacheService';
import { errorLoggingService } from './errorLoggingService';
import { MOCK_TRAININGS, MOCK_DOCUMENTS } from './mockData';

// ─── Cache keys & TTLs ───────────────────────────────────────────────────────

const CACHE_KEY_MODULES_ALL = 'trainingModules_all';
const CACHE_KEY_MODULE = (id: string) => `trainingModule_${id}`;
const CACHE_TTL = CACHE_TTL_3MIN;

export class KnowledgeService {

  // ── Cache helpers ──────────────────────────────────────────────────────────

  static invalidateTrainingModulesCache(): void {
    apiCache.deleteByPrefix('trainingModule');
  }

  // ── Read: Training Modules ─────────────────────────────────────────────────

  // Get all training modules
  static async getAllTrainingModules(): Promise<TrainingModule[]> {
    return withDevMode(
      () => MOCK_TRAININGS,
      () =>
        apiCache.getOrSet(CACHE_KEY_MODULES_ALL, async () => {
          try {
            const snapshot = await getDocs(
              query(collection(db, COLLECTIONS.TRAINING_MODULES), orderBy('title', 'asc'))
            );
            return snapshot.docs
              .filter(d => !d.data().isDeleted)
              .map(d => ({
                id: d.id,
                ...d.data(),
              } as TrainingModule));
          } catch (error) {
            errorLoggingService.logError(error as Error, { action: 'KnowledgeService.getAllTrainingModules' });
            throw error;
          }
        }, CACHE_TTL)
    );
  }

  // Get training module by ID
  static async getTrainingModuleById(moduleId: string): Promise<TrainingModule | null> {
    if (isDevMode()) return MOCK_TRAININGS.find(m => m.id === moduleId) ?? null;
    return apiCache.getOrSet(CACHE_KEY_MODULE(moduleId), async () => {
      try {
        const docSnap = await getDoc(doc(db, COLLECTIONS.TRAINING_MODULES, moduleId));
        if (!docSnap.exists()) return null;
        return { id: docSnap.id, ...docSnap.data() } as TrainingModule;
      } catch (error) {
        errorLoggingService.logError(error as Error, { action: 'KnowledgeService.getTrainingModuleById', additionalData: { moduleId } });
        throw error;
      }
    }, CACHE_TTL);
  }

  // ── Write: Training Modules ────────────────────────────────────────────────

  // Create training module
  // Note: completionStatus is a per-member concept — it must NOT be stored on the
  // module document. Use markModuleComplete() to record per-member completion.
  static async createTrainingModule(moduleData: Omit<TrainingModule, 'id'>): Promise<string> {
    if (isDevMode()) return `mock-module-${Date.now()}`;
    try {
      // Strip completionStatus — it is per-member, not per-module
      const { completionStatus: _cs, ...safeData } = moduleData as any;
      const batch = writeBatch(db);
      const newRef = doc(collection(db, COLLECTIONS.TRAINING_MODULES));
      batch.set(newRef, {
        ...safeData,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
      await batch.commit();
      this.invalidateTrainingModulesCache();
      return newRef.id;
    } catch (error) {
      errorLoggingService.logError(error as Error, { action: 'KnowledgeService.createTrainingModule' });
      throw error;
    }
  }

  // Update training module
  // completionStatus is stripped — it must go through markModuleComplete() instead.
  static async updateTrainingModule(moduleId: string, updates: Partial<TrainingModule>): Promise<void> {
    if (isDevMode()) return;
    try {
      // Strip per-member field that must never be stored on the shared module document
      const { completionStatus: _cs, ...safeUpdates } = updates as any;
      const batch = writeBatch(db);
      batch.update(doc(db, COLLECTIONS.TRAINING_MODULES, moduleId), {
        ...safeUpdates,
        updatedAt: Timestamp.now(),
      });
      await batch.commit();
      this.invalidateTrainingModulesCache();
    } catch (error) {
      errorLoggingService.logError(error as Error, { action: 'KnowledgeService.updateTrainingModule', additionalData: { moduleId } });
      throw error;
    }
  }

  /**
   * Soft-delete a training module and remove its ID from any learning paths that
   * reference it. Hard-deleting would leave learningPaths.modules arrays with
   * stale IDs, causing progress calculations to break.
   *
   * P1 fix: method was entirely missing — added here.
   */
  static async deleteTrainingModule(moduleId: string): Promise<void> {
    if (isDevMode()) {
      console.log(`[DEV MODE] deleteTrainingModule: ${moduleId}`);
      return;
    }
    try {
      // Find all learning paths that include this module
      const pathsSnap = await getDocs(
        query(
          collection(db, COLLECTIONS.LEARNING_PATHS),
          where('modules', 'array-contains', moduleId)
        )
      );

      const batch = writeBatch(db);

      // Soft-delete the module document
      batch.update(doc(db, COLLECTIONS.TRAINING_MODULES, moduleId), {
        isDeleted: true,
        deletedAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });

      // Remove the module ID from every referencing learning path
      pathsSnap.docs.forEach(d =>
        batch.update(d.ref, {
          modules: arrayRemove(moduleId),
          updatedAt: Timestamp.now(),
        })
      );

      await batch.commit();
      this.invalidateTrainingModulesCache();
    } catch (error) {
      errorLoggingService.logError(error as Error, { action: 'KnowledgeService.deleteTrainingModule', additionalData: { moduleId } });
      throw error;
    }
  }

  /**
   * Mark a specific module as complete for a member.
   *
   * Completion state is per-member — it is stored in LEARNING_PROGRESS, NOT on the
   * shared trainingModule document. Writing completionStatus to the module doc would
   * make it look completed (or not) for ALL members simultaneously.
   *
   * Document ID convention: `{memberId}_{moduleId}` so reads are O(1) by key.
   */
  static async markModuleComplete(memberId: string, moduleId: string): Promise<void> {
    if (isDevMode()) return;
    try {
      const progressRef = doc(
        db,
        COLLECTIONS.LEARNING_PROGRESS,
        `${memberId}_modules_${moduleId}`
      );

      // Guard: skip if already marked complete to prevent double-awarding points
      const existing = await getDoc(progressRef);
      if (existing.exists() && existing.data().completionStatus === 'Completed') return;

      const batch = writeBatch(db);
      batch.set(progressRef, {
        memberId,
        moduleId,
        completionStatus: 'Completed',
        completedAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      }, { merge: true });
      await batch.commit();
      // No training-modules cache to invalidate — this is in LEARNING_PROGRESS

      // P1 fix: award points if module has a pointsReward > 0
      const moduleSnap = await getDoc(doc(db, COLLECTIONS.TRAINING_MODULES, moduleId));
      if (moduleSnap.exists()) {
        const moduleData = moduleSnap.data() as TrainingModule;
        if (moduleData.pointsReward && moduleData.pointsReward > 0) {
          const { PointsService } = await import('./pointsService');
          await PointsService.awardPoints(
            memberId,
            moduleData.pointsReward,
            'training',
            `Completed training module: ${moduleData.title}`,
            moduleId,
            'trainingModule'
          ).catch(err =>
            errorLoggingService.logError(err as Error, {
              action: 'KnowledgeService.markModuleComplete.awardPoints',
              additionalData: { memberId, moduleId },
            })
          );
        }
      }

      // P1 fix: check if all modules in any learning path containing this module are
      // now complete, and trigger certificate issuance if so.
      const pathsSnap = await getDocs(
        query(
          collection(db, COLLECTIONS.LEARNING_PATHS),
          where('modules', 'array-contains', moduleId),
          where('status', '==', 'Active')
        )
      );

      if (!pathsSnap.empty) {
        const completions = await this.getMemberModuleCompletions(
          memberId,
          // Gather all unique module IDs across matching paths
          [...new Set(pathsSnap.docs.flatMap(d => (d.data().modules || []) as string[]))]
        );

        for (const pathDoc of pathsSnap.docs) {
          const path = pathDoc.data();
          const pathModules: string[] = path.modules || [];
          const allDone = pathModules.length > 0 &&
            pathModules.every(id => completions[id] === 'Completed');

          if (allDone && path.certificateIssued) {
            const { LearningPathsService } = await import('./learningPathsService');
            await LearningPathsService.issueCertificate(
              memberId,
              pathDoc.id,
              path.name || ''
            ).catch(err =>
              errorLoggingService.logError(err as Error, {
                action: 'KnowledgeService.markModuleComplete.issueCertificate',
                additionalData: { memberId, pathId: pathDoc.id },
              })
            );
          }
        }
      }
    } catch (error) {
      errorLoggingService.logError(error as Error, { action: 'KnowledgeService.markModuleComplete', additionalData: { memberId, moduleId } });
      throw error;
    }
  }

  /**
   * Get per-member completion status for a set of module IDs.
   * Returns a map of moduleId → completionStatus.
   */
  static async getMemberModuleCompletions(
    memberId: string,
    moduleIds: string[]
  ): Promise<Record<string, 'Not Started' | 'In Progress' | 'Completed'>> {
    if (isDevMode()) {
      return Object.fromEntries(moduleIds.map(id => [id, 'Not Started']));
    }
    try {
      const docRefs = moduleIds.map(moduleId =>
        doc(db, COLLECTIONS.LEARNING_PROGRESS, `${memberId}_modules_${moduleId}`)
      );
      const snapshots = await Promise.all(docRefs.map(ref => getDoc(ref)));
      const result: Record<string, 'Not Started' | 'In Progress' | 'Completed'> = {};
      snapshots.forEach((snap, i) => {
        result[moduleIds[i]] = (snap.exists() ? snap.data().completionStatus : 'Not Started') as
          'Not Started' | 'In Progress' | 'Completed';
      });
      return result;
    } catch (error) {
      errorLoggingService.logError(error as Error, { action: 'KnowledgeService.getMemberModuleCompletions', additionalData: { memberId } });
      throw error;
    }
  }

  // ── Read/Write: Documents ─────────────────────────────────────────────────

  // Get all documents
  static async getAllDocuments(): Promise<Document[]> {
    return withDevMode(
      () => MOCK_DOCUMENTS,
      async () => {
        try {
          const snapshot = await getDocs(
            query(collection(db, COLLECTIONS.DOCUMENTS), orderBy('uploadedDate', 'desc'))
          );
          return snapshot.docs.map(d => ({
            id: d.id,
            ...d.data(),
            uploadedDate: d.data().uploadedDate?.toDate?.()?.toISOString() || d.data().uploadedDate,
          } as Document));
        } catch (error) {
          errorLoggingService.logError(error as Error, { action: 'KnowledgeService.getAllDocuments' });
          throw error;
        }
      }
    );
  }

  // Create document
  static async createDocument(documentData: Omit<Document, 'id'>): Promise<string> {
    if (isDevMode()) return `mock-doc-${Date.now()}`;
    try {
      const batch = writeBatch(db);
      const newRef = doc(collection(db, COLLECTIONS.DOCUMENTS));
      batch.set(newRef, {
        ...documentData,
        uploadedDate: Timestamp.now(),
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
      await batch.commit();
      return newRef.id;
    } catch (error) {
      errorLoggingService.logError(error as Error, { action: 'KnowledgeService.createDocument' });
      throw error;
    }
  }

  // Delete document
  static async deleteDocument(documentId: string): Promise<void> {
    if (isDevMode()) return;
    try {
      await deleteDoc(doc(db, COLLECTIONS.DOCUMENTS, documentId));
    } catch (error) {
      errorLoggingService.logError(error as Error, { action: 'KnowledgeService.deleteDocument', additionalData: { documentId } });
      throw error;
    }
  }

  // Get documents by category
  static async getDocumentsByCategory(category: Document['category']): Promise<Document[]> {
    if (isDevMode()) return MOCK_DOCUMENTS.filter(d => d.category === category);
    try {
      const snapshot = await getDocs(
        query(
          collection(db, COLLECTIONS.DOCUMENTS),
          where('category', '==', category),
          orderBy('uploadedDate', 'desc')
        )
      );
      return snapshot.docs.map(d => ({
        id: d.id,
        ...d.data(),
        uploadedDate: d.data().uploadedDate?.toDate?.()?.toISOString() || d.data().uploadedDate,
      } as Document));
    } catch (error) {
      errorLoggingService.logError(error as Error, { action: 'KnowledgeService.getDocumentsByCategory', additionalData: { category } });
      throw error;
    }
  }

  // Search documents
  static async searchDocuments(searchTerm: string): Promise<Document[]> {
    const allDocs = await this.getAllDocuments();
    const term = searchTerm.toLowerCase();
    return allDocs.filter(d =>
      d.name.toLowerCase().includes(term) ||
      d.description?.toLowerCase().includes(term) ||
      d.category?.toLowerCase().includes(term)
    );
  }

  // Search training modules
  static async searchTrainingModules(searchTerm: string): Promise<TrainingModule[]> {
    const allModules = await this.getAllTrainingModules();
    const term = searchTerm.toLowerCase();
    return allModules.filter(m =>
      m.title.toLowerCase().includes(term) ||
      m.type?.toLowerCase().includes(term)
    );
  }

  // Get all unique document categories
  static async getAllCategories(): Promise<string[]> {
    const allDocs = await this.getAllDocuments();
    const categories = new Set<string>();
    allDocs.forEach(d => { if (d.category) categories.add(d.category); });
    return Array.from(categories).sort();
  }
}
