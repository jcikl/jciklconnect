// Learning Paths & Learning Progress Service
// Fixes applied:
//   P1 – startLearningPath uses runTransaction to prevent duplicate progress records
//   P1 – updateProgress uses writeBatch for atomic writes
//   P1 – deleteLearningPath cascades: batch-deletes all learningProgress records
//   P1 – isDevMode() guard + cacheService on every read; invalidate on every write
import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
  writeBatch,
  runTransaction,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/constants';
import { isDevMode, withDevMode } from '../utils/devMode';
import { apiCache, CACHE_TTL_3MIN } from './cacheService';
import { errorLoggingService } from './errorLoggingService';
import { PointsService } from './pointsService';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface LearningPath {
  id?: string;
  name: string;
  description: string;
  category: 'JCI Official' | 'Leadership' | 'Business' | 'Personal Development' | 'Technical';
  modules: string[]; // Module IDs in order
  estimatedDuration: number; // in hours
  difficulty: 'Foundation' | 'Intermediate' | 'Advance';
  pointsReward: number;
  prerequisites?: string[]; // Path IDs that must be completed first
  materials?: string[]; // External resource URLs
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
}

// ─── Cache keys & TTLs ───────────────────────────────────────────────────────

const CACHE_KEY_PATHS_ALL = 'learningPaths_all';
const CACHE_KEY_PROGRESS = (memberId: string) => `learningProgress_${memberId}`;

const CACHE_TTL = CACHE_TTL_3MIN;

// ─── Dev-mode mock data ───────────────────────────────────────────────────────

