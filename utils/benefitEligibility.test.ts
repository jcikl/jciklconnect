import { describe, it, expect } from 'vitest';
import { getBenefitEligibility, type BenefitViewer, type BenefitTargetable } from './benefitEligibility';

const kl: BenefitViewer = { isKl: true, role: 'MEMBER', tier: 'Gold', country: 'Malaysia' };
const admin: BenefitViewer = { isKl: true, role: 'ADMIN', country: 'Malaysia' };
const sg: BenefitViewer = { isKl: false, role: 'AFFILIATE', category: 'sister', country: 'Singapore' };
const apicc: BenefitViewer = { isKl: false, role: 'AFFILIATE', category: 'apicc', country: 'Thailand' };
const glob: BenefitViewer = { isKl: false, role: 'CHAPTER_ADMIN', category: 'global', country: 'Japan' };

const item = (targetCriteria?: BenefitTargetable['targetCriteria']): BenefitTargetable => ({ targetCriteria });

type Row = [string, BenefitTargetable, BenefitViewer, true | string];

const rows: Row[] = [
  // audience: missing / empty = KL only
  ['no criteria, KL', item(), kl, true],
  ['no audiences, KL', item({ tiers: [] }), kl, true],
  ['empty audiences, KL', item({ audiences: [] }), kl, true],
  ['no audiences, sister', item(), sg, 'JCI KL members only'],
  ['empty audiences, apicc', item({ audiences: [] }), apicc, 'JCI KL members only'],
  ['kl audience, external', item({ audiences: ['kl'] }), glob, 'JCI KL members only'],
  // audience matching
  ['sister audience, sister viewer', item({ audiences: ['sister'] }), sg, true],
  ['sister audience, apicc viewer', item({ audiences: ['sister'] }), apicc, 'Not available to your chapter network'],
  ['sister audience, KL viewer', item({ audiences: ['sister'] }), kl, 'Not available to JCI KL members'],
  ['kl+sister, KL', item({ audiences: ['kl', 'sister'] }), kl, true],
  ['kl+sister, sister', item({ audiences: ['kl', 'sister'] }), sg, true],
  ['kl+sister, apicc', item({ audiences: ['kl', 'sister'] }), apicc, 'Not available to your chapter network'],
  ['global audience, global viewer', item({ audiences: ['global'] }), glob, true],
  ['all audiences, apicc', item({ audiences: ['kl', 'sister', 'apicc', 'global'] }), apicc, true],
  ['external without category', item({ audiences: ['sister'] }), { isKl: false, country: 'Singapore' }, 'Not available to your chapter network'],
  // country
  ['country match (KL = Malaysia)', item({ audiences: ['kl'], countries: ['Malaysia'] }), kl, true],
  ['country mismatch KL', item({ audiences: ['kl'], countries: ['Singapore'] }), kl, 'Not available in Malaysia'],
  ['country match external, case-insens', item({ audiences: ['sister'], countries: ['singapore'] }), sg, true],
  ['country mismatch external', item({ audiences: ['sister', 'apicc'], countries: ['Singapore'] }), apicc, 'Not available in Thailand'],
  ['country list multi', item({ audiences: ['sister', 'apicc'], countries: ['Singapore', 'Thailand'] }), apicc, true],
  ['country set, external country missing', item({ audiences: ['sister'], countries: ['Singapore'] }), { isKl: false, category: 'sister' }, 'Not available in your country'],
  ['audience checked before country', item({ audiences: ['kl'], countries: ['Singapore'] }), sg, 'JCI KL members only'],
  // role / tier
  ['role match', item({ roles: ['MEMBER', 'BOARD'] }), kl, true],
  ['role mismatch', item({ roles: ['BOARD'] }), kl, 'Not available for your role'],
  ['admin bypasses role', item({ roles: ['BOARD'] }), admin, true],
  ['legacy membership-type roles ignored', item({ roles: ['official member', 'probation member'] }), kl, true],
  ['tier match', item({ tiers: ['Gold'] }), kl, true],
  ['tier mismatch', item({ tiers: ['Platinum'] }), kl, 'Not available for your tier'],
  ['tier required, viewer has none', item({ tiers: ['Gold'] }), { isKl: true, role: 'MEMBER' }, 'Not available for your tier'],
  ['role mismatch external', item({ audiences: ['sister'], roles: ['MEMBER'] }), sg, 'Not available for your role'],
];

describe('getBenefitEligibility', () => {
  it.each(rows)('%s', (_name, target, viewer, expected) => {
    const r = getBenefitEligibility(target, viewer);
    if (expected === true) expect(r).toEqual({ eligible: true });
    else {
      expect(r.eligible).toBe(false);
      if ("label" in r) expect(r.label).toBe(expected);
    }
  });
});
