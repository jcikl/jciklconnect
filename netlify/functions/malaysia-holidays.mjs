// Malaysia public holidays for the calendar. Stored in Firestore (malaysiaHolidays/{year}) and only refreshed
// from Calendarific when the stored copy is older than REFRESH_MS (3 days) — so the external API is called at most
// ~once per 3 days per year, not per request. The Calendarific key stays server-side.
//   GET ?year=2026 -> { configured, year, holidays: [{ date:'YYYY-MM-DD', name, type }], source }
// Env: CALENDARIFIC_API_KEY (required to refresh); CALENDARIFIC_LOCATION (comma-separated ISO-3166-2 states,
// default 'my-14,my-10' = Kuala Lumpur + Selangor; fetched per state and de-duplicated by date+name).
import { Timestamp } from 'firebase-admin/firestore';
import { db, hasAdminCredentials } from '../lib/firebaseAdmin.mjs';

const API = 'https://calendarific.com/api/v2/holidays';
const COUNTRY = 'MY';
const COLLECTION = 'malaysiaHolidays';
const REFRESH_MS = 3 * 24 * 60 * 60 * 1000;   // refresh from Calendarific at most once every 3 days
const PUBLIC_TYPES = new Set(['national holiday', 'local holiday']);

const isoDate = v => { const m = String(v ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[1]}-${m[2]}-${m[3]}` : ''; };

/** Pull public holidays out of one Calendarific response into `out`, de-duping across calls by date+name. */
const addFrom = (data, seen, out) => {
  for (const h of data?.response?.holidays ?? []) {
    const date = isoDate(h?.date?.iso);
    if (!date) continue;
    const types = (Array.isArray(h?.type) ? h.type : []).map(t => String(t).toLowerCase());
    if (!types.some(t => PUBLIC_TYPES.has(t))) continue;
    const name = String(h?.name ?? '').trim();
    const dedupe = `${date}|${name.toLowerCase()}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    out.push({ date, name, type: types.includes('national holiday') ? 'national' : 'local' });
  }
};

/** Fetch KL + Selangor (or configured states) from Calendarific and merge+dedupe. Returns [] on total failure. */
async function fetchFromCalendarific(key, locations, year) {
  const seen = new Set();
  const holidays = [];
  for (const loc of (locations.length ? locations : [''])) {
    const qs = new URLSearchParams({ api_key: key, country: COUNTRY, year: String(year) });
    if (loc) qs.set('location', loc);
    const res = await fetch(`${API}?${qs}`);
    if (!res.ok) { console.error(`[malaysia-holidays] ${loc || 'national'} upstream ${res.status}`); continue; }
    addFrom(await res.json(), seen, holidays);
  }
  holidays.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return holidays;
}

export default async (req) => {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Cache-Control': 'public, max-age=86400' };
  const json = (body, status = 200) => Response.json(body, { status, headers: cors });
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

  const year = parseInt(new URL(req.url).searchParams.get('year') ?? '', 10) || new Date().getFullYear();
  if (year < 2000 || year > 2100) return json({ error: 'invalid year' }, 400);

  const key = process.env.CALENDARIFIC_API_KEY;
  const locations = (process.env.CALENDARIFIC_LOCATION || 'my-14,my-10')
    .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  const locKey = locations.join(',');

  // Read the Firestore copy first; refresh from Calendarific only when it's missing/stale/for other states.
  const docRef = hasAdminCredentials ? db.collection(COLLECTION).doc(String(year)) : null;
  let stored = null;
  if (docRef) {
    try { const s = await docRef.get(); stored = s.exists ? s.data() : null; }
    catch (err) { console.error('[malaysia-holidays] firestore read failed:', err.message); }
  }

  const fresh = stored
    && stored.locations === locKey
    && stored.fetchedAt?.toMillis
    && (Date.now() - stored.fetchedAt.toMillis()) < REFRESH_MS;
  if (fresh) return json({ configured: true, year, holidays: stored.holidays ?? [], source: 'firestore' });

  // Need to refresh. Without a key we can't — serve the stored copy (even if stale), else empty.
  if (!key) return json({ configured: !!stored, year, holidays: stored?.holidays ?? [], source: stored ? 'firestore-stale' : 'none' });

  try {
    const holidays = await fetchFromCalendarific(key, locations, year);
    // Malaysia always has holidays; an empty result means every upstream call failed — keep the stored copy.
    if (!holidays.length) return json({ configured: true, year, holidays: stored?.holidays ?? [], source: stored ? 'firestore-stale' : 'none' });
    if (docRef) {
      try { await docRef.set({ year, locations: locKey, holidays, fetchedAt: Timestamp.now() }); }
      catch (err) { console.error('[malaysia-holidays] firestore write failed:', err.message); }
    }
    return json({ configured: true, year, holidays, source: 'calendarific' });
  } catch (err) {
    console.error('[malaysia-holidays] refresh failed:', err.message);
    return json({ configured: true, year, holidays: stored?.holidays ?? [], source: stored ? 'firestore-stale' : 'none' });
  }
};
