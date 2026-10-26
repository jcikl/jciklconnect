// The local directory's "Deal" (services/businessDirectoryService mapMemberToBusinessProfile) and the card's
// specialOfferSummary (utils/memberCard.mjs buildMemberCard) read both offer formats and only live offers.
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../config/firebase', () => ({ db: {}, auth: null, storage: null }));
vi.mock('../../services/membersService', () => ({ MembersService: {} }));

import { buildMemberCard } from '../../utils/memberCard.mjs';
import { mapMemberToBusinessProfile } from '../../services/businessDirectoryService';

const member = (business: Record<string, unknown>) => ({ role: 'MEMBER', general: { name: 'A' }, business: { companyName: 'Co', ...business } });

describe('directory deal / card summary read both formats, live offers only', () => {
  const cases: [string, Record<string, unknown>, string][] = [
    ['specialOffers only (bug 1)', { specialOffers: [{ description: 'New format', terms: 'T', expiryDate: '2999-01-01' }] }, 'New format'],
    ['first live offer wins', { specialOffers: [{ description: 'P', status: 'Paused' }, { description: 'Live' }] }, 'Live'],
    ['expired offer is not a deal', { specialOffers: [{ description: 'Old', expiryDate: '2000-01-01' }] }, ''],
    ['legacy object', { specialOffer: { description: 'Legacy' } }, 'Legacy'],
    ['legacy string', { specialOffer: 'Legacy str' }, 'Legacy str'],
    ['legacy paused', { specialOffer: { description: 'L', status: 'Paused' } }, ''],
    ['empty array beats stale legacy', { specialOffers: [], specialOffer: 'stale' }, ''],
  ];

  it.each(cases)('%s', (_n, business, expected) => {
    const m = member(business);
    const profile = mapMemberToBusinessProfile('m1', m)!;
    expect(profile.offer).toBe(expected);
    expect(buildMemberCard(m).specialOfferSummary ?? '').toBe(expected);
  });

  it('terms and expiry come from the same live offer', () => {
    const profile = mapMemberToBusinessProfile('m1', member({ specialOffers: [{ description: 'X', status: 'Paused', terms: 'no' }, { description: 'Y', terms: 'T', expiryDate: '2999-01-01' }] }))!;
    expect(profile).toMatchObject({ offer: 'Y', offerTerms: 'T', offerExpiry: '2999-01-01' });
  });
});
