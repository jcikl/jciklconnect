import {
  collection, doc, getDocs, setDoc, deleteDoc, writeBatch, query, orderBy,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/constants';
import { isDevMode } from '../utils/devMode';
import { errorLoggingService } from './errorLoggingService';
import { apiCache, CACHE_TTL_3MIN } from './cacheService';
import { resolveAreaFromAddress as resolveFromStatic, getSeedEntries } from '../utils/myPostcodes';

export type PostcodeType = 'exact' | 'range' | 'keyword';

export interface PostcodeEntry {
  id: string;
  postcode?: string;  // 5-digit, exact entries only
  minPrefix?: number; // range entries
  maxPrefix?: number; // range entries
  pattern?: string;   // regex string, keyword entries
  area: string;
  state: string;
  type: PostcodeType;
}

const CACHE_KEY = 'postcodes_all';

export class PostcodeService {
  // ---------------------------------------------------------------------------
  // Read
  // ---------------------------------------------------------------------------
  static async getAll(): Promise<PostcodeEntry[]> {
    if (isDevMode()) return [];
    const cached = apiCache.get<PostcodeEntry[]>(CACHE_KEY);
    if (cached) return cached;
    try {
      const snap = await getDocs(query(collection(db, COLLECTIONS.POSTCODES), orderBy('type')));
      const entries = snap.docs.map(d => ({ id: d.id, ...d.data() } as PostcodeEntry));
      apiCache.set(CACHE_KEY, entries, CACHE_TTL_3MIN);
      return entries;
    } catch (e) {
      errorLoggingService.logError(e instanceof Error ? e : new Error(String(e)), { context: 'PostcodeService.getAll' });
      return [];
    }
  }

  // ---------------------------------------------------------------------------
  // Write
  // ---------------------------------------------------------------------------
  static async upsert(entry: PostcodeEntry): Promise<void> {
    if (isDevMode()) return;
    const { id, ...data } = entry;
    await setDoc(doc(db, COLLECTIONS.POSTCODES, id), data);
    apiCache.delete(CACHE_KEY);
  }

  static async deleteEntry(id: string): Promise<void> {
    if (isDevMode()) return;
    await deleteDoc(doc(db, COLLECTIONS.POSTCODES, id));
    apiCache.delete(CACHE_KEY);
  }

  // ---------------------------------------------------------------------------
  // Seed — batch-write static data to Firestore (one-time / re-seedable)
  // ---------------------------------------------------------------------------
  static async seed(onProgress?: (done: number, total: number) => void): Promise<number> {
    if (isDevMode()) return 0;
    const entries = getSeedEntries();
    const BATCH_SIZE = 400;
    let done = 0;
    for (let i = 0; i < entries.length; i += BATCH_SIZE) {
      const batch = writeBatch(db);
      entries.slice(i, i + BATCH_SIZE).forEach(e => {
        batch.set(doc(db, COLLECTIONS.POSTCODES, e.id), (() => { const { id, ...d } = e; return d; })());
      });
      await batch.commit();
      done += Math.min(BATCH_SIZE, entries.length - i);
      onProgress?.(done, entries.length);
    }
    apiCache.delete(CACHE_KEY);
    return entries.length;
  }

  // ---------------------------------------------------------------------------
  // Resolve — Firestore first, static fallback
  // ---------------------------------------------------------------------------
  static async resolveArea(address: string | undefined | null): Promise<{ area: string; state: string } | null> {
    if (!address?.trim()) return null;

    const entries = await this.getAll();
    if (entries.length === 0) return resolveFromStatic(address);

    const m = address.match(/\b(\d{5})\b/);
    if (m) {
      const postcode = m[1];
      const exact = entries.find(e => e.type === 'exact' && e.postcode === postcode);
      if (exact) return { area: exact.area, state: exact.state };

      const prefix = parseInt(postcode.slice(0, 2), 10);
      const range = entries.find(
        e => e.type === 'range' && e.minPrefix != null && e.maxPrefix != null
          && prefix >= e.minPrefix && prefix <= e.maxPrefix,
      );
      if (range) return { area: range.area, state: range.state };
    }

    for (const e of entries) {
      if (e.type === 'keyword' && e.pattern) {
        try {
          if (new RegExp(e.pattern, 'i').test(address)) return { area: e.area, state: e.state };
        } catch { /* invalid regex — skip */ }
      }
    }

    return resolveFromStatic(address);
  }
}
