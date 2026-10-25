// A member card's idealReferrals must equal the local directory's idealReferralTypes for the same member
// (utils/memberCard.mjs buildMemberCard vs services/businessDirectoryService mapMemberToBusinessProfile).
import { describe, it, expect, vi } from 'vitest';

// Only the pure mapper is under test: stub the Firestore-backed modules the service imports.
vi.mock('../../config/firebase', () => ({ db: {}, auth: null, storage: null }));
vi.mock('../../services/membersService', () => ({ MembersService: {} }));

import { buildMemberCard } from '../../utils/memberCard.mjs';
import { mapMemberToBusinessProfile } from '../../services/businessDirectoryService';

describe('idealReferrals parity with the local directory', () => {
  const cases: Record<string, unknown>[] = [
    { business: { companyName: 'Co', idealReferralTypes: ['Banks', 'HR'], idealReferrals: ['X'] } },
    { business: { companyName: 'Co', idealReferralTypes: [], idealReferrals: ['HR', ' ', 'IT'] } },
    { business: { companyName: 'Co', idealReferrals: 'Banks||HR, IT' } },
    { business: { companyName: 'Co' }, idealReferral: 'Lawyers, Doctors' },
    { business: { companyName: 'Co' }, idealReferrals: ['Doctors'] },
    { business: { companyName: 'Co', idealReferrals: [] }, idealReferral: 'Lawyers' },
    { business: { companyName: 'Co' }, idealReferralIndustry: 'IT' },
  ];
  it.each(cases.map((m, i) => [i, m] as const))('case %i', (_i, m) => {
    const card = buildMemberCard({ role: 'MEMBER', general: { name: 'A' }, ...m }, '') as { idealReferrals?: string[] };
    expect(card.idealReferrals ?? []).toEqual(mapMemberToBusinessProfile('x', m)!.idealReferralTypes);
  });
});
