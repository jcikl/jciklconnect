// The site's own origins, taken from Netlify's built-in build/runtime variables instead of a
// hard-coded domain. URL = primary site URL (production); DEPLOY_PRIME_URL / DEPLOY_URL = the
// URL of the current deploy (deploy previews, branch deploys). No extra env vars are needed.

const originOf = (u) => { try { return new URL(u).origin; } catch { return null; } };

export function siteOrigins(env = process.env) {
  return [...new Set([env.URL, env.DEPLOY_PRIME_URL, env.DEPLOY_URL].map(originOf).filter(Boolean))];
}

/** Primary site origin (production URL), falling back to the current deploy. */
export function primaryOrigin(env = process.env) {
  return originOf(env.URL) || originOf(env.DEPLOY_PRIME_URL) || originOf(env.DEPLOY_URL);
}

export function isProductionContext(env = process.env) {
  return env.CONTEXT === 'production';
}

const LOCAL_ORIGINS = ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002', 'http://localhost:8888'];

/**
 * Where ToyyibPay sends the payer back after paying. Only our own origins are accepted
 * (plus localhost outside production); anything else falls back to `${primary}${fallbackPath}`.
 */
export function resolveReturnUrl(requested, { fallbackPath = '/payment-return', env = process.env } = {}) {
  const allowed = new Set(siteOrigins(env));
  if (!isProductionContext(env)) LOCAL_ORIGINS.forEach(o => allowed.add(o));
  const requestedOrigin = typeof requested === 'string' ? originOf(requested) : null;
  if (requestedOrigin && allowed.has(requestedOrigin)) return requested;
  const primary = primaryOrigin(env);
  return primary ? `${primary}${fallbackPath}` : null;
}

/** ToyyibPay server-to-server callback. TOYYIBPAY_CALLBACK_URL wins; otherwise our own function URL. */
export function resolveCallbackUrl(env = process.env) {
  if (env.TOYYIBPAY_CALLBACK_URL) return env.TOYYIBPAY_CALLBACK_URL;
  const primary = primaryOrigin(env);
  return primary ? `${primary}/.netlify/functions/toyyibpay-callback` : null;
}
