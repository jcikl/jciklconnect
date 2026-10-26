// Malaysia public holidays for the calendar, proxied from Calendarific so the API key stays server-side.
//   GET ?year=2026  -> { configured, year, holidays: [{ date: 'YYYY-MM-DD', name, type }] }
// Set CALENDARIFIC_API_KEY (required) and optionally CALENDARIFIC_LOCATION (e.g. 'my-14' for Kuala Lumpur's
// state holidays) in the Netlify environment. When the key is missing the function returns an empty list with
// configured:false (200), so the calendar simply shows no holidays instead of erroring. Results are cached in
// the warm container per year and sent with a long Cache-Control for the CDN (holidays rarely change).
const API = 'https://calendarific.com/api/v2/holidays';
const COUNTRY = 'MY';
// Calendarific types we treat as public holidays (drop observances / seasons / optional days).
const PUBLIC_TYPES = new Set(['national holiday', 'local holiday']);

const cache = new Map(); // `${year}:${location}` -> holidays[]

const isoDate = v => { const m = String(v ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[1]}-${m[2]}-${m[3]}` : ''; };

export default async (req) => {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Cache-Control': 'public, max-age=86400' };
  const json = (body, status = 200, extra = {}) => Response.json(body, { status, headers: { ...cors, ...extra } });
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

  const url = new URL(req.url);
  const year = parseInt(url.searchParams.get('year') ?? '', 10) || new Date().getFullYear();
  if (year < 2000 || year > 2100) return json({ error: 'invalid year' }, 400);

  const key = process.env.CALENDARIFIC_API_KEY;
  if (!key) return json({ configured: false, year, holidays: [] });

  // Default to Kuala Lumpur (my-14) + Selangor (my-10); override with a comma-separated CALENDARIFIC_LOCATION.
  // Calendarific takes one state per call, so we fetch each and dedupe across them (national holidays overlap).
  const locations = (process.env.CALENDARIFIC_LOCATION || 'my-14,my-10')
    .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  const cacheKey = `${year}:${locations.join('+') || 'national'}`;
  if (cache.has(cacheKey)) return json({ configured: true, year, holidays: cache.get(cacheKey) });

  const addFrom = (data, seen, out) => {
    for (const h of data?.response?.holidays ?? []) {
      const date = isoDate(h?.date?.iso);
      if (!date) continue;
      const types = (Array.isArray(h?.type) ? h.type : []).map(t => String(t).toLowerCase());
      if (!types.some(t => PUBLIC_TYPES.has(t))) continue;
      const name = String(h?.name ?? '').trim();
      const dedupe = `${date}|${name.toLowerCase()}`;   // same holiday across states -> once
      if (seen.has(dedupe)) continue;
      seen.add(dedupe);
      out.push({ date, name, type: types.includes('national holiday') ? 'national' : 'local' });
    }
  };

  try {
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
    cache.set(cacheKey, holidays);
    return json({ configured: true, year, holidays });
  } catch (err) {
    console.error('[malaysia-holidays] failed:', err.message);
    return json({ configured: true, year, holidays: [], error: 'fetch failed' }, 200);
  }
};
