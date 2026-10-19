import { describe, it, expect } from 'vitest';
import { isKlMember, filterKlMembers } from './memberScope';

describe('memberScope', () => {
  it('treats jcikl and missing loId as KL', () => {
    expect(isKlMember({ loId: 'jcikl' })).toBe(true);
    expect(isKlMember({})).toBe(true);
    expect(isKlMember({ loId: null })).toBe(true);
  });
  it('excludes other chapters and null', () => {
    expect(isKlMember({ loId: 'jci-penang' })).toBe(false);
    expect(isKlMember(null)).toBe(false);
  });
  it('filterKlMembers keeps only KL', () => {
    const out = filterKlMembers([{ id: 1, loId: 'jcikl' }, { id: 2, loId: 'x' }, { id: 3 }]);
    expect(out.map(m => m.id)).toEqual([1, 3]);
  });
});
