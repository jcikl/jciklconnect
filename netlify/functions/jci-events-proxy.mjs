/**
 * Proxy for JCI Malaysia event listing (DataTables JSON API).
 * Fetches all four levels in parallel and merges basic event data.
 * Detail enrichment (desc, cohosting) is handled by jci-event-details.mjs.
 * Works around browser CORS restrictions by fetching server-side.
 */

const BASE_URL = 'https://jcimalaysia.cc/roadmap/functions/event.php?role=administrator&view=&stat=event-level-manage&level=';
const LEVELS = ['national', 'area', 'local', 'jci'];

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; JCIKLConnect/1.0)',
  Accept: 'application/json, text/plain, */*',
};

async function fetchLevel(level) {
  try {
    const res = await fetch(`${BASE_URL}${level}`, { headers: HEADERS });
    if (!res.ok) return [];
    const body = await res.text();
    if (body.trimStart().startsWith('<')) return [];
    const parsed = JSON.parse(body);
    return Array.isArray(parsed?.data) ? parsed.data : [];
  } catch {
    return [];
  }
}

export default async (req) => {
  try {
    const url = new URL(req.url);
    const yearParam = url.searchParams.get('year');
    const fetchAll = yearParam === 'all' || !yearParam;
    const currentYear = new Date().getFullYear();
    const targetYear = (!fetchAll && /^\d{4}$/.test(yearParam)) ? yearParam : null;

    const results = await Promise.all(LEVELS.map(fetchLevel));
    const merged = results.flat();

    if (merged.length === 0) {
      return new Response(
        JSON.stringify({ error: 'JCI Malaysia returned no events — the API may require authentication or the endpoint has changed.' }),
        { status: 502, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const data = targetYear ? merged.filter(ev => String(ev.year) === targetYear) : merged;

    return new Response(JSON.stringify({ data: data.length > 0 ? data : merged }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const config = { path: '/api/jci-events-proxy' };
