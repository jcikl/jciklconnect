import { describe, it, expect } from 'vitest';
import { isKlMember, filterKlMembers, isCrossLoDeleteBlocked } from './memberScope';

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

  describe('isCrossLoDeleteBlocked (MembersService.deleteMember guard)', () => {
    it('same LO or unknown LO is never blocked', () => {
      expect(isCrossLoDeleteBlocked('ADMIN', 'jcikl', 'jcikl')).toBe(false);
      expect(isCrossLoDeleteBlocked('ADMIN', null, 'jcicitysg')).toBe(false);
      expect(isCrossLoDeleteBlocked('ADMIN', 'jcikl', null)).toBe(false);
    });
    it('KL ADMIN / SUPER_ADMIN may remove a legacy sister-chapter doc', () => {
      expect(isCrossLoDeleteBlocked('ADMIN', 'jcikl', 'jcicitysg')).toBe(false);
      expect(isCrossLoDeleteBlocked('SUPER_ADMIN', 'jcikl', 'jcicitysg')).toBe(false);
    });
    it('L4: the exception needs an admin role (BOARD stays blocked → friendly client message)', () => {
      expect(isCrossLoDeleteBlocked('BOARD', 'jcikl', 'jcicitysg')).toBe(true);
      expect(isCrossLoDeleteBlocked(null, 'jcikl', 'jcicitysg')).toBe(true);
    });
    it('a non-KL admin cannot cross LOs', () => {
      expect(isCrossLoDeleteBlocked('ADMIN', 'jcicitysg', 'jcikl')).toBe(true);
      expect(isCrossLoDeleteBlocked('ADMIN', 'jcicitysg', 'jcitokyo')).toBe(true);
    });
  });
});
