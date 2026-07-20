// Documents Service with Version Control
import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  Timestamp,
  writeBatch,
  runTransaction,
} from 'firebase/firestore';
import { getStorage, ref as storageRef, deleteObject } from 'firebase/storage';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/constants';
import { withDevMode } from '../utils/devMode';
import { apiCache, CACHE_TTL_3MIN } from './cacheService';
import { errorLoggingService } from './errorLoggingService';
import { Document } from '../types';

const CACHE_KEY_ALL_DOCUMENTS = 'documents:all';
const cacheKeyById = (id: string) => `documents:${id}`;
const cacheKeyVersions = (id: string) => `documentVersions:${id}`;

export interface DocumentVersion {
  id?: string;
  documentId: string;
  version: number;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  uploadedBy: string;
  uploadedAt: Date | Timestamp;
  changeLog?: string;
  isCurrent: boolean;
}

export interface DocumentWithVersions extends Document {
  versions?: DocumentVersion[];
  currentVersion?: DocumentVersion;
  versionCount?: number;
}

const MOCK_DOCUMENT: DocumentWithVersions = {
  id: 'd1',
  name: 'JCI Constitution 2024',
  type: 'PDF',
  category: 'Policy',
  uploadedDate: '2024-01-15',
  size: '2.5 MB',
  versions: [],
  versionCount: 1,
};

const MOCK_VERSION: DocumentVersion = {
  id: 'v1',
  documentId: 'd1',
  version: 1,
  fileName: 'jci-constitution-2024.pdf',
  fileUrl: 'https://example.com/mock.pdf',
  fileSize: 2621440,
  mimeType: 'application/pdf',
  uploadedBy: 'mock-user',
  uploadedAt: new Date(),
  changeLog: 'Initial version',
  isCurrent: true,
};

export class DocumentsService {
  static invalidateDocumentsCache(documentId?: string): void {
    apiCache.delete(CACHE_KEY_ALL_DOCUMENTS);
    if (documentId) {
      apiCache.delete(cacheKeyById(documentId));
      apiCache.delete(cacheKeyVersions(documentId));
    }
  }

