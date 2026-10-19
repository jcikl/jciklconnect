import { describe, it, expect } from 'vitest';
import { buildMemberCard, shouldHaveCard, planCardSync, applyMemberUpdates } from './memberCard.mjs';

const NOW = '2026-10-19T00:00:00.000Z';
const RULE_KEYS = [
  'displayName', 'avatarUrl', 'loId', 'country', 'companyName', 'position', 'department', 'industry',
  'businessCategory', 'companyDescription', 'website', 'acceptInternationalBusiness', 'specialOfferSummary',
  'international', 'updatedAt',
];

const full = {
  id: 'm1', role: 'MEMBER', loId: 'jcikl',
  general: { name: 'Ali Tan', avatarUrl: 'https://img/a.png' },
  business: {
    companyName: 'Acme', position: 'Director', departmentAndPosition: 'Sales Dept', industry: 'IT',
    businessCategory: ['Software', 'AI'], companyDescription: 'We build', companyWebsite: 'https://acme.example',
    acceptInternationalBusiness: 'Yes', specialOffer: { description: '10% off' },
  },
  privacy: { shareCardInternationally: true },
};

describe('buildMemberCard', () => {
  it('maps every field from the Member', () => {
    expect(buildMemberCard(full, NOW)).toEqual({
      displayName: 'Ali Tan', avatarUrl: 'https://img/a.png', loId: 'jcikl', country: 'Malaysia',
      companyName: 'Acme', position: 'Director', department: 'Sales Dept', industry: 'IT',
      businessCategory: ['Software', 'AI'], companyDescription: 'We build', website: 'https://acme.example',
      acceptInternationalBusiness: 'Yes', specialOfferSummary: '10% off', international: true, updatedAt: NOW,
    });
  });

  it('uses fallbacks: general.avatar, flat companyName/industry, business.introduction, string specialOffer', () => {
    const card = buildMemberCard({
      role: 'MEMBER', general: { name: 'B', avatar: 'av' }, companyName: 'Flat Co', industry: 'Retail',
      business: { introduction: 'intro', specialOffer: 'free coffee' },
    }, NOW);
    expect(card).toMatchObject({
      avatarUrl: 'av', companyName: 'Flat Co', industry: 'Retail', companyDescription: 'intro', specialOfferSummary: 'free coffee',
    });
  });

  it('never emits undefined / null / empty values and only rule-allowed keys', () => {
    const card = buildMemberCard({ role: 'MEMBER', general: { name: 'Min', avatarUrl: '  ' }, business: { companyName: '', businessCategory: [] } }, NOW);
    expect(Object.keys(card).sort()).toEqual(['country', 'displayName', 'international', 'loId', 'updatedAt']);
    for (const v of Object.values(card)) expect(v).not.toBeUndefined();
    for (const k of Object.keys(buildMemberCard(full, NOW))) expect(RULE_KEYS).toContain(k);
  });

  it('international defaults to false and is true only for exactly true', () => {
    expect(buildMemberCard({ role: 'MEMBER', general: { name: 'A' } }, NOW).international).toBe(false);
    expect(buildMemberCard({ role: 'MEMBER', general: { name: 'A' }, privacy: { shareCardInternationally: false } }, NOW).international).toBe(false);
    expect(buildMemberCard({ role: 'MEMBER', general: { name: 'A' }, privacy: { shareCardInternationally: 'yes' } }, NOW).international).toBe(false);
  });

  it('loId defaults to jcikl; external takes country from affiliation', () => {
    expect(buildMemberCard({ role: 'MEMBER', general: { name: 'A' } }, NOW).loId).toBe('jcikl');
    const ext = buildMemberCard({ role: 'AFFILIATE', loId: 'jcicitysg', general: { name: 'E' }, affiliation: { status: 'active', country: 'Singapore' } }, NOW);
    expect(ext).toMatchObject({ loId: 'jcicitysg', country: 'Singapore' });
  });

  it('external without affiliation.country omits country (not Malaysia)', () => {
    const ext = buildMemberCard({ role: 'AFFILIATE', loId: 'x', general: { name: 'E' }, affiliation: { status: 'active' } }, NOW);
    expect('country' in ext).toBe(false);
  });
});

describe('shouldHaveCard / planCardSync', () => {
  const ext = (status: string) => ({ role: 'AFFILIATE', loId: 'jcicitysg', general: { name: 'E' }, affiliation: { status, country: 'SG' } });

  it('card exists for MEMBER+ and active externals only', () => {
    for (const role of ['MEMBER', 'BOARD', 'ADMIN', 'SUPER_ADMIN']) expect(shouldHaveCard({ role })).toBe(true);
    for (const role of ['GUEST', 'INACTIVE', undefined]) expect(shouldHaveCard({ role })).toBe(false);
    expect(shouldHaveCard(ext('active'))).toBe(true);
    for (const s of ['pending_chapter', 'pending_kl', 'suspended', 'expired']) expect(shouldHaveCard(ext(s))).toBe(false);
    expect(shouldHaveCard(null)).toBe(false);
  });

  it('create: upsert for qualifying member, none otherwise', () => {
    expect(planCardSync(null, full)).toBe('upsert');
    expect(planCardSync(null, { ...full, role: 'GUEST' })).toBe('none');
  });

  it('role/status changes: promote creates, demote/INACTIVE deletes', () => {
    expect(planCardSync({ ...full, role: 'GUEST' }, full)).toBe('upsert');
    expect(planCardSync(full, { ...full, role: 'INACTIVE' })).toBe('delete');
    expect(planCardSync(full, { ...full, role: 'GUEST' })).toBe('delete');
    expect(planCardSync(ext('active'), ext('suspended'))).toBe('delete');
    expect(planCardSync(ext('pending_kl'), ext('active'))).toBe('upsert');
  });

  it('keeps the card (none) when nothing card-relevant changed', () => {
    expect(planCardSync(full, { ...full, jciCareer: { points: 5 } })).toBe('none');
    expect(planCardSync({ ...full, role: 'MEMBER' }, { ...full, role: 'BOARD' })).toBe('none');
  });

  it('rewrites the card when a card field or the opt-in changes', () => {
    expect(planCardSync(full, { ...full, general: { name: 'New Name' } })).toBe('upsert');
    expect(planCardSync(full, { ...full, privacy: { shareCardInternationally: false } })).toBe('upsert');
    expect(planCardSync(full, { ...full, loId: 'other' })).toBe('upsert');
  });

  it('forceDelete deletes even if the member never qualified', () => {
    expect(planCardSync({ role: 'GUEST' }, { role: 'INACTIVE' }, { forceDelete: true })).toBe('delete');
  });
});

describe('applyMemberUpdates', () => {
  it('handles dot-paths, top-level replace and deleteField without mutating the input', () => {
    const before = { general: { name: 'A' }, business: { companyName: 'Old', position: 'P' }, privacy: { showPhone: true } };
    const after = applyMemberUpdates(before, {
      'business.companyName': 'New',
      privacy: { shareCardInternationally: true },
      'business.position': { _methodName: 'deleteField' },
      companyName: 'Flat',
      skipped: undefined,
    });
    expect(after.business).toEqual({ companyName: 'New' });
    expect(after.privacy).toEqual({ shareCardInternationally: true });
    expect(after.companyName).toBe('Flat');
    expect('skipped' in after).toBe(false);
    expect(before.business).toEqual({ companyName: 'Old', position: 'P' });
  });

  it('creates missing parents for dot-paths', () => {
    expect(applyMemberUpdates({}, { 'business.companyDescription': 'x' })).toEqual({ business: { companyDescription: 'x' } });
  });
});
