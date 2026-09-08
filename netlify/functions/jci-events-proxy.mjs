/**
 * Proxy for JCI Malaysia national event listing (DataTables JSON API).
 * Works around browser CORS restrictions by fetching server-side.
 */

const EVENTS_URL =
  'https://jcimalaysia.cc/roadmap/functions/event.php?role=administrator&level=national&view=&stat=event-level-manage';

export default async () => {
  try {
    const response = await fetch(EVENTS_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; JCIKLConnect/1.0)',
        Accept: 'application/json, text/plain, */*',
      },
    });

    if (!response.ok) {
      return new Response(JSON.stringify({ error: `Upstream returned ${response.status}` }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await response.text();

    // Guard: if the upstream returned HTML instead of JSON, surface a clear error
    if (body.trimStart().startsWith('<')) {
      return new Response(
        JSON.stringify({ error: 'JCI Malaysia returned HTML — the API may require authentication or the endpoint has changed.' }),
        { status: 502, headers: { 'Content-Type': 'application/json' } },
      );
    }

    return new Response(body, {
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