  // Get all documents
  static async getAllDocuments(): Promise<DocumentWithVersions[]> {
    return withDevMode<DocumentWithVersions[]>(
      () => [MOCK_DOCUMENT],
      async () => {
        return apiCache.getOrSet(CACHE_KEY_ALL_DOCUMENTS, async () => {
          const snapshot = await getDocs(
            query(collection(db, COLLECTIONS.DOCUMENTS), orderBy('uploadedDate', 'desc'))
          );

          if (snapshot.empty) return [];

          // Batch-fetch all versions in chunks of 10 to avoid N+1 round-trips
          const chunkArray = <T>(arr: T[], size: number): T[][] =>
            Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, (i + 1) * size));

          const docIds = snapshot.docs.map(d => d.id);
          const versionChunks = chunkArray(docIds, 10);
          const versionResults = await Promise.all(
            versionChunks.map(chunk =>
              getDocs(query(
                collection(db, COLLECTIONS.DOCUMENT_VERSIONS),
                where('documentId', 'in', chunk)
              ))
            )
          );

          // Build Map<docId, DocumentVersion[]> from batch results
          const versionsByDocId = new Map<string, DocumentVersion[]>();
          for (const result of versionResults) {
            for (const d of result.docs) {
              const v = { id: d.id, ...d.data(), uploadedAt: d.data().uploadedAt?.toDate() || new Date() } as DocumentVersion;
              const list = versionsByDocId.get(v.documentId) || [];
              list.push(v);
              versionsByDocId.set(v.documentId, list);
            }
          }

          return snapshot.docs.map(docSnap => {
            const docData = docSnap.data();
            const versions = (versionsByDocId.get(docSnap.id) || []).sort((a, b) => b.version - a.version);
            const currentVersion = versions.find(v => v.isCurrent) || versions[0];
            return {
              id: docSnap.id,
              ...docData,
              uploadedDate: docData.uploadedDate?.toDate?.()?.toISOString() || docData.uploadedDate,
              versions,
              currentVersion,
              versionCount: versions.length,
            } as DocumentWithVersions;
          });
        }, CACHE_TTL_3MIN);
      }
    );
  }

  // Get document by ID
  static async getDocumentById(documentId: string): Promise<DocumentWithVersions | null> {
    return withDevMode<DocumentWithVersions | null>(
      () => (documentId === 'd1' ? MOCK_DOCUMENT : null),
      async () => {
        return apiCache.getOrSet(cacheKeyById(documentId), async () => {
          const docRef = doc(db, COLLECTIONS.DOCUMENTS, documentId);
          const docSnap = await getDoc(docRef);

          if (!docSnap.exists()) return null;

          const versions = await this.getDocumentVersions(documentId);
          const currentVersion = versions.find(v => v.isCurrent) || versions[0];

          return {
            id: docSnap.id,
            ...docSnap.data(),
            uploadedDate: docSnap.data().uploadedDate?.toDate?.()?.toISOString() || docSnap.data().uploadedDate,
            versions,
            currentVersion,
            versionCount: versions.length,
          } as DocumentWithVersions;
        }, CACHE_TTL_3MIN);
      }
    );
  }

  // Get document versions
  static async getDocumentVersions(documentId: string): Promise<DocumentVersion[]> {
    return withDevMode<DocumentVersion[]>(
      () => (documentId === 'd1' ? [MOCK_VERSION] : []),
      async () => {
        return apiCache.getOrSet(cacheKeyVersions(documentId), async () => {
          const snapshot = await getDocs(
            query(
              collection(db, COLLECTIONS.DOCUMENT_VERSIONS),
              where('documentId', '==', documentId),
              orderBy('version', 'desc')
            )
          );

          return snapshot.docs.map(d => ({
            id: d.id,
            ...d.data(),
            uploadedAt: d.data().uploadedAt?.toDate() || new Date(),
          })) as DocumentVersion[];
        }, CACHE_TTL_3MIN);
      }
    );
  }

  // Create document — adds parent doc + initial version in one batch
  static async createDocument(
    documentData: Omit<Document, 'id'>,
    fileUrl: string,
    fileName: string,
    fileSize: number,
    mimeType: string,
    uploadedBy: string,
    changeLog?: string
  ): Promise<string> {
    return withDevMode<string>(
      () => Promise.resolve('mock-doc-id'),
      async () => {
        const now = Timestamp.now();
        try {
          const batch = writeBatch(db);

          // New document ref
          const docRef = doc(collection(db, COLLECTIONS.DOCUMENTS));
          batch.set(docRef, {
            ...documentData,
            uploadedDate: now,
            createdAt: now,
            updatedAt: now,
            latestVersionNumber: 1, // initialise atomic version counter
          });

          // Initial version ref
          const versionRef = doc(collection(db, COLLECTIONS.DOCUMENT_VERSIONS));
          batch.set(versionRef, {
            documentId: docRef.id,
            version: 1,
            fileName,
            fileUrl,
            fileSize,
            mimeType,
            uploadedBy,
            changeLog: changeLog || 'Initial version',
            isCurrent: true,
            uploadedAt: now,
          });

          await batch.commit();
          this.invalidateDocumentsCache(docRef.id);
          return docRef.id;
        } catch (error) {
          errorLoggingService.logError(error as Error, { component: 'DocumentsService', action: 'createDocument' });
          throw error;
        }
      }
    );
  }

  // Create document version — batch: mark old current→false, add new version, update parent
  static async createDocumentVersion(
    documentId: string,
    versionData: Omit<DocumentVersion, 'id' | 'documentId' | 'uploadedAt'>
  ): Promise<string> {
    return withDevMode<string>(
      () => Promise.resolve('mock-version-id'),
      async () => {
        try {
          const existingVersions = await this.getDocumentVersions(documentId);
          const now = Timestamp.now();
          const batch = writeBatch(db);

          // Mark all current versions as not current
          for (const v of existingVersions) {
            if (v.isCurrent && v.id) {
              batch.update(doc(db, COLLECTIONS.DOCUMENT_VERSIONS, v.id), { isCurrent: false });
            }
          }

          // New version doc
          const versionRef = doc(collection(db, COLLECTIONS.DOCUMENT_VERSIONS));
          batch.set(versionRef, {
            ...versionData,
            documentId,
            uploadedAt: now,
          });

          // Update parent updatedAt
          batch.update(doc(db, COLLECTIONS.DOCUMENTS, documentId), { updatedAt: now });

          await batch.commit();
          this.invalidateDocumentsCache(documentId);
          return versionRef.id;
        } catch (error) {
          errorLoggingService.logError(error as Error, { component: 'DocumentsService', action: 'createDocumentVersion' });
          throw error;
        }
      }
    );
  }

  // Update document metadata
  static async updateDocument(documentId: string, updates: Partial<Document>): Promise<void> {
    return withDevMode<void>(
      () => Promise.resolve(),
      async () => {
        try {
          const docRef = doc(db, COLLECTIONS.DOCUMENTS, documentId);
          await updateDoc(docRef, {
            ...updates,
            updatedAt: Timestamp.now(),
          });
          this.invalidateDocumentsCache(documentId);
        } catch (error) {
          errorLoggingService.logError(error as Error, { component: 'DocumentsService', action: 'updateDocument' });
          throw error;
        }
      }
    );
  }

  // Delete document — batch-delete all versions + parent in one commit
  // P1 fix: also delete Storage files for each version before removing Firestore docs
  static async deleteDocument(documentId: string): Promise<void> {
    return withDevMode<void>(
      () => Promise.resolve(),
      async () => {
        try {
          const versions = await this.getDocumentVersions(documentId);

          // Delete Storage files first (failures are logged but do not abort Firestore cleanup)
          const storage = getStorage();
          await Promise.all(
            versions
              .filter(v => v.fileUrl)
              .map(v =>
                deleteObject(storageRef(storage, v.fileUrl)).catch(storageErr =>
                  errorLoggingService.logError(storageErr as Error, {
                    component: 'DocumentsService',
                    action: 'deleteDocument:storage',
                    context: `fileUrl=${v.fileUrl}`,
                  })
                )
              )
          );

          // Batch-delete all Firestore version docs + the parent document
          const batch = writeBatch(db);
          for (const version of versions) {
            if (version.id) {
              batch.delete(doc(db, COLLECTIONS.DOCUMENT_VERSIONS, version.id));
            }
          }
          batch.delete(doc(db, COLLECTIONS.DOCUMENTS, documentId));

          await batch.commit();
          this.invalidateDocumentsCache(documentId);
        } catch (error) {
          errorLoggingService.logError(error as Error, { component: 'DocumentsService', action: 'deleteDocument' });
          throw error;
        }
      }
    );
  }

  // Restore previous version — delegates to createDocumentVersion (already batched)
  // P1 fix: use runTransaction to atomically claim the next version number via a
  // latestVersionNumber counter on the parent document, preventing duplicate version
  // numbers when two restoreVersion calls race concurrently.
  static async restoreVersion(
    documentId: string,
    versionId: string,
    uploadedBy: string,
    changeLog?: string
  ): Promise<string> {
    return withDevMode<string>(
      () => Promise.resolve('mock-version-id'),
      async () => {
        try {
          const docRef = doc(db, COLLECTIONS.DOCUMENTS, documentId);
          const versionDocRef = doc(db, COLLECTIONS.DOCUMENT_VERSIONS, versionId);

          let nextVersion = 1;
          let versionData: DocumentVersion;

          // Atomically claim the next version slot on the parent document
          await runTransaction(db, async (tx) => {
            const [parentSnap, versionSnap] = await Promise.all([
              tx.get(docRef),
              tx.get(versionDocRef),
            ]);

            if (!parentSnap.exists()) throw new Error('Document not found');
            if (!versionSnap.exists()) throw new Error('Version not found');

            versionData = versionSnap.data() as DocumentVersion;

            // latestVersionNumber is an atomic counter we maintain for races like this.
            // Fall back to 0 for legacy documents that pre-date this field.
            const currentMax: number = parentSnap.data().latestVersionNumber || 0;
            nextVersion = currentMax + 1;

            // Reserve the slot — createDocumentVersion will write the actual version doc
            tx.update(docRef, { latestVersionNumber: nextVersion });
          });

          return this.createDocumentVersion(documentId, {
            version: nextVersion,
            fileName: versionData!.fileName,
            fileUrl: versionData!.fileUrl,
            fileSize: versionData!.fileSize,
            mimeType: versionData!.mimeType,
            uploadedBy,
            changeLog: changeLog || `Restored from version ${versionData!.version}`,
            isCurrent: true,
          });
        } catch (error) {
          errorLoggingService.logError(error as Error, { component: 'DocumentsService', action: 'restoreVersion' });
          throw error;
        }
      }
    );
  }
}
