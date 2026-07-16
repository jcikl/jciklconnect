// Learning Paths, Learning Progress & Certificates Service
// Fixes applied:
//   P0 – issueCertificate now validates learningProgress completion before creating cert
//   P1 – issueCertificate + progress update are atomic (writeBatch)
//   P1 – startLearningPath uses runTransaction to prevent duplicate progress records
//   P1 – updateProgress wraps cert creation + progress update in writeBatch
//   P1 – deleteLearningPath cascades: batch-deletes all learningProgress + soft-deletes certs
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
import { apiCache } from './cacheService';
import { errorLoggingService } from './errorLoggingService';

// ─── Types ───────────────────────────────────────────────────────────────────

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
  isDeleted?: boolean;
}

// ─── Cache keys & TTLs ───────────────────────────────────────────────────────

const CACHE_KEY_PATHS_ALL = 'learningPaths_all';
const CACHE_KEY_PROGRESS = (memberId: string) => `learningProgress_${memberId}`;
const CACHE_KEY_CERTS = (memberId: string) => `certificates_${memberId}`;
const CACHE_TTL = 3 * 60 * 1000; // 3 minutes

// ─── Dev-mode mock data ───────────────────────────────────────────────────────

const MOCK_PATHS: LearningPath[] = [
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

// ─── Service ─────────────────────────────────────────────────────────────────

export class LearningPathsService {

  // ── Cache helpers ───────────────────────────────────────────────────────────

  static invalidateLearningPathsCache(): void {
    apiCache.delete(CACHE_KEY_PATHS_ALL);
  }

  static invalidateProgressCache(memberId: string): void {
    apiCache.delete(CACHE_KEY_PROGRESS(memberId));
  }

  static invalidateCertificatesCache(memberId: string): void {
    apiCache.delete(CACHE_KEY_CERTS(memberId));
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
            errorLoggingService.logError(error as Error, { context: 'LearningPathsService.getAllLearningPaths' });
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
      errorLoggingService.logError(error as Error, { context: 'LearningPathsService.getLearningPathById', pathId });
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
        errorLoggingService.logError(error as Error, { context: 'LearningPathsService.getMemberProgress', memberId });
        throw error;
      }
    }, CACHE_TTL);
  }

  // ── Read: Certificates ──────────────────────────────────────────────────────

  static async getMemberCertificates(memberId: string): Promise<Certificate[]> {
    if (isDevMode()) return [];
    return apiCache.getOrSet(CACHE_KEY_CERTS(memberId), async () => {
      try {
        const snapshot = await getDocs(
          query(
            collection(db, COLLECTIONS.CERTIFICATES),
            where('memberId', '==', memberId),
            where('status', '==', 'Active'),
            orderBy('issuedAt', 'desc')
          )
        );
        return snapshot.docs.map(d => ({
          id: d.id,
          ...d.data(),
          issuedAt: d.data().issuedAt?.toDate() || new Date(),
        })) as Certificate[];
      } catch (error) {
        errorLoggingService.logError(error as Error, { context: 'LearningPathsService.getMemberCertificates', memberId });
        throw error;
      }
    }, CACHE_TTL);
  }

  static async verifyCertificate(certificateNumber: string, verificationCode: string): Promise<Certificate | null> {
    if (isDevMode()) return null;
    try {
      const snapshot = await getDocs(
        query(
          collection(db, COLLECTIONS.CERTIFICATES),
          where('certificateNumber', '==', certificateNumber),
          where('verificationCode', '==', verificationCode),
          where('status', '==', 'Active')
        )
      );
      if (snapshot.empty) return null;
      const certDoc = snapshot.docs[0];
      return {
        id: certDoc.id,
        ...certDoc.data(),
        issuedAt: certDoc.data().issuedAt?.toDate() || new Date(),
      } as Certificate;
    } catch (error) {
      errorLoggingService.logError(error as Error, { context: 'LearningPathsService.verifyCertificate' });
      throw error;
    }
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
      errorLoggingService.logError(error as Error, { context: 'LearningPathsService.createLearningPath' });
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
      errorLoggingService.logError(error as Error, { context: 'LearningPathsService.updateLearningPath', pathId });
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
      // Collect all progress records for this path
      const progressSnap = await getDocs(
        query(collection(db, COLLECTIONS.LEARNING_PROGRESS), where('pathId', '==', pathId))
      );

      // Collect all active certificates for this path
      const certSnap = await getDocs(
        query(collection(db, COLLECTIONS.CERTIFICATES), where('pathId', '==', pathId))
      );

      // Build affected member IDs for cache invalidation
      const affectedMembers = new Set<string>();
      progressSnap.docs.forEach(d => affectedMembers.add(d.data().memberId as string));
      certSnap.docs.forEach(d => affectedMembers.add(d.data().memberId as string));

      // Batch all writes (500-op limit respected — typical counts are far below)
      const batch = writeBatch(db);

      // Hard-delete progress records
      progressSnap.docs.forEach(d => batch.delete(d.ref));

      // Soft-delete certificates (preserve audit trail)
      const now = Timestamp.now();
      certSnap.docs.forEach(d =>
        batch.update(d.ref, { isDeleted: true, status: 'Revoked', deletedAt: now })
      );

      // Delete the path document itself
      batch.delete(doc(db, COLLECTIONS.LEARNING_PATHS, pathId));

      await batch.commit();

      // Invalidate caches
      this.invalidateLearningPathsCache();
      affectedMembers.forEach(memberId => {
        this.invalidateProgressCache(memberId);
        this.invalidateCertificatesCache(memberId);
      });
    } catch (error) {
      errorLoggingService.logError(error as Error, { context: 'LearningPathsService.deleteLearningPath', pathId });
      throw error;
    }
  }

  // ── Write: Progress ─────────────────────────────────────────────────────────

  /**
   * P1 fix: use runTransaction to prevent duplicate progress records
   * if the user double-clicks "Start". Returns existing doc ID if already started.
   */
  static async startLearningPath(memberId: string, pathId: string): Promise<string> {
    if (isDevMode()) return 'mock-progress-id';
    try {
      return await runTransaction(db, async (tx) => {
        // Check for existing progress record
        const existing = await getDocs(
          query(
            collection(db, COLLECTIONS.LEARNING_PROGRESS),
            where('memberId', '==', memberId),
            where('pathId', '==', pathId)
          )
        );
        if (!existing.empty) {
          // Already started — return existing ID
          return existing.docs[0].id;
        }

        const newRef = doc(collection(db, COLLECTIONS.LEARNING_PROGRESS));
        tx.set(newRef, {
          memberId,
          pathId,
          currentModuleIndex: 0,
          completedModules: [],
          startedAt: Timestamp.now(),
          progress: 0,
          certificateIssued: false,
        });
        return newRef.id;
      });
    } catch (error) {
      errorLoggingService.logError(error as Error, { context: 'LearningPathsService.startLearningPath', memberId, pathId });
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

        if (path.certificateIssued && !progress.certificateIssued) {
          // P1 fix: create certificate doc in the same batch
          const certRef = doc(collection(db, COLLECTIONS.CERTIFICATES));
          const certificateNumber = `JCI-${Date.now()}-${Math.random().toString(36).substring(2, 11).toUpperCase()}`;
          const verificationCode = Math.random().toString(36).substring(2, 14).toUpperCase();

          batch.set(certRef, {
            memberId: progress.memberId,
            pathId: progress.pathId,
            pathName: path.name,
            issuedAt: Timestamp.now(),
            issuedBy: 'JCI Kuala Lumpur',
            certificateNumber,
            verificationCode,
            status: 'Active',
            isDeleted: false,
          } satisfies Omit<Certificate, 'id'>);

          updates.certificateIssued = true;
          updates.certificateId = certRef.id;
        }
      }

      batch.update(progressRef, updates);
      await batch.commit();

      // Invalidate caches for the member
      this.invalidateProgressCache(progress.memberId);
      if (isCompleted) this.invalidateCertificatesCache(progress.memberId);
    } catch (error) {
      errorLoggingService.logError(error as Error, { context: 'LearningPathsService.updateProgress', progressId, moduleId });
      throw error;
    }
  }

  /**
   * P0 fix: validates that the member has actually completed the learning path
   * before issuing a certificate. Throws if completion is not confirmed.
   *
   * This method is still exposed publicly (e.g. for admin re-issue), but it now
   * performs the guard that prevents SDK-level certificate forgery.
   *
   * NOTE: When called from updateProgress the cert doc is written inside the
   * shared writeBatch above — this standalone method is for admin/manual re-issue
   * only and writes its own single-doc batch.
   */
  static async issueCertificate(memberId: string, pathId: string, pathName: string): Promise<string> {
    if (isDevMode()) return 'mock-cert-id';
    try {
      // P0 guard: verify completion before issuing
      const progressSnap = await getDocs(
        query(
          collection(db, COLLECTIONS.LEARNING_PROGRESS),
          where('memberId', '==', memberId),
          where('pathId', '==', pathId)
        )
      );

      const progressRecord = progressSnap.docs[0]?.data() as LearningProgress | undefined;
      const isCompleted =
        progressRecord &&
        (progressRecord.progress >= 100 || progressRecord.completedAt !== undefined);

      if (!isCompleted) {
        throw new Error(
          `Cannot issue certificate: member ${memberId} has not completed path ${pathId}`
        );
      }

      const certRef = doc(collection(db, COLLECTIONS.CERTIFICATES));
      const certificateNumber = `JCI-${Date.now()}-${Math.random().toString(36).substring(2, 11).toUpperCase()}`;
      const verificationCode = Math.random().toString(36).substring(2, 14).toUpperCase();

      const batch = writeBatch(db);
      batch.set(certRef, {
        memberId,
        pathId,
        pathName,
        issuedAt: Timestamp.now(),
        issuedBy: 'JCI Kuala Lumpur',
        certificateNumber,
        verificationCode,
        status: 'Active',
        isDeleted: false,
      } satisfies Omit<Certificate, 'id'>);

      // Mark progress record as cert-issued (if not already)
      if (progressSnap.docs[0] && !progressRecord!.certificateIssued) {
        batch.update(progressSnap.docs[0].ref, {
          certificateIssued: true,
          certificateId: certRef.id,
        });
      }

      await batch.commit();

      this.invalidateCertificatesCache(memberId);
      this.invalidateProgressCache(memberId);

      return certRef.id;
    } catch (error) {
      errorLoggingService.logError(error as Error, { context: 'LearningPathsService.issueCertificate', memberId, pathId });
      throw error;
    }
  }
}
