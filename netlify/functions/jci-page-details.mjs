// Batch-fetches JCI Malaysia event HTML pages, extracts logoUrl, pillar, and prices via regex.
// Accepts POST { ids: string[] }, returns { [id]: { logoUrl, pillar, priceMin?, priceMax? } }.

const PAGE_BASE = 'https://jcimalaysia.cc/roadmap/event-details-public.php?eventid=';
const CONCURRENCY = 10;
const TIMEOUT_MS = 4000;

const PILLAR_KEYS = new Set(['individual', 'community', 'business', 'international', 'lom', 'chapter']);
const PILLAR_LABELS = { individual: 'Individual', community: 'Community', business: 'Business', international: 'International', lom: 'LOM', chapter: 'Chapter' };

async function fetchPage(id) {
  try {
    const res = await fetch(`${PAGE_BASE}${id}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; JCIKLConnect/1.0)', Accept: 'text/html,application/xhtml+xml' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const text = await res.text();
    return text.length > 500 ? text : null;
  } catch {
    return null;
  }
}

function parseHtml(html) {
  if (!html) return { logoUrl: '', pillar: '', priceMin: undefined, priceMax: undefined };

  // logoUrl from og:image meta tag
  const logoMatch =
    html.match(/property="og:image"\s+content="([^"]+)"/i) ||
    html.match(/content="([^"]+)"\s+property="og:image"/i);
  const logoUrl = logoMatch ? logoMatch[1].trim() : '';

  // pillar from badge spans (first matching JCI pillar name)
  let pillar = '';
  const badgeRe = /<span[^>]+class="[^"]*badge[^"]*"[^>]*>\s*([^<]+?)\s*<\/span>/gi;
  let m;
  while ((m = badgeRe.exec(html)) !== null) {
    const key = m[1].trim().toLowerCase();
    if (PILLAR_KEYS.has(key)) { pillar = PILLAR_LABELS[key]; break; }
  }

  // prices from MYR/RM amounts
  const priceRe = /(?:MYR|RM)\s*([\d,]+(?:\.\d{1,2})?)/gi;
  const prices = [];
  while ((m = priceRe.exec(html)) !== null) {
    const val = parseFloat(m[1].replace(/,/g, ''));
    if (!isNaN(val) && val >= 0 && val < 100000) prices.push(val);
  }
  const priceMin = prices.length > 0 ? Math.min(...prices) : undefined;
  const rawMax = prices.length > 0 ? Math.max(...prices) : undefined;
  const priceMax = rawMax !== undefined && rawMax !== priceMin ? rawMax : undefined;

  return { logoUrl, pillar, priceMin, priceMax };
}

// Bounded concurrency — single-threaded JS makes idx++ safe without locks.
async function withConcurrency(items, fn, limit) {
  const results = new Array(items.length);
  let idx = 0;
  async function worker() {
    while (true) {
      const i = idx++;
      if (i >= items.length) break;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' },
    });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
  }

  let ids;
  try {
    const body = await req.json();
    ids = Array.isArray(body.ids) ? body.ids.map(String).filter(id => /^\d+$/.test(id)) : [];
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  if (!ids.length) {
    return new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
  }

  const htmls = await withConcurrency(ids, fetchPage, CONCURRENCY);
  const result = {};
  ids.forEach((id, i) => { result[id] = parseHtml(htmls[i]); });

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
};

export const config = { path: '/api/jci-page-details' };
