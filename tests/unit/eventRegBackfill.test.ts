import { describe, it, expect } from 'vitest';
import {
  mapDietary, personName, personIdentity, isKlMember, buildMemberIndex, matchMemberId, buildBackfillPlan,
} from '../../netlify/lib/eventRegBackfill.mjs';

// A source person as it appears in event_participants arrays (exact field names from the real data).
const person = (over: Record<string, unknown> = {}) => ({
  regcode: 'AAA111', 'full name': 'X', 'NRIC/Passport': '', email: '', phone: '', ...over,
});

// KL members. m-ic matched by IC, m-email by email, m-phone by phone. m-ext is a non-KL member (excluded).
const members = [
  { id: 'm-ic', loId: 'jcikl', general: { name: 'Ivy C', idNumber: '900101-14-5678' }, contact: { email: 'ivy@x.test', phone: '0123456789' } },
  { id: 'm-email', general: { name: 'Ed M' }, contact: { email: 'ed@x.test', phone: '' } },           // loId missing -> KL
  { id: 'm-phone', loId: 'jcikl', general: { name: 'Pat H' }, contact: { email: '', phone: '017-222 3344' } },
  { id: 'm-conf-a', loId: 'jcikl', general: { name: 'Al A' }, contact: { email: 'conf@x.test', phone: '' } },
  { id: 'm-conf-b', loId: 'jcikl', general: { name: 'Bo B' }, contact: { email: '', phone: '019-999 8877' } },
  { id: 'm-ext', loId: 'jcisel', general: { name: 'Ext E' }, contact: { email: 'ext@x.test', phone: '011-111 1111' } },
];
const memberIndex = buildMemberIndex(members);
const membersById = new Map(members.map(m => [m.id, m]));

describe('mapDietary', () => {
  it('maps per the owner rules', () => {
    expect(mapDietary('VEGETARIAN')).toBe('vegetarian');
    expect(mapDietary('veg')).toBe('vegetarian');
    expect(mapDietary('HALAL')).toBe('halal');
    expect(mapDietary('NON HALAL')).toBe('normal');   // contains 'non' -> not halal
    expect(mapDietary('chicken')).toBe('normal');
    expect(mapDietary('')).toBe(null);
    expect(mapDietary(null)).toBe(null);
  });
});

describe('personName fallback', () => {
  it('name on tag -> full name -> fullname -> member.general.name -> null', () => {
    expect(personName({ 'name on tag': 'Tag', 'full name': 'Full' }, undefined)).toBe('Tag');
    expect(personName({ 'name on tag': '  ', 'full name': 'Full' }, undefined)).toBe('Full');       // blank tag skipped
    expect(personName({ 'full name': '', fullname: 'FN' }, undefined)).toBe('FN');
    expect(personName({}, { general: { name: 'Member' } })).toBe('Member');
    expect(personName({}, undefined)).toBe(null);
  });
});

describe('isKlMember', () => {
  it('jcikl or missing is KL; other LO is not', () => {
    expect(isKlMember({ loId: 'jcikl' })).toBe(true);
    expect(isKlMember({})).toBe(true);
    expect(isKlMember({ loId: '' })).toBe(true);
    expect(isKlMember({ loId: 'jcisel' })).toBe(false);
  });
});

describe('buildMemberIndex + matchMemberId', () => {
  it('excludes non-KL members from the index', () => {
    expect(matchMemberId(memberIndex, personIdentity(person({ email: 'ext@x.test' }))).memberId).toBe(null);
  });
  it('matches by IC first', () => {
    expect(matchMemberId(memberIndex, personIdentity(person({ 'NRIC/Passport': '900101-14-5678', email: 'ed@x.test' })))).toEqual({ memberId: 'm-ic', by: 'ic' });
  });
  it('matches by email (normalized)', () => {
    expect(matchMemberId(memberIndex, personIdentity(person({ email: ' ED@X.test ' })))).toEqual({ memberId: 'm-email', by: 'email' });
  });
  it('matches by phone (normalized; contact fallback)', () => {
    expect(matchMemberId(memberIndex, personIdentity(person({ contact: '017-222 3344' })))).toEqual({ memberId: 'm-phone', by: 'phone' });
  });
  it('conflict: email -> A, phone -> different B', () => {
    const r = matchMemberId(memberIndex, personIdentity(person({ email: 'conf@x.test', phone: '019-999 8877' })));
    expect(r.by).toBe('conflict');
    expect(r.memberA).toBe('m-conf-a');
    expect(r.memberB).toBe('m-conf-b');
  });
  it('no match -> none', () => {
    expect(matchMemberId(memberIndex, personIdentity(person({ email: 'nobody@x.test' })))).toEqual({ memberId: null, by: 'none' });
  });
});

