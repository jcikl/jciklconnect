import { describe, it, expect } from 'vitest';
import { siteOrigins, resolveReturnUrl, resolveCallbackUrl, isProductionContext } from './siteUrl.mjs';

const PROD = { URL: 'https://jciklconnect.netlify.app', CONTEXT: 'production', DEPLOY_PRIME_URL: 'https://main--jciklconnect.netlify.app' };
const PREVIEW = { URL: 'https://jciklconnect.netlify.app', CONTEXT: 'deploy-preview', DEPLOY_PRIME_URL: 'https://deploy-preview-4--jciklconnect.netlify.app' };

describe('siteOrigins', () => {
  it('collects URL and deploy URLs as origins', () => {
    expect(siteOrigins(PREVIEW)).toEqual(['https://jciklconnect.netlify.app', 'https://deploy-preview-4--jciklconnect.netlify.app']);
  });
  it('ignores missing or malformed values', () => {
    expect(siteOrigins({ URL: 'not a url' })).toEqual([]);
  });
});

describe('resolveReturnUrl', () => {
  it('keeps a return URL on the production site', () => {
    expect(resolveReturnUrl('https://jciklconnect.netlify.app/payment-return', { env: PROD })).toBe('https://jciklconnect.netlify.app/payment-return');
  });
  it('keeps a return URL on the current deploy preview', () => {
    expect(resolveReturnUrl('https://deploy-preview-4--jciklconnect.netlify.app/payment-return', { env: PREVIEW }))
      .toBe('https://deploy-preview-4--jciklconnect.netlify.app/payment-return');
  });
  it('replaces the retired app.jcikl.cc domain with our own fallback', () => {
    expect(resolveReturnUrl('https://app.jcikl.cc/payment-return', { env: PROD })).toBe('https://jciklconnect.netlify.app/payment-return');
  });
  it('rejects foreign and look-alike origins', () => {
    expect(resolveReturnUrl('https://evil.example/payment-return', { env: PROD })).toBe('https://jciklconnect.netlify.app/payment-return');
    expect(resolveReturnUrl('https://jciklconnect.netlify.app.evil.example/x', { env: PROD })).toBe('https://jciklconnect.netlify.app/payment-return');
  });
  it('allows localhost only outside production', () => {
    expect(resolveReturnUrl('http://localhost:3001/payment-return', { env: PREVIEW })).toBe('http://localhost:3001/payment-return');
    expect(resolveReturnUrl('http://localhost:3001/payment-return', { env: PROD })).toBe('https://jciklconnect.netlify.app/payment-return');
  });
  it('falls back when nothing is requested, and returns null when the site URL is unknown', () => {
    expect(resolveReturnUrl(undefined, { env: PROD })).toBe('https://jciklconnect.netlify.app/payment-return');
    expect(resolveReturnUrl('https://x.example', { env: {} })).toBeNull();
  });
});

describe('resolveCallbackUrl', () => {
  it('prefers TOYYIBPAY_CALLBACK_URL', () => {
    expect(resolveCallbackUrl({ ...PROD, TOYYIBPAY_CALLBACK_URL: 'https://jciklconnect.netlify.app/.netlify/functions/toyyibpay-callback' }))
      .toBe('https://jciklconnect.netlify.app/.netlify/functions/toyyibpay-callback');
  });
  it('falls back to our own function URL instead of app.jcikl.cc', () => {
    expect(resolveCallbackUrl(PROD)).toBe('https://jciklconnect.netlify.app/.netlify/functions/toyyibpay-callback');
  });
});

describe('isProductionContext', () => {
  it('uses Netlify CONTEXT', () => {
    expect(isProductionContext(PROD)).toBe(true);
    expect(isProductionContext(PREVIEW)).toBe(false);
  });
});
