import {
  collection, doc, getDocs, setDoc, updateDoc, deleteDoc, query, orderBy
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/constants';
import { isDevMode } from '../utils/devMode';
import { staticDataCache, CACHE_TTL_5MIN } from './cacheService';
import { errorLoggingService } from './errorLoggingService';
import type { SisterChapter } from '../types/sisterChapter';

const CACHE_KEY = 'sisterChapters:all';

const MOCK_CHAPTERS: SisterChapter[] = [
  { id: 'jci-sg', name: 'JCI Singapore', country: 'Singapore', type: ['sister_lo'], flagEmoji: '🇸🇬', isActive: true },
  { id: 'jci-bkk', name: 'JCI Bangkok', country: 'Thailand', type: ['sister_lo', 'apicc'], flagEmoji: '🇹🇭', isActive: true },
];

export class SisterChaptersService {
  static async getAll(): Promise<SisterChapter[]> {
    if (isDevMode()) return MOCK_CHAPTERS;

    const cached = staticDataCache.get<SisterChapter[]>(CACHE_KEY);
    if (cached) return cached;

    try {
      const snap = await getDocs(
        query(collection(db, COLLECTIONS.SISTER_CHAPTERS), orderBy('name'))
      );
      const result = snap.docs.map(d => ({ ...(d.data() as Omit<SisterChapter, 'id'>), id: d.id }));
      staticDataCache.set(CACHE_KEY, result, CACHE_TTL_5MIN);
      return result;
    } catch (error) {
      errorLoggingService.logError(
        error instanceof Error ? error : new Error(String(error)),
        { context: 'SisterChaptersService.getAll' }
      );
      throw error;
    }
  }

  static async create(chapter: Omit<SisterChapter, 'createdAt' | 'updatedAt'>): Promise<void> {
    if (isDevMode()) return;
    const now = new Date().toISOString();
    const ref = doc(db, COLLECTIONS.SISTER_CHAPTERS, chapter.id);
    await setDoc(ref, { ...chapter, createdAt: now, updatedAt: now });
    staticDataCache.delete(CACHE_KEY);
  }

  static async update(id: string, data: Partial<Omit<SisterChapter, 'id' | 'createdAt'>>): Promise<void> {
    if (isDevMode()) return;
    const ref = doc(db, COLLECTIONS.SISTER_CHAPTERS, id);
    await updateDoc(ref, { ...data, updatedAt: new Date().toISOString() });
    staticDataCache.delete(CACHE_KEY);
  }

  static async delete(id: string): Promise<void> {
    if (isDevMode()) return;
    await deleteDoc(doc(db, COLLECTIONS.SISTER_CHAPTERS, id));
    staticDataCache.delete(CACHE_KEY);
  }
}
