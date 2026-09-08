/**
 * Proxy for JCI Malaysia event listing (DataTables JSON API).
 * Fetches all four levels in parallel and merges results.
 * Works around browser CORS restrictions by fetching server-side.
 */

const BASE_URL = 'https://jcimalaysia.cc/roadmap/functions/event.php?role=administrator&view=&stat=event-level-manage&level=';
const LEVELS = ['national', 'area', 'local', 'jci'];

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; JCIKLConnect/1.0)',
  Accept: 'application/json, text/plain, */*',
};

async function fetchLevel(level) {
  const res = await fetch(`${BASE_URL}${level}`, { headers: HEADERS });
  if (!res.ok) return [];
  const body = await res.text();
  if (body.trimStart().startsWith('<')) return [];
  try {
    const parsed = JSON.parse(body);
    return Array.isArray(parsed?.data) ? parsed.data : [];
  } catch {
    return [];
  }
}

export default async () => {
  try {
    const results = await Promise.all(LEVELS.map(fetchLevel));
    const merged = results.flat();

    if (merged.length === 0) {
      return new Response(
        JSON.stringify({ error: 'JCI Malaysia returned no events — the API may require authentication or the endpoint has changed.' }),
        { status: 502, headers: { 'Content-Type': 'application/json' } },
      );
    }

    return new Response(JSON.stringify({ data: merged }), {
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
