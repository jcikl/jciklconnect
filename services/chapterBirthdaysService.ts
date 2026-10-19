/** Own-chapter birthdays for external users: calls the Netlify function chapter-birthdays (read-only). */
import { auth } from '../config/firebase';
import { isDevMode } from '../utils/devMode';
import { errorLoggingService } from './errorLoggingService';
import { apiCache, CACHE_TTL_5MIN } from './cacheService';

/** One birthday of the caller's chapter. No year is ever returned. */
export interface ChapterBirthday {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  /** 'MMDD' */
  mmdd: string;
}

const ENDPOINT = '/.netlify/functions/chapter-birthdays';
const CACHE_KEY = (uid: string, month: number) => `chapterBirthdays:${uid}:${month}`;

export class ChapterBirthdaysService {
  /** Birthdays in `month` (1-12) among active members of the signed-in external user's own chapter. */
  static async getForMonth(month: number): Promise<ChapterBirthday[]> {
    if (isDevMode()) return [];
    const user = auth?.currentUser;
    if (!user) throw new Error('Not signed in');
    return apiCache.getOrSet(CACHE_KEY(user.uid, month), async () => {
      try {
        const idToken = await user.getIdToken();
        const res = await fetch(ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
          body: JSON.stringify({ month }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error || `chapter-birthdays failed (${res.status})`);
        }
        const data = await res.json();
        return Array.isArray(data.birthdays) ? (data.birthdays as ChapterBirthday[]) : [];
      } catch (error) {
        errorLoggingService.logError(error instanceof Error ? error : new Error(String(error)), { context: 'ChapterBirthdaysService.getForMonth', additionalData: { month } });
        throw error;
      }
    }, CACHE_TTL_5MIN, 'chapterBirthdaysService.getForMonth');
  }
}
