import { describe, it, expect } from 'vitest';
import { showsBirthday, isActiveRecipient } from './members.mjs';

describe('showsBirthday (privacy.hideBirthday)', () => {
  it('shown by default and when the switch is off', () => {
    expect(showsBirthday({ role: 'MEMBER' })).toBe(true);
    expect(showsBirthday({ role: 'MEMBER', privacy: {} })).toBe(true);
    expect(showsBirthday({ role: 'MEMBER', privacy: { hideBirthday: false } })).toBe(true);
  });
  it('hidden only when hideBirthday === true', () => {
    expect(showsBirthday({ role: 'MEMBER', privacy: { hideBirthday: true } })).toBe(false);
    expect(showsBirthday({ role: 'MEMBER', privacy: { hideBirthday: 'yes' } })).toBe(true);
  });
  it('birthday-notifications picks eligible members that show their birthday', () => {
    const docs = [
      { id: 'a', role: 'MEMBER' },
      { id: 'b', role: 'MEMBER', privacy: { hideBirthday: true } },
      { id: 'c', role: 'GUEST' },
    ];
    expect(docs.filter(m => isActiveRecipient(m) && showsBirthday(m)).map(m => m.id)).toEqual(['a']);
  });
});
