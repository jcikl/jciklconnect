/**
 * Batch-fetch event detail data from JCI Malaysia (desc, lg_desc, cohosting).
 * Query: ?ids=7780,7781,7782,...
 * Returns: { [id]: { desc, lgDesc, coHosting } }
 */

const DETAIL_URL = 'https://jcimalaysia.cc/roadmap/functions/event.php?stat=fetch-event&eventid=';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; JCIKLConnect/1.0)',
  Accept: 'application/json, text/plain, */*',
};

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
  const root = detail?.data ?? detail;
  const raw = root?.cohosting ?? root?.co_hosts ?? root?.cohosts ?? root?.cohost ?? [];
  if (Array.isArray(raw)) {
    return raw.map(h => h?.chapter || h?.name || h?.lo || String(h)).filter(Boolean).join(', ');
  }
  return typeof raw === 'string' ? raw : '';
}

function extractDesc(detail) {
  if (!detail) return { desc: '', lgDesc: '' };
  const root = detail?.data ?? detail;
  return {
    desc: root?.desc ?? root?.description ?? '',
    lgDesc: root?.lg_desc ?? root?.long_description ?? root?.lgDesc ?? '',
  };
}

export default async (req) => {
  try {
    const url = new URL(req.url);
    const ids = (url.searchParams.get('ids') ?? '').split(',').map(s => s.trim()).filter(Boolean);

    if (ids.length === 0) {
      return new Response(JSON.stringify({}), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const results = await Promise.allSettled(ids.map(fetchDetail));
    const map = {};
    ids.forEach((id, i) => {
      const detail = results[i].status === 'fulfilled' ? results[i].value : null;
      const { desc, lgDesc } = extractDesc(detail);
      map[id] = { desc, lgDesc, coHosting: extractCoHosting(detail) };
    });

    return new Response(JSON.stringify(map), {
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

export const config = { path: '/api/jci-event-details' };
