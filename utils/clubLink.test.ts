import { describe, it, expect } from 'vitest';
import { getClubGroupLink } from './clubLink';

describe('getClubGroupLink', () => {
  it('returns http(s) group links', () => {
    expect(getClubGroupLink({ whatsappUrl: 'https://chat.whatsapp.com/AbC123' })).toBe('https://chat.whatsapp.com/AbC123');
    expect(getClubGroupLink({ whatsappUrl: '  https://line.me/R/ti/g/xyz  ' })).toBe('https://line.me/R/ti/g/xyz');
    expect(getClubGroupLink({ whatsappUrl: 'https://discord.gg/abc' })).toBe('https://discord.gg/abc');
  });

  it('returns null when missing or blank', () => {
    expect(getClubGroupLink({})).toBeNull();
    expect(getClubGroupLink({ whatsappUrl: '   ' })).toBeNull();
  });

  it('rejects non-http(s) or malformed links', () => {
    expect(getClubGroupLink({ whatsappUrl: 'javascript:alert(1)' })).toBeNull();
    expect(getClubGroupLink({ whatsappUrl: 'not a url' })).toBeNull();
  });
});
