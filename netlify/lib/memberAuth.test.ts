import { describe, it, expect } from 'vitest';
import { normalizeMyPhone, memberEmail, findDuplicateEmails } from './memberAuth.mjs';

describe('normalizeMyPhone', () => {
  it.each([
    ['012-345 6789', '+60123456789'],
    ['0123456789', '+60123456789'],
    ['011-2345 6789', '+601123456789'],
    ['60123456789', '+60123456789'],
    ['+60 12-345 6789', '+60123456789'],
    ['123456789', '+60123456789'],
    ['03-1234 5678', '+60312345678'],
    ['+65 9123 4567', '+6591234567'],
    ['0065 9123 4567', '+6591234567'],
  ])('%s -> %s', (raw, expected) => {
    expect(normalizeMyPhone(raw)).toBe(expected);
  });

  it.each([[null], [undefined], [''], ['abc'], ['12'], ['6591234567'], ['+0123']])('rejects %s', (raw) => {
    expect(normalizeMyPhone(raw)).toBeNull();
  });
});

describe('memberEmail', () => {
  it('prefers contact.email, lower-cases and trims', () => {
    expect(memberEmail({ contact: { email: ' Ali@Example.COM ' }, email: 'old@x.com' })).toBe('ali@example.com');
  });
  it('falls back to legacy top-level email', () => {
    expect(memberEmail({ email: 'old@x.com' })).toBe('old@x.com');
  });
  it('returns null for missing or invalid email', () => {
    expect(memberEmail({})).toBeNull();
    expect(memberEmail({ contact: { email: 'not-an-email' } })).toBeNull();
  });
});

describe('findDuplicateEmails', () => {
  it('reports emails used by more than one profile, case-insensitively', () => {
    const docs = [{ contact: { email: 'a@x.com' } }, { contact: { email: 'A@x.com' } }, { contact: { email: 'b@x.com' } }]
      .map(d => ({ data: () => d }));
    expect([...findDuplicateEmails(docs)]).toEqual(['a@x.com']);
  });
});
