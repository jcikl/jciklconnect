/**
 * Batch-fetch event detail data from JCI Malaysia (desc, lg_desc, cohosting).
 * Query: ?ids=7780,7781,7782,...
 * Returns: { [id]: { desc, lgDesc, coHosting } }
 */

const DETAIL_URL = 'https://jcimalaysia.cc/roadmap/functions/event.php?role=administrator&stat=fetch-event&eventid=';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; JCIKLConnect/1.0)',
  Accept: 'application/json, text/plain, */*',
};

async function fetchDetail(id) {
  try {
    const res = await fetch(`${DETAIL_URL}${id}`, {
      headers: HEADERS,
      signal: AbortSignal.timeout(4000),
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
  // cohosting is an array of chapter name strings e.g. ["JCI KL", "JCI PJ", ...]
  const raw = root?.cohosting;
  if (Array.isArray(raw)) return raw.filter(Boolean).join(', ');
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

/** Convert "HH:MM" or "HH:MM am/pm" to 24-hour "HH:MM". Returns '' if unrecognised. */
function parseTime(raw) {
  if (!raw) return '';
  const s = String(raw).trim();
  // Already 24h "HH:MM"
  const h24 = s.match(/^(\d{1,2}):(\d{2})$/);
  if (h24) return `${h24[1].padStart(2, '0')}:${h24[2]}`;
  // "HH:MM am/pm"
  const ampm = s.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
  if (ampm) {
    let h = parseInt(ampm[1], 10);
    const m = ampm[2];
    const p = ampm[3].toLowerCase();
    if (p === 'pm' && h < 12) h += 12;
    if (p === 'am' && h === 12) h = 0;
    return `${h.toString().padStart(2, '0')}:${m}`;
  }
  return '';
}

function extractTimes(detail) {
  if (!detail) return { startTime: '', endTime: '' };
  const root = detail?.data ?? detail;
  return {
    startTime: parseTime(root?.start_time ?? root?.startTime ?? root?.start ?? ''),
    endTime:   parseTime(root?.end_time   ?? root?.endTime   ?? root?.end   ?? ''),
  };
}

export default async (req) => {
  try {
    // Use POST body to avoid HTTP 414 URI Too Long with thousands of IDs
    let ids = [];
    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      ids = Array.isArray(body.ids) ? body.ids.map(String).filter(Boolean) : [];
    } else {
      const url = new URL(req.url);
      ids = (url.searchParams.get('ids') ?? '').split(',').map(s => s.trim()).filter(Boolean);
    }

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
      const { startTime, endTime } = extractTimes(detail);
      map[id] = { desc, lgDesc, coHosting: extractCoHosting(detail), startTime, endTime };
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