describe('buildBackfillPlan', () => {
  const nowIso = '2026-10-26T00:00:00.000Z';
  const eventDoc = {
    approved: [
      person({ regcode: 'IC0001', 'NRIC/Passport': '900101-14-5678', meal: 'VEGETARIAN', tshirt_size: 'L', 'name on tag': 'Ivy!' }),
      person({ regcode: 'EM0001', email: 'ed@x.test', meal: 'HALAL' }),
      person({ regcode: 'CF0001', email: 'conf@x.test', phone: '019-999 8877' }),   // conflict
    ],
    committee: [
      person({ regcode: 'PH0001', phone: '017-222 3344', meal: 'NON HALAL' }),      // committee role
    ],
    trainers: [
      person({ regcode: 'IC0002', 'NRIC/Passport': '900101-14-5678' }),             // dup of m-ic -> approved wins
    ],
  };
  const projects = [
    { id: 'proj1', roadmapId: '8047', title: 'Gala Night', loId: 'jcikl' },
    { id: 'proj2', roadmapId: '9999' },                                             // not in snapshot -> skipped
    { id: 'proj3' },                                                                 // no roadmapId -> skipped
  ];
  const sourceByRoadmap = new Map([['8047', eventDoc]]);

  it('counts, roles, dedupe, and conflict skipping', () => {
    const plan = buildBackfillPlan({ projects, sourceByRoadmap, memberIndex, membersById, existingRegIds: new Set(), nowIso });
    expect(plan.counts.linkedEvents).toBe(1);
    expect(plan.counts.personsMatched).toBe(3);                 // m-ic, m-email, m-phone (m-ic trainer dup not re-counted)
    expect(plan.counts.conflicts).toBe(1);
    expect(plan.counts.alreadyRegistered).toBe(0);
    expect(plan.counts.wouldCreate).toEqual({ approved: 2, pending: 0, committee: 1, trainers: 0, total: 3 });
  });

  it('builds the create docs with role, dietary, name-on-tag and no payment fields', () => {
    const plan = buildBackfillPlan({ projects, sourceByRoadmap, memberIndex, membersById, existingRegIds: new Set(), nowIso });
    const ivy = plan.creates.find(c => c.id === 'proj1_m-ic')!;
    expect(ivy.data).toMatchObject({
      eventId: 'proj1', memberId: 'm-ic', status: 'registered', jciMalaysiaRole: 'approved',
      jciMalaysiaRegcode: 'IC0001', memberName: 'Ivy!', dietary: 'vegetarian', tshirtSize: 'L', loId: 'jcikl',
      emergencyContactName: null, emergencyContactPhone: null, createdAt: nowIso, updatedAt: nowIso,
    });
    // No payment-related fields leak in.
    for (const k of ['paidAt', 'toyyibBillCode', 'financeTransactionId', 'paymentMethod']) {
      expect(k in ivy.data).toBe(false);
    }
    const pat = plan.creates.find(c => c.id === 'proj1_m-phone')!;
    expect(pat.data.jciMalaysiaRole).toBe('committee');
    expect(pat.data.dietary).toBe('normal');                   // "NON HALAL" -> normal
  });

  it('is idempotent: an already-existing registration is skipped (counted, not created)', () => {
    const plan = buildBackfillPlan({
      projects, sourceByRoadmap, memberIndex, membersById,
      existingRegIds: new Set(['proj1_m-ic']), nowIso,
    });
    expect(plan.creates.find(c => c.id === 'proj1_m-ic')).toBeUndefined();
    expect(plan.counts.alreadyRegistered).toBe(1);
    expect(plan.counts.wouldCreate.total).toBe(2);
  });

  it('a conflict resolution routes the create to the chosen member', () => {
    const plan = buildBackfillPlan({
      projects, sourceByRoadmap, memberIndex, membersById, existingRegIds: new Set(),
      resolutions: { 'proj1:CF0001': 'B' }, nowIso,
    });
    expect(plan.counts.conflicts).toBe(0);
    expect(plan.creates.find(c => c.id === 'proj1_m-conf-b')).toBeTruthy();
  });

  it('conflicts carry a resolution key and masked label, never a member email/phone', () => {
    const plan = buildBackfillPlan({ projects, sourceByRoadmap, memberIndex, membersById, existingRegIds: new Set(), nowIso });
    expect(plan.conflicts).toEqual([
      { key: 'proj1:CF0001', label: 'CF0001', memberA: { id: 'm-conf-a', name: 'Al A' }, memberB: { id: 'm-conf-b', name: 'Bo B' } },
    ]);
  });

  it('the PREVIEW response (counts + detail + conflicts) carries no raw email or phone', () => {
    const plan = buildBackfillPlan({ projects, sourceByRoadmap, memberIndex, membersById, existingRegIds: new Set(), nowIso });
    const previewBody = { counts: plan.counts, detail: plan.detail, conflicts: plan.conflicts };
    const json = JSON.stringify(previewBody);
    // Every email/phone that exists in the fixtures must be absent from the preview payload.
    for (const secret of ['ivy@x.test', 'ed@x.test', 'conf@x.test', '0123456789', '0172223344', '0199998877', '900101145678', '900101-14-5678']) {
      expect(json.includes(secret)).toBe(false);
    }
    expect(json).not.toMatch(/@/);
  });
});
