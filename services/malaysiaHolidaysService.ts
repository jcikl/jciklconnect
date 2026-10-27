/**
 * Malaysia public holidays for the calendar. Fetched from the Netlify function `malaysia-holidays`, which serves
 * them from Firestore and only refreshes from Calendarific every few days (the key stays server-side). Cached per
 * year in memory for this session; the function's response is also CDN-cached (~24h), so a new session fetches at
 * most once per year. Any failure resolves to an empty list so the calendar degrades gracefully.
 */
import { isDevMode } from '../utils/devMode';

export interface MalaysiaHoliday {
  date: string;           // 'YYYY-MM-DD'
  name: string;
  type: 'national' | 'local';
}

const ENDPOINT = '/.netlify/functions/malaysia-holidays';
const memo = new Map<number, MalaysiaHoliday[]>();

const MOCK: MalaysiaHoliday[] = [
  { date: '2026-01-01', name: "New Year's Day", type: 'national' },
  { date: '2026-02-01', name: 'Federal Territory Day', type: 'local' },
  { date: '2026-08-31', name: 'National Day', type: 'national' },
];

export class MalaysiaHolidaysService {
  /** Public holidays for one year. Resolves to [] on any failure (never throws). */
  static async getHolidays(year: number): Promise<MalaysiaHoliday[]> {
    if (isDevMode()) return MOCK.filter(h => h.date.startsWith(String(year)));
    if (memo.has(year)) return memo.get(year)!;

    try {
      const res = await fetch(`${ENDPOINT}?year=${year}`);
      if (!res.ok) return [];
      const data = await res.json() as { holidays?: MalaysiaHoliday[] };
      const holidays = Array.isArray(data.holidays) ? data.holidays : [];
      memo.set(year, holidays);
      return holidays;
    } catch {
      return [];
    }
  }
}