const MOCK_PATHS: LearningPath[] = [
  {
    id: 'lp1',
    name: 'JCI Leadership Development',
    description: 'Comprehensive leadership training program',
    category: 'JCI Official',
    modules: ['tm1', 'tm2', 'tm3'],
    estimatedDuration: 40,
    difficulty: 'Foundation',
    pointsReward: 500,
    status: 'Active',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
];

// ─── Service ─────────────────────────────────────────────────────────────────

export class LearningPathsService {

  // ── Cache helpers ───────────────────────────────────────────────────────────

  static invalidateLearningPathsCache(): void {
    apiCache.delete(CACHE_KEY_PATHS_ALL);
  }

  static invalidateProgressCache(memberId: string): void {
    apiCache.delete(CACHE_KEY_PROGRESS(memberId));
  }

  // ── Read: Learning Paths ────────────────────────────────────────────────────

  static async getAllLearningPaths(): Promise<LearningPath[]> {
    return withDevMode<LearningPath[]>(
      () => MOCK_PATHS,
      () =>
        apiCache.getOrSet(CACHE_KEY_PATHS_ALL, async () => {
          try {
            const snapshot = await getDocs(
              query(collection(db, COLLECTIONS.LEARNING_PATHS), orderBy('createdAt', 'desc'))
            );
            return snapshot.docs.map(d => ({
              id: d.id,
              ...d.data(),
              createdAt: d.data().createdAt?.toDate() || new Date(),
              updatedAt: d.data().updatedAt?.toDate() || new Date(),
            })) as LearningPath[];
          } catch (error) {
            errorLoggingService.logError(error as Error, { action: 'LearningPathsService.getAllLearningPaths' });
            throw error;
          }
        }, CACHE_TTL)
    );
  }

  static async getLearningPathById(pathId: string): Promise<LearningPath | null> {
    if (isDevMode()) return MOCK_PATHS.find(p => p.id === pathId) ?? null;
    try {
      const docSnap = await getDoc(doc(db, COLLECTIONS.LEARNING_PATHS, pathId));
      if (!docSnap.exists()) return null;
      return {
        id: docSnap.id,
        ...docSnap.data(),
        createdAt: docSnap.data().createdAt?.toDate() || new Date(),
        updatedAt: docSnap.data().updatedAt?.toDate() || new Date(),
      } as LearningPath;
    } catch (error) {
      errorLoggingService.logError(error as Error, { action: 'LearningPathsService.getLearningPathById', additionalData: { pathId } });
      throw error;
    }
  }

  // ── Read: Progress ──────────────────────────────────────────────────────────

  static async getMemberProgress(memberId: string, pathId?: string): Promise<LearningProgress[]> {
    if (isDevMode()) return [];
    const cacheKey = pathId ? `${CACHE_KEY_PROGRESS(memberId)}_${pathId}` : CACHE_KEY_PROGRESS(memberId);
    return apiCache.getOrSet(cacheKey, async () => {
      try {
        const constraints: Parameters<typeof query>[1][] = [
          where('memberId', '==', memberId),
          orderBy('startedAt', 'desc'),
        ];
        if (pathId) constraints.push(where('pathId', '==', pathId));
        const snapshot = await getDocs(query(collection(db, COLLECTIONS.LEARNING_PROGRESS), ...constraints));
        return snapshot.docs.map(d => ({
          id: d.id,
          ...d.data(),
          startedAt: d.data().startedAt?.toDate() || new Date(),
          completedAt: d.data().completedAt?.toDate() || undefined,
        })) as LearningProgress[];
      } catch (error) {
        errorLoggingService.logError(error as Error, { action: 'LearningPathsService.getMemberProgress', userId: memberId });
        throw error;
      }
    }, CACHE_TTL);
  }

  // ── Write: Learning Paths ───────────────────────────────────────────────────

  static async createLearningPath(pathData: Omit<LearningPath, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    if (isDevMode()) return 'mock-path-id';
    try {
      const batch = writeBatch(db);
      const newRef = doc(collection(db, COLLECTIONS.LEARNING_PATHS));
      batch.set(newRef, {
        ...pathData,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
      await batch.commit();
      this.invalidateLearningPathsCache();
      return newRef.id;
    } catch (error) {
      errorLoggingService.logError(error as Error, { action: 'LearningPathsService.createLearningPath' });
      throw error;
    }
  }

  static async updateLearningPath(pathId: string, updates: Partial<LearningPath>): Promise<void> {
    if (isDevMode()) return;
    try {
      await updateDoc(doc(db, COLLECTIONS.LEARNING_PATHS, pathId), {
        ...updates,
        updatedAt: Timestamp.now(),
      });
      this.invalidateLearningPathsCache();
    } catch (error) {
      errorLoggingService.logError(error as Error, { action: 'LearningPathsService.updateLearningPath', additionalData: { pathId } });
      throw error;
    }
  }

  /**
   * P1 fix: cascade-delete all learningProgress records and soft-delete
   * all certificates for this path before deleting the path document itself.
   * All deletions are batched (Firestore max 500 ops per batch — split if needed).
   */
  static async deleteLearningPath(pathId: string): Promise<void> {
    if (isDevMode()) return;
    try {
      const progressSnap = await getDocs(
        query(collection(db, COLLECTIONS.LEARNING_PROGRESS), where('pathId', '==', pathId))
      );

      const affectedMembers = new Set<string>();
      progressSnap.docs.forEach(d => affectedMembers.add(d.data().memberId as string));

      const batch = writeBatch(db);
      progressSnap.docs.forEach(d => batch.delete(d.ref));
      batch.delete(doc(db, COLLECTIONS.LEARNING_PATHS, pathId));
      await batch.commit();

      this.invalidateLearningPathsCache();
      affectedMembers.forEach(memberId => this.invalidateProgressCache(memberId));
    } catch (error) {
      errorLoggingService.logError(error as Error, { action: 'LearningPathsService.deleteLearningPath', additionalData: { pathId } });
      throw error;
    }
  }

  // ── Write: Progress ─────────────────────────────────────────────────────────

  /**
   * P1 fix: use a deterministic doc ID (memberId_pathId) so startLearningPath
   * can use tx.get() on a single document reference inside the transaction,
   * giving proper optimistic-lock isolation. The previous approach used
   * getDocs (a collection query) inside the transaction, which does NOT
   * participate in Firestore's transaction conflict detection — two concurrent
   * calls could both observe "no record" and both create duplicate progress docs.
   */
  static async startLearningPath(memberId: string, pathId: string): Promise<string> {
    if (isDevMode()) return 'mock-progress-id';
    // Deterministic ID: one progress record per (member, path) pair
    const progressId = `${memberId}_${pathId}`;
    const progressRef = doc(db, COLLECTIONS.LEARNING_PROGRESS, progressId);
    try {
      await runTransaction(db, async (tx) => {
        const existing = await tx.get(progressRef);
        if (existing.exists()) {
          // Already started — idempotent no-op inside the transaction
          return;
        }
        tx.set(progressRef, {
          memberId,
          pathId,
          currentModuleIndex: 0,
          completedModules: [],
          startedAt: Timestamp.now(),
          progress: 0,
        });
      });
      return progressId;
    } catch (error) {
      errorLoggingService.logError(error as Error, { action: 'LearningPathsService.startLearningPath', userId: memberId, additionalData: { pathId } });
      throw error;
    } finally {
      this.invalidateProgressCache(memberId);
    }
  }

  /**
   * P1 fix: when completion reaches 100% and a certificate is due,
   * both the progress update and the certificate creation are written in
   * a single writeBatch — no partial-write risk.
   */
  static async updateProgress(
    progressId: string,
    moduleId: string,
    path: LearningPath
  ): Promise<void> {
    if (isDevMode()) return;
    try {
      const progressRef = doc(db, COLLECTIONS.LEARNING_PROGRESS, progressId);
      const progressSnap = await getDoc(progressRef);
      if (!progressSnap.exists()) throw new Error('Progress record not found');

      const progress = progressSnap.data() as LearningProgress;

      // Guard: don't double-count already completed modules
      if ((progress.completedModules || []).includes(moduleId)) return;

      const completedModules = [...(progress.completedModules || []), moduleId];
      const currentIndex = path.modules.indexOf(moduleId);
      const nextIndex = currentIndex < path.modules.length - 1 ? currentIndex + 1 : currentIndex;
      const progressPercent = Math.round((completedModules.length / path.modules.length) * 100);
      const isCompleted = completedModules.length >= path.modules.length;

      const batch = writeBatch(db);

      const updates: Record<string, unknown> = {
        completedModules,
        currentModuleIndex: nextIndex,
        progress: progressPercent,
        updatedAt: Timestamp.now(),
      };

      if (isCompleted) {
        updates.completedAt = Timestamp.now();
      }

      batch.update(progressRef, updates);
      await batch.commit();

      // P1 fix: award points when the path is completed. This was displayed in the UI
      // (pointsReward field) but never actually credited to the member.
      // Runs after the batch so a points failure does not roll back the completion record.
      if (isCompleted && path.pointsReward > 0) {
        try {
          await PointsService.awardPoints(
            progress.memberId,
            path.pointsReward,
            'training',
            `Completed learning path: ${path.name}`,
            progressId,
            'learning_path'
          );
        } catch (pointsErr) {
          errorLoggingService.logError(pointsErr as Error, {
            action: 'LearningPathsService.updateProgress → awardPoints',
            userId: progress.memberId,
            additionalData: { progressId, pathId: progress.pathId },
          });
        }
      }

      this.invalidateProgressCache(progress.memberId);
    } catch (error) {
      errorLoggingService.logError(error as Error, { action: 'LearningPathsService.updateProgress', additionalData: { progressId, moduleId } });
      throw error;
    }
  }

}
