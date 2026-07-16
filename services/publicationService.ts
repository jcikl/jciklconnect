// Publications Service — manages E-Newsletter issues shown on the Guest Publications page
import {
  collection,
  doc,
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
import { withDevMode } from '../utils/devMode';
import { apiCache } from './cacheService';
import { errorLoggingService } from './errorLoggingService';

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

// ─── Mock data ─────────────────────────────────────────────────────────────────

const MOCK_PUBLICATIONS: Publication[] = [
  {
    id: 'mock-pub-1',
    year: '2025',
    issue: 'Issue 1',
    title: 'JCI KL E-Newsletter — January 2025',
    pdfUrl: 'https://drive.google.com/file/d/mockid1/preview',
    status: 'Published',
    sortOrder: 1,
  },
];

// ─── Firestore CRUD ────────────────────────────────────────────────────────────

const COLL = COLLECTIONS.PUBLICATIONS;
const CACHE_TTL = 3 * 60 * 1000; // 3 minutes
const CACHE_KEY_ALL = 'publications:all';
const CACHE_KEY_PUBLISHED = 'publications:published';

function mapDoc(d: any, id: string): Publication {
  return {
    id,
    ...d.data(),
    createdAt: d.data().createdAt?.toDate?.() ?? new Date(),
    updatedAt: d.data().updatedAt?.toDate?.() ?? new Date(),
  } as Publication;
}

export class PublicationService {
  static invalidatePublicationsCache(): void {
    apiCache.deleteByPrefix('publications:');
  }

  /** Fetch all publications, ordered by year (desc) then sortOrder (asc). */
  static async getAll(): Promise<Publication[]> {
    return withDevMode(
      () => [...MOCK_PUBLICATIONS],
      () =>
        apiCache.getOrSet<Publication[]>(
          CACHE_KEY_ALL,
          async () => {
            try {
              const snapshot = await getDocs(
                query(collection(db, COLL), orderBy('year', 'desc'), orderBy('sortOrder', 'asc'))
              );
              return snapshot.docs.map(d => mapDoc(d, d.id));
            } catch (err) {
              // Fallback: fetch without composite ordering if index not yet created
              try {
                const snapshot = await getDocs(collection(db, COLL));
                const docs = snapshot.docs.map(d => mapDoc(d, d.id));
                return docs.sort((a, b) => {
                  if (b.year !== a.year) return b.year.localeCompare(a.year);
                  return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
                });
              } catch (innerErr) {
                errorLoggingService.logError(innerErr as Error, { context: 'PublicationService.getAll' });
                throw innerErr;
              }
            }
          },
          CACHE_TTL,
          'PublicationService.getAll'
        )
    );
  }

  /**
   * Fetch only Published publications (for guest-facing page).
   * FIX P1: uses a Firestore where('status','==','Published') query instead of
   * fetching all documents and filtering client-side, reducing bandwidth for
   * guest users who only need the published subset.
   */
  static async getPublished(): Promise<Publication[]> {
    return withDevMode(
      () => MOCK_PUBLICATIONS.filter(p => p.status === 'Published'),
      () =>
        apiCache.getOrSet<Publication[]>(
          CACHE_KEY_PUBLISHED,
          async () => {
            try {
              const snapshot = await getDocs(
                query(
                  collection(db, COLL),
                  where('status', '==', 'Published'),
                  orderBy('year', 'desc'),
                  orderBy('sortOrder', 'asc')
                )
              );
              return snapshot.docs.map(d => mapDoc(d, d.id));
            } catch (err) {
              // Index may not exist yet — fall back to client-side filter
              try {
                const all = await PublicationService.getAll();
                return all.filter(p => p.status === 'Published');
              } catch (innerErr) {
                errorLoggingService.logError(innerErr as Error, { context: 'PublicationService.getPublished' });
                throw innerErr;
              }
            }
          },
          CACHE_TTL,
          'PublicationService.getPublished'
        )
    );
  }

  /** Create a new publication. Returns the new document ID. */
  static async create(
    data: Omit<Publication, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<string> {
    return withDevMode(
      () => `mock-publication-${Date.now()}`,
      async () => {
        try {
          const docRef = await addDoc(collection(db, COLL), {
            ...data,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
          });
          this.invalidatePublicationsCache();
          return docRef.id;
        } catch (err) {
          errorLoggingService.logError(err as Error, { context: 'PublicationService.create' });
          throw err;
        }
      }
    );
  }

  /** Update an existing publication by ID. */
  static async update(id: string, updates: Partial<Omit<Publication, 'id'>>): Promise<void> {
    return withDevMode(
      () => {},
      async () => {
        try {
          await updateDoc(doc(db, COLL, id), {
            ...updates,
            updatedAt: Timestamp.now(),
          });
          this.invalidatePublicationsCache();
        } catch (err) {
          errorLoggingService.logError(err as Error, { context: 'PublicationService.update', id });
          throw err;
        }
      }
    );
  }

  /** Delete a publication by ID. */
  static async delete(id: string): Promise<void> {
    return withDevMode(
      () => {},
      async () => {
        try {
          await deleteDoc(doc(db, COLL, id));
          this.invalidatePublicationsCache();
        } catch (err) {
          errorLoggingService.logError(err as Error, { context: 'PublicationService.delete', id });
          throw err;
        }
      }
    );
  }
}
