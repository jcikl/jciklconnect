import { describe, it, expect } from 'vitest';
import { canFinalizeEmailChange, EMAIL_CHANGE_REQUEST_MAX_AGE_MS } from '../../netlify/lib/selfEmail.mjs';

const NOW = Date.parse('2026-10-26T12:00:00.000Z');
const req = (over: Record<string, unknown> = {}) => ({ newEmail: 'New@Jcikl.cc', requestedAt: '2026-10-25T12:00:00.000Z', ...over });

describe('canFinalizeEmailChange', () => {
  it('allows a recent request whose email matches the verified Auth email (case-insensitive)', () => {
    expect(canFinalizeEmailChange(req(), 'new@jcikl.cc', NOW)).toBe(true);
  });
  it('refuses when there is no request (an unrequested Auth/contact mismatch is left alone)', () => {
    expect(canFinalizeEmailChange(null, 'new@jcikl.cc', NOW)).toBe(false);
    expect(canFinalizeEmailChange(undefined, 'new@jcikl.cc', NOW)).toBe(false);
  });
  it('refuses when the request is for a different address', () => {
    expect(canFinalizeEmailChange(req(), 'other@jcikl.cc', NOW)).toBe(false);
  });
  it('refuses when there is no verified Auth email', () => {
    expect(canFinalizeEmailChange(req(), null, NOW)).toBe(false);
  });
  it('refuses an expired request, accepts one at the limit', () => {
    const old = new Date(NOW - EMAIL_CHANGE_REQUEST_MAX_AGE_MS - 1).toISOString();
    const edge = new Date(NOW - EMAIL_CHANGE_REQUEST_MAX_AGE_MS).toISOString();
    expect(canFinalizeEmailChange(req({ requestedAt: old }), 'new@jcikl.cc', NOW)).toBe(false);
    expect(canFinalizeEmailChange(req({ requestedAt: edge }), 'new@jcikl.cc', NOW)).toBe(true);
  });
  it('refuses malformed or future timestamps', () => {
    expect(canFinalizeEmailChange(req({ requestedAt: 'nope' }), 'new@jcikl.cc', NOW)).toBe(false);
    expect(canFinalizeEmailChange(req({ requestedAt: undefined }), 'new@jcikl.cc', NOW)).toBe(false);
    expect(canFinalizeEmailChange(req({ requestedAt: new Date(NOW + 60_000).toISOString() }), 'new@jcikl.cc', NOW)).toBe(false);
  });
});
