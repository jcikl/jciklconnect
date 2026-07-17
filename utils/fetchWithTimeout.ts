/**
 * ERR-R-005: fetch wrapper that aborts after `ms` milliseconds.
 *
 * Netlify functions on the free plan time out server-side after 10 s, but the
 * browser's TCP connection can linger for minutes after a server timeout.
 * Using AbortController ensures the browser-side fetch also terminates promptly,
 * so callers' loading/spinner state is never stuck indefinitely.
 *
 * Default timeout is 12 s — slightly above the Netlify 10 s server limit so we
 * see the server's own error response when possible, but well under the TCP idle
 * timeout that would otherwise leave the fetch hanging.
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  ms = 12_000,
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('Request timed out — please try again');
    }
    throw err;
  } finally {
    clearTimeout(id);
  }
}
