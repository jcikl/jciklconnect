// Documents Service with Version Control
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/constants';
import { withDevMode } from '../utils/devMode';
import { apiCache } from './cacheService';
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

          const documents = await Promise.all(
            snapshot.docs.map(async (docSnap) => {
              const docData = docSnap.data();
              const versions = await this.getDocumentVersions(docSnap.id);
              const currentVersion = versions.find(v => v.isCurrent) || versions[0];

              return {
                id: docSnap.id,
                ...docData,
                uploadedDate: docData.uploadedDate?.toDate?.()?.toISOString() || docData.uploadedDate,
                versions,
                currentVersion,
                versionCount: versions.length,
              } as DocumentWithVersions;
            })
          );

          return documents;
        }, 3 * 60 * 1000);
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
        }, 3 * 60 * 1000);
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
        }, 3 * 60 * 1000);
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
        const batch = writeBatch(db);

        // New document ref
        const docRef = doc(collection(db, COLLECTIONS.DOCUMENTS));
        batch.set(docRef, {
          ...documentData,
          uploadedDate: now,
          createdAt: now,
          updatedAt: now,
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
      }
    );
  }

  // Update document metadata
  static async updateDocument(documentId: string, updates: Partial<Document>): Promise<void> {
    return withDevMode<void>(
      () => Promise.resolve(),
      async () => {
        const docRef = doc(db, COLLECTIONS.DOCUMENTS, documentId);
        await updateDoc(docRef, {
          ...updates,
          updatedAt: Timestamp.now(),
        });
        this.invalidateDocumentsCache(documentId);
      }
    );
  }

  // Delete document — batch-delete all versions + parent in one commit
  static async deleteDocument(documentId: string): Promise<void> {
    return withDevMode<void>(
      () => Promise.resolve(),
      async () => {
        const versions = await this.getDocumentVersions(documentId);
        const batch = writeBatch(db);

        for (const version of versions) {
          if (version.id) {
            batch.delete(doc(db, COLLECTIONS.DOCUMENT_VERSIONS, version.id));
          }
        }
        batch.delete(doc(db, COLLECTIONS.DOCUMENTS, documentId));

        await batch.commit();
        this.invalidateDocumentsCache(documentId);
      }
    );
  }

  // Restore previous version — delegates to createDocumentVersion (already batched)
  static async restoreVersion(
    documentId: string,
    versionId: string,
    uploadedBy: string,
    changeLog?: string
  ): Promise<string> {
    return withDevMode<string>(
      () => Promise.resolve('mock-version-id'),
      async () => {
        const versionDoc = await getDoc(doc(db, COLLECTIONS.DOCUMENT_VERSIONS, versionId));
        if (!versionDoc.exists()) {
          throw new Error('Version not found');
        }

        const versionData = versionDoc.data() as DocumentVersion;
        const existingVersions = await this.getDocumentVersions(documentId);
        const nextVersion = Math.max(...existingVersions.map(v => v.version)) + 1;

        return this.createDocumentVersion(documentId, {
          version: nextVersion,
          fileName: versionData.fileName,
          fileUrl: versionData.fileUrl,
          fileSize: versionData.fileSize,
          mimeType: versionData.mimeType,
          uploadedBy,
          changeLog: changeLog || `Restored from version ${versionData.version}`,
          isCurrent: true,
        });
      }
    );
  }
}
