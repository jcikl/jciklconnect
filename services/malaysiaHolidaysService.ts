/**
 * Malaysia public holidays for the calendar. Fetched from the Netlify function `malaysia-holidays` (which proxies
 * Calendarific with a server-side key). Cached per year in memory and localStorage (holidays rarely change); any
 * failure resolves to an empty list so the calendar degrades gracefully (just no holiday markers).
 */
import { isDevMode } from '../utils/devMode';

export interface MalaysiaHoliday {
  date: string;           // 'YYYY-MM-DD'
  name: string;
  type: 'national' | 'local';
}

const ENDPOINT = '/.netlify/functions/malaysia-holidays';
const LS_KEY = (year: number) => `my-holidays-${year}`;
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
      const cached = localStorage.getItem(LS_KEY(year));
      if (cached) { const parsed = JSON.parse(cached) as MalaysiaHoliday[]; memo.set(year, parsed); return parsed; }
    } catch { /* ignore localStorage issues */ }

    try {
      const res = await fetch(`${ENDPOINT}?year=${year}`);
      if (!res.ok) return [];
      const data = await res.json() as { holidays?: MalaysiaHoliday[] };
      const holidays = Array.isArray(data.holidays) ? data.holidays : [];
      memo.set(year, holidays);
      try { localStorage.setItem(LS_KEY(year), JSON.stringify(holidays)); } catch { /* ignore */ }
      return holidays;
    } catch {
      return [];
    }
  }
}
