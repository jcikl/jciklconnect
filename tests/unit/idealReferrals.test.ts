// utils/idealReferrals.mjs — the one normaliser for business.idealReferrals / idealReferralIndustry,
// and the MembersService.normalizeMemberData write path that uses it.
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../config/firebase', () => ({ db: {}, auth: null, storage: null }));
// normalizeMemberData is pure; stub the Firestore refs that services build at import time.
vi.mock('firebase/firestore', async importOriginal => ({
  ...(await importOriginal<object>()),
  collection: () => ({}),
  doc: () => ({}),
}));

import {
  normalizeIdealReferrals,
  joinIdealReferralIndustries,
  isIndustryOption,
  isReferralTypeOption,
} from '../../utils/idealReferrals.mjs';
import { MembersService } from '../../services/membersService';

const PETER_YU = [
  'Event & Hospitality||Crypto||Blockchain||Finance & Insurance||Real Estate & Property Services||Travel & Tourism||Architecture',
  'Engineering & Construction',
];
const PETER_YU_CLEAN = [
  'Event & Hospitality',
  'Crypto, Blockchain, Finance & Insurance',
  'Real Estate & Property Services',
  'Travel & Tourism',
  'Architecture, Engineering & Construction',
];

describe('normalizeIdealReferrals', () => {
  it('PETER YU: splits on ||, rejoins fragments of comma names across elements', () => {
    expect(normalizeIdealReferrals(PETER_YU)).toEqual(PETER_YU_CLEAN);
  });

  it('JCI KL: clean types stay as they are', () => {
    expect(normalizeIdealReferrals(['Suppliers / Vendors', 'Marketing / Branding Partners']))
      .toEqual(['Suppliers / Vendors', 'Marketing / Branding Partners']);
  });

  it("legacy ', '-joined string of known options is split; a comma name stays whole", () => {
    expect(normalizeIdealReferrals('Telecom, AI, Computers & IT, Event & Hospitality'))
      .toEqual(['Telecom, AI, Computers & IT', 'Event & Hospitality']);
    expect(normalizeIdealReferrals('Investors, Resellers')).toEqual(['Investors', 'Resellers']);
    expect(normalizeIdealReferrals('Architecture, Engineering & Construction')).toEqual(['Architecture, Engineering & Construction']);
  });

  it('free text with a comma is not split', () => {
    expect(normalizeIdealReferrals('SME owners in F&B, retail')).toEqual(['SME owners in F&B, retail']);
    expect(normalizeIdealReferrals(['Banks', 'Investors, my friends'])).toEqual(['Banks', 'Investors, my friends']);
  });

  it('trims, drops blanks / non-strings, takes exact option labels and de-duplicates ignoring case', () => {
    expect(normalizeIdealReferrals([' investors ', '', '  ', 42, null, 'Investors', 'Banks||banks||'])).toEqual(['Investors', 'Banks']);
    expect(normalizeIdealReferrals(undefined)).toEqual([]);
    expect(normalizeIdealReferrals('')).toEqual([]);
  });

  it("joinIdealReferralIndustries joins with '||' (safe: no option contains it)", () => {
    expect(joinIdealReferralIndustries(PETER_YU)).toBe(PETER_YU_CLEAN.join('||'));
    expect(joinIdealReferralIndustries('Event & Hospitality, Travel & Tourism')).toBe('Event & Hospitality||Travel & Tourism');
    expect(joinIdealReferralIndustries('')).toBe('');
  });

  it('classifies industries and referral types', () => {
    expect(isIndustryOption('crypto, blockchain, finance & insurance')).toBe(true);
    expect(isIndustryOption('Investors')).toBe(false);
    expect(isReferralTypeOption('Suppliers / Vendors')).toBe(true);
    expect(isReferralTypeOption('Travel & Tourism')).toBe(false);
    expect(isIndustryOption('Other') && isReferralTypeOption('Other')).toBe(true);
  });
});

describe('MembersService.normalizeMemberData — ideal referral fields', () => {
  it('industries never fall back into business.idealReferrals (the PETER YU bug)', () => {
    const out = MembersService.normalizeMemberData({
      idealReferralIndustry: 'Event & Hospitality||Architecture, Engineering & Construction',
    });
    expect(out.business?.idealReferrals).toBeUndefined();
    expect(out.idealReferralIndustry).toBe('Event & Hospitality||Architecture, Engineering & Construction');
  });

  it("stores idealReferralIndustry '||'-joined whatever separator the caller used", () => {
    expect(MembersService.normalizeMemberData({ idealReferralIndustry: 'Event & Hospitality, Travel & Tourism' }).idealReferralIndustry)
      .toBe('Event & Hospitality||Travel & Tourism');
    expect(MembersService.normalizeMemberData({ idealReferralIndustry: ['Travel & Tourism'] }).idealReferralIndustry)
      .toBe('Travel & Tourism');
    expect(MembersService.normalizeMemberData({ idealReferralIndustry: '' }).idealReferralIndustry).toBe('');
  });

  it('stores referral types as a clean array from any input shape', () => {
    expect(MembersService.normalizeMemberData({ idealReferral: 'Investors, Resellers' }).business.idealReferrals)
      .toEqual(['Investors', 'Resellers']);
    expect(MembersService.normalizeMemberData({ idealReferral: ['Investors', ' '] }).business.idealReferrals)
      .toEqual(['Investors']);
    expect(MembersService.normalizeMemberData({ business: { idealReferrals: PETER_YU } }).business.idealReferrals)
      .toEqual(PETER_YU_CLEAN);
    expect(MembersService.normalizeMemberData({ idealReferral: [] }).business.idealReferrals).toEqual([]);
  });
});
