/**
 * Proxy for JCI Malaysia event listing (DataTables JSON API).
 * Fetches all four levels in parallel, then enriches each event with
 * co-hosting data from the individual event detail endpoint.
 * Works around browser CORS restrictions by fetching server-side.
 */

const BASE_URL = 'https://jcimalaysia.cc/roadmap/functions/event.php?role=administrator&view=&stat=event-level-manage&level=';
const DETAIL_URL = 'https://jcimalaysia.cc/roadmap/functions/event.php?stat=fetch-event&eventid=';
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

async function fetchDetail(id) {
  try {
    const res = await fetch(`${DETAIL_URL}${id}`, {
      headers: HEADERS,
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const body = await res.text();
    if (body.trimStart().startsWith('<')) return null;
    return JSON.parse(body);
  } catch {
    return null;
  }
}

function extractCoHosting(detail) {
  if (!detail) return '';
  const raw =
    detail?.cohosting ??
    detail?.co_hosts ??
    detail?.cohosts ??
    detail?.cohost ??
    detail?.data?.cohosting ??
    [];
  if (Array.isArray(raw)) {
    return raw
      .map(h => h?.chapter || h?.name || h?.lo || String(h))
      .filter(Boolean)
      .join(', ');
  }
  return typeof raw === 'string' ? raw : '';
}

function extractDesc(detail) {
  if (!detail) return { desc: '', lgDesc: '' };
  // detail may be the root object or wrapped under .data
  const root = detail?.data ?? detail;
  return {
    desc: root?.desc ?? root?.description ?? '',
    lgDesc: root?.lg_desc ?? root?.long_description ?? root?.lgDesc ?? '',
  };
}

export default async () => {
  try {
    // Step 1: fetch all levels in parallel
    const results = await Promise.all(LEVELS.map(fetchLevel));
    const merged = results.flat();

    if (merged.length === 0) {
      return new Response(
        JSON.stringify({ error: 'JCI Malaysia returned no events — the API may require authentication or the endpoint has changed.' }),
        { status: 502, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // Step 2: enrich each event with detail data (cohosting + descriptions) in parallel
    const details = await Promise.allSettled(merged.map(ev => fetchDetail(ev.id)));
    const enriched = merged.map((ev, i) => {
      const detail = details[i].status === 'fulfilled' ? details[i].value : null;
      const { desc, lgDesc } = extractDesc(detail);
      return {
        ...ev,
        coHosting: extractCoHosting(detail),
        desc,
        lgDesc,
      };
    });

    return new Response(JSON.stringify({ data: enriched }), {
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
