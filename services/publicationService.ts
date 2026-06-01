// Publications Service — manages E-Newsletter issues shown on the Guest Publications page
import {
  collection,
  doc,
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

export interface Publication {
  id?: string;
  year: string;                       // e.g. "2025"
  issue: string;                      // e.g. "Issue 1", "E-Magazine"
  title: string;                      // Full display title
  pdfUrl: string;                     // Google Drive URL (any share format — converted to /preview on read)
  status: 'Published' | 'Draft';
  sortOrder: number;                  // Lower = shown first within the same year
  loId?: string;
  createdAt?: Timestamp | Date;
  updatedAt?: Timestamp | Date;
}

// ─── Google Drive URL helpers ──────────────────────────────────────────────────

/**
 * Extract the Google Drive file ID from any share URL format:
 *  - https://drive.google.com/file/d/{ID}/view?...
 *  - https://drive.google.com/open?id={ID}
 *  - https://docs.google.com/...d/{ID}/...
 */
export function extractGoogleDriveFileId(url: string): string | null {
  if (!url) return null;
  // /d/{id}/ pattern (most common)
  const slashMatch = url.match(/\/d\/([a-zA-Z0-9_-]{10,})/);
  if (slashMatch) return slashMatch[1];
  // ?id={id} pattern
  const queryMatch = url.match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
  if (queryMatch) return queryMatch[1];
  return null;
}

/**
 * Convert any Google Drive share URL to an embeddable /preview URL.
 * Returns the original URL unchanged if it is not a recognisable Drive link.
 */
export function toGoogleDrivePreviewUrl(url: string): string {
  const id = extractGoogleDriveFileId(url);
  if (id) return `https://drive.google.com/file/d/${id}/preview`;
  return url;
}

/**
 * Validate that a Google Drive URL contains a recognisable file ID.
 */
export function isValidGoogleDriveUrl(url: string): boolean {
  return !!extractGoogleDriveFileId(url);
}

// ─── Firestore CRUD ────────────────────────────────────────────────────────────

const COLL = COLLECTIONS.PUBLICATIONS;

export class PublicationService {
  /** Fetch all publications, ordered by year (desc) then sortOrder (asc). */
  static async getAll(): Promise<Publication[]> {
    try {
      const snapshot = await getDocs(
        query(collection(db, COLL), orderBy('year', 'desc'), orderBy('sortOrder', 'asc'))
      );
      return snapshot.docs.map(d => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate?.() ?? new Date(),
        updatedAt: d.data().updatedAt?.toDate?.() ?? new Date(),
      })) as Publication[];
    } catch (err) {
      // Fallback: fetch without composite ordering if index not yet created
      try {
        const snapshot = await getDocs(collection(db, COLL));
        const docs = snapshot.docs.map(d => ({
          id: d.id,
          ...d.data(),
          createdAt: d.data().createdAt?.toDate?.() ?? new Date(),
          updatedAt: d.data().updatedAt?.toDate?.() ?? new Date(),
        })) as Publication[];
        return docs.sort((a, b) => {
          if (b.year !== a.year) return b.year.localeCompare(a.year);
          return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
        });
      } catch (innerErr) {
        console.error('Error fetching publications:', innerErr);
        throw innerErr;
      }
    }
  }

  /** Fetch only Published publications (for guest-facing page). */
  static async getPublished(): Promise<Publication[]> {
    const all = await PublicationService.getAll();
    return all.filter(p => p.status === 'Published');
  }

  /** Create a new publication. Returns the new document ID. */
  static async create(
    data: Omit<Publication, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, COLL), {
        ...data,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
      return docRef.id;
    } catch (err) {
      console.error('Error creating publication:', err);
      throw err;
    }
  }

  /** Update an existing publication by ID. */
  static async update(id: string, updates: Partial<Omit<Publication, 'id'>>): Promise<void> {
    try {
      await updateDoc(doc(db, COLL, id), {
        ...updates,
        updatedAt: Timestamp.now(),
      });
    } catch (err) {
      console.error('Error updating publication:', err);
      throw err;
    }
  }

  /** Delete a publication by ID. */
  static async delete(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, COLL, id));
    } catch (err) {
      console.error('Error deleting publication:', err);
      throw err;
    }
  }
}
