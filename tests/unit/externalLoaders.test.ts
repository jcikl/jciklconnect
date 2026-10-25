import { describe, it, expect } from 'vitest';
import { UserRole } from '../../types';
import { KL_ONLY_LOADERS, canRunLoader, toExternalSelfUpdate, EXTERNAL_PROFILE_TABS } from '../../utils/externalAccess';

const KL_ROLES = [UserRole.GUEST, UserRole.MEMBER, UserRole.BOARD, UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.INACTIVE, undefined];
const EXTERNAL_ROLES = [UserRole.AFFILIATE, UserRole.CHAPTER_ADMIN];

describe('canRunLoader', () => {
  it('KL roles (and no role) run every loader', () => {
    for (const role of KL_ROLES) for (const l of KL_ONLY_LOADERS) expect(canRunLoader(role, l)).toBe(true);
  });
  it('externals run no KL-only loader', () => {
    for (const role of EXTERNAL_ROLES) for (const l of KL_ONLY_LOADERS) expect(canRunLoader(role, l)).toBe(false);
  });
});

describe('external profile', () => {
  it('externals only get the Basic and Privacy & Security tabs', () => {
    expect([...EXTERNAL_PROFILE_TABS]).toEqual(['basic', 'privacy']);
  });

  it('toExternalSelfUpdate drops KL-only and rule-locked keys, keeps the rest, does not mutate', () => {
    const input = {
      name: 'Ann', phone: '1', privacy: { showPhone: true }, 'general.birthPlace': 'SG', companyName: 'Acme',
      role: 'AFFILIATE', membershipType: 'Probation', introducer: '', joinDate: '2020-01-01', 'jciCareer.joinDate': '2020-01-01',
      senatorshipId: '', senatorCertified: false, senatorshipBoardValidated: false,
      senatorshipValidatedBy: '', senatorshipValidatedAt: '', 'jciCareer.senatorshipValidatedBy': '', 'jciCareer.senatorshipValidatedAt': '',
      idNumber: '', nationality: 'Malaysia', dateOfBirth: '', 'general.dob': '1990-01-01',
    };
    const copy = JSON.parse(JSON.stringify(input));
    expect(toExternalSelfUpdate(input)).toEqual({
      name: 'Ann', phone: '1', privacy: { showPhone: true }, 'general.birthPlace': 'SG', companyName: 'Acme',
    });
    expect(input).toEqual(copy);
  });
});
