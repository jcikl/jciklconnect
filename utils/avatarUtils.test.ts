import { describe, it, expect } from 'vitest';
import { getInitialsSvg } from './avatarUtils';

const decode = (uri: string) => decodeURIComponent(uri.replace('data:image/svg+xml,', ''));

describe('getInitialsSvg', () => {
  it('returns a URI-encoded SVG data URI', () => {
    expect(getInitialsSvg('John Doe').startsWith('data:image/svg+xml,')).toBe(true);
  });

  it('uses uppercase initials of the first two words', () => {
    expect(decode(getInitialsSvg('john doe'))).toContain('>JD</text>');
    expect(decode(getInitialsSvg('Ali bin Abu'))).toContain('>AB</text>');
  });

  it('falls back to ? for an empty name', () => {
    expect(decode(getInitialsSvg(''))).toContain('>?</text>');
  });

  it('does not throw on Chinese names', () => {
    expect(() => getInitialsSvg('陈大文')).not.toThrow();
    expect(decode(getInitialsSvg('陈大文'))).toContain('>陈</text>');
  });

  it('defaults to size 64 and respects the size argument', () => {
    expect(decode(getInitialsSvg('A'))).toContain('width="64"');
    expect(decode(getInitialsSvg('A', 40))).toContain('width="40"');
  });
});
