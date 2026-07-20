import { doc, setDoc, increment, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { withDevMode } from '../utils/devMode';
import { COLLECTIONS } from '../config/constants';
import { apiCache, CACHE_TTL_5MIN } from './cacheService';
import { errorLoggingService } from './errorLoggingService';

export type GuestPage = 'home' | 'events' | 'projects' | 'about' | 'enewsletters' | 'directory' | 'partnerships';

export const GUEST_PAGES: GuestPage[] = ['home', 'events', 'projects', 'about', 'enewsletters', 'directory', 'partnerships'];

export const GUEST_PAGE_LABELS: Record<GuestPage, string> = {
  home: 'Home',
  events: 'Events',
  projects: 'Flagship Projects',
  about: 'About Us',
  enewsletters: 'E-Newsletters',
  directory: 'Directory',
  partnerships: 'Partnerships',
};

/** Map a guest route pathname to its analytics page key (null = untracked route). */
export const pathToGuestPage = (pathname: string): GuestPage | null => {
  const map: Record<string, GuestPage> = {
    '/': 'home',
    '/events': 'events',
    '/projects': 'projects',
    '/about': 'about',
    '/enewsletters': 'enewsletters',
    '/directory': 'directory',
    '/partnerships': 'partnerships',
  };
  return map[pathname] ?? null;
};

/** One aggregated stats document per page per day (docId: `${date}_${page}`). */
export interface GuestPageDailyStats {
  page: GuestPage;
  date: string; // YYYY-MM-DD
  views: number;
  dwellSeconds: number;
  signupClicks: number;
}

export interface GuestPageSummary {
  page: GuestPage;
  views: number;
  dwellSeconds: number;
  avgDwellSeconds: number;
  signupClicks: number;
}

const todayStr = () => new Date().toISOString().slice(0, 10);

const bump = async (page: GuestPage, fields: Record<string, ReturnType<typeof increment>>) => {
  return withDevMode(() => {}, async () => {
    try {
      const date = todayStr();
      await setDoc(
        doc(db, COLLECTIONS.GUEST_PAGE_STATS, `${date}_${page}`),
        { page, date, updatedAt: new Date().toISOString(), ...fields },
        { merge: true }
      );
      apiCache.delete(`guest-summary-7`);
      apiCache.delete(`guest-summary-30`);
    } catch (err) {
      // Analytics must never break the guest experience
      errorLoggingService.logError(err instanceof Error ? err : new Error(String(err)), { context: 'GuestAnalyticsService.bump', additionalData: { page: Object.keys(fields).join(',') } });
    }
  });
};

export class GuestAnalyticsService {
  /** Record one page view. */
  static trackPageView(page: GuestPage): void {
    void bump(page, { views: increment(1) });
  }

  /** Record dwell time (seconds) on a page. Ignores blips (<1s) and caps runaway sessions at 30 min. */
  static trackDwell(page: GuestPage, seconds: number): void {
    const s = Math.round(Math.min(seconds, 1800));
    if (s < 1) return;
    void bump(page, { dwellSeconds: increment(s) });
  }

  /** Record a click on a Sign Up / Register CTA. */
  static trackSignupClick(page: GuestPage): void {
    void bump(page, { signupClicks: increment(1) });
  }

  /** Aggregate stats over the last `days` days, one row per guest page. */
  static async getSummary(days: number): Promise<GuestPageSummary[]> {
    const cacheKey = `guest-summary-${days}`;
    return withDevMode(
      () => GUEST_PAGES.map((page, i) => ({
        page,
        views: 120 - i * 12,
        dwellSeconds: (120 - i * 12) * (25 + i * 5),
        avgDwellSeconds: 25 + i * 5,
        signupClicks: Math.max(0, 14 - i * 2),
      })),
      async () => {
        const cached = apiCache.get<GuestPageSummary[]>(cacheKey);
        if (cached) return cached;

        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        const cutoffStr = cutoff.toISOString().slice(0, 10);
        const todayStr_ = todayStr();

        const snap = await getDocs(
          query(
            collection(db, COLLECTIONS.GUEST_PAGE_STATS),
            where('date', '>=', cutoffStr),
            where('date', '<=', todayStr_)
          )
        );

        const byPage = new Map<GuestPage, GuestPageSummary>();
        for (const page of GUEST_PAGES) {
          byPage.set(page, { page, views: 0, dwellSeconds: 0, avgDwellSeconds: 0, signupClicks: 0 });
        }
        snap.forEach(d => {
          const data = d.data() as Partial<GuestPageDailyStats>;
          const row = data.page ? byPage.get(data.page) : undefined;
          if (!row) return;
          row.views += data.views || 0;
          row.dwellSeconds += data.dwellSeconds || 0;
          row.signupClicks += data.signupClicks || 0;
        });
        for (const row of byPage.values()) {
          row.avgDwellSeconds = row.views > 0 ? Math.round(row.dwellSeconds / row.views) : 0;
        }
        const result = Array.from(byPage.values());
        apiCache.set(cacheKey, result, CACHE_TTL_5MIN);
        return result;
      }
    );
  }
}

export const guestAnalyticsService = GuestAnalyticsService;

