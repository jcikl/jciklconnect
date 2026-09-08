/**
 * Proxy for JCI Malaysia national event listing.
 * Returns raw HTML from jcimalaysia.cc/roadmap to work around browser CORS restrictions.
 */

const EVENTS_URL =
  'https://jcimalaysia.cc/roadmap/functions/event.php?role=administrator&level=national&view=&stat=event-level-manage';

export default async () => {
  try {
    const response = await fetch(EVENTS_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; JCIKLConnect/1.0)',
        Accept: 'text/html,application/xhtml+xml',
      },
    });

    if (!response.ok) {
      return new Response(JSON.stringify({ error: `Upstream returned ${response.status}` }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const html = await response.text();
    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
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
