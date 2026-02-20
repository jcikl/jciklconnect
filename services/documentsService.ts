// Documents Service with Version Control
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
import { Document } from '../types';

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

export class DocumentsService {
  // Get all documents
  static async getAllDocuments(): Promise<DocumentWithVersions[]> {
    if (isDevMode()) {
      return [
        {
          id: 'd1',
          name: 'JCI Constitution 2024',
          type: 'PDF',
          category: 'Policy',
          uploadedDate: '2024-01-15',
          size: '2.5 MB',
          versions: [],
          versionCount: 1,
        },
      ];
    }

    try {
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
    } catch (error) {
      console.error('Error fetching documents:', error);
      throw error;
    }
  }

  // Get document by ID
  static async getDocumentById(documentId: string): Promise<DocumentWithVersions | null> {
    try {
      const docRef = doc(db, COLLECTIONS.DOCUMENTS, documentId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
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
      }
      return null;
    } catch (error) {
      console.error('Error fetching document:', error);
      throw error;
    }
  }

  // Get document versions
  static async getDocumentVersions(documentId: string): Promise<DocumentVersion[]> {
    try {
      const snapshot = await getDocs(
        query(
          collection(db, COLLECTIONS.DOCUMENT_VERSIONS),
          where('documentId', '==', documentId),
          orderBy('version', 'desc')
        )
      );
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        uploadedAt: doc.data().uploadedAt?.toDate() || new Date(),
      })) as DocumentVersion[];
    } catch (error) {
      console.error('Error fetching document versions:', error);
      return [];
    }
  }

  // Create document
  static async createDocument(
    documentData: Omit<Document, 'id'>,
    fileUrl: string,
    fileName: string,
    fileSize: number,
    mimeType: string,
    uploadedBy: string,
    changeLog?: string
  ): Promise<string> {
    try {
      // Create document record
      const newDocument = {
        ...documentData,
        uploadedDate: Timestamp.now(),
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };
      
      const docRef = await addDoc(collection(db, COLLECTIONS.DOCUMENTS), newDocument);
      
      // Create initial version
      await this.createDocumentVersion(docRef.id, {
        version: 1,
        fileName,
        fileUrl,
        fileSize,
        mimeType,
        uploadedBy,
        changeLog: changeLog || 'Initial version',
        isCurrent: true,
      });
      
      return docRef.id;
    } catch (error) {
      console.error('Error creating document:', error);
      throw error;
    }
  }

  // Create document version
  static async createDocumentVersion(
    documentId: string,
    versionData: Omit<DocumentVersion, 'id' | 'documentId' | 'uploadedAt'>
  ): Promise<string> {
    try {
      // Mark all previous versions as not current
      const existingVersions = await this.getDocumentVersions(documentId);
      for (const version of existingVersions) {
        if (version.isCurrent && version.id) {
          await updateDoc(
            doc(db, COLLECTIONS.DOCUMENT_VERSIONS, version.id),
            { isCurrent: false }
          );
        }
      }

      // Create new version
      const newVersion = {
        ...versionData,
        documentId,
        uploadedAt: Timestamp.now(),
      };
      
      const versionRef = await addDoc(collection(db, COLLECTIONS.DOCUMENT_VERSIONS), newVersion);
      
      // Update document's updatedAt
      await updateDoc(doc(db, COLLECTIONS.DOCUMENTS, documentId), {
        updatedAt: Timestamp.now(),
      });
      
      return versionRef.id;
    } catch (error) {
      console.error('Error creating document version:', error);
      throw error;
    }
  }

  // Update document
  static async updateDocument(documentId: string, updates: Partial<Document>): Promise<void> {
    try {
      const docRef = doc(db, COLLECTIONS.DOCUMENTS, documentId);
      await updateDoc(docRef, {
        ...updates,
        updatedAt: Timestamp.now(),
      });
    } catch (error) {
      console.error('Error updating document:', error);
      throw error;
    }
  }

  // Delete document
  static async deleteDocument(documentId: string): Promise<void> {
    try {
      // Delete all versions
      const versions = await this.getDocumentVersions(documentId);
      for (const version of versions) {
        if (version.id) {
          await deleteDoc(doc(db, COLLECTIONS.DOCUMENT_VERSIONS, version.id));
        }
      }
      
      // Delete document
      await deleteDoc(doc(db, COLLECTIONS.DOCUMENTS, documentId));
    } catch (error) {
      console.error('Error deleting document:', error);
      throw error;
    }
  }

  // Restore previous version
  static async restoreVersion(documentId: string, versionId: string, uploadedBy: string, changeLog?: string): Promise<string> {
    try {
      const versionDoc = await getDoc(doc(db, COLLECTIONS.DOCUMENT_VERSIONS, versionId));
      if (!versionDoc.exists()) {
        throw new Error('Version not found');
      }

      const versionData = versionDoc.data() as DocumentVersion;
      const existingVersions = await this.getDocumentVersions(documentId);
      const nextVersion = Math.max(...existingVersions.map(v => v.version)) + 1;

      // Create new version from the restored one
      return await this.createDocumentVersion(documentId, {
        version: nextVersion,
        fileName: versionData.fileName,
        fileUrl: versionData.fileUrl,
        fileSize: versionData.fileSize,
        mimeType: versionData.mimeType,
        uploadedBy,
        changeLog: changeLog || `Restored from version ${versionData.version}`,
        isCurrent: true,
      });
    } catch (error) {
      console.error('Error restoring version:', error);
      throw error;
    }
  }
}

