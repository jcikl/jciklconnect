import { describe, it, expect } from 'vitest';
import {
  icKey, buildEventLookup, buildRegcodeIndex, matchRegcode, memberIdentity, resolveRegcode, buildPlan,
} from '../../netlify/lib/eventRegcode.mjs';

// One source event doc shaped like event_participants/{yyyy00}/{LO}/{eventId}.
const person = (over: Record<string, unknown> = {}) => ({
  'full name': 'X', regcode: 'AAA111', email: '', phone: '', 'NRIC/Passport': '', ...over,
});
const eventDoc = {
  approved: [
    person({ regcode: 'IC1234', 'NRIC/Passport': '900101-14-5678', email: 'ic@x.test', phone: '0123456789' }),
    person({ regcode: 'EMAILX', email: 'By.Email@X.test' }),
    person({ regcode: 'PHONEX', phone: '+60 17-222 3344' }),
    person({ regcode: 'CONFEM', email: 'conflict@x.test' }),
    person({ regcode: 'CONFPH', phone: '019-999 8877' }),
  ],
  pending: [person({ regcode: 'PEND01', email: 'pending@x.test' })],
};

describe('icKey', () => {
  it('strips non-alphanumerics and uppercases', () => {
    expect(icKey('900101-14-5678')).toBe('900101145678');
    expect(icKey(' a12-34 b ')).toBe('A1234B');
    expect(icKey(null)).toBe('');
  });
});

describe('matchRegcode', () => {
  const lookup = buildEventLookup(eventDoc);

  it('matches by IC first', () => {
    expect(matchRegcode(lookup, { ic: '900101145678', email: 'by.email@x.test' })).toEqual({ regcode: 'IC1234', by: 'ic' });
  });
  it('matches by email (normalized case/trim)', () => {
    expect(matchRegcode(lookup, { email: '  BY.EMAIL@x.TEST ' })).toEqual({ regcode: 'EMAILX', by: 'email' });
  });
  it('matches by phone (normalized: drops 60 / leading 0)', () => {
    expect(matchRegcode(lookup, { phone: '017-222 3344' })).toEqual({ regcode: 'PHONEX', by: 'phone' });
  });
  it('conflict: email and phone point to different regcodes -> no regcode', () => {
    expect(matchRegcode(lookup, { email: 'conflict@x.test', phone: '019-999 8877' })).toEqual({ regcode: null, by: 'conflict' });
  });
  it('no match -> none', () => {
    expect(matchRegcode(lookup, { email: 'nobody@x.test', phone: '0000' })).toEqual({ regcode: null, by: 'none' });
  });
  it('pending-array persons are matched too', () => {
    expect(matchRegcode(lookup, { email: 'pending@x.test' }).regcode).toBe('PEND01');
  });
});

describe('resolveRegcode', () => {
  const index = buildRegcodeIndex([{ eventId: '8047', data: eventDoc }]);
  const member = { general: { idNumber: '900101-14-5678' }, contact: { email: 'ic@x.test', phone: '0123456789' } };

  it('resolves via project.roadmapId', () => {
    expect(resolveRegcode({ project: { roadmapId: '8047' }, member, index })).toEqual({ regcode: 'IC1234', by: 'ic' });
  });
  it('no roadmapId', () => {
    expect(resolveRegcode({ project: {}, member, index }).reason).toBe('no-roadmapId');
  });
  it('event not in snapshot', () => {
    expect(resolveRegcode({ project: { roadmapId: '9999' }, member, index }).reason).toBe('event-not-in-snapshot');
  });
  it('member not in the event list', () => {
    const stranger = { general: { idNumber: 'ZZ' }, contact: { email: 'none@x.test', phone: '1' } };
    expect(resolveRegcode({ project: { roadmapId: '8047' }, member: stranger, index }).reason).toBe('member-not-in-list');
  });
  it('conflict is reported', () => {
    const conf = { contact: { email: 'conflict@x.test', phone: '019-999 8877' } };
    expect(resolveRegcode({ project: { roadmapId: '8047' }, member: conf, index }).reason).toBe('conflict');
  });
});

describe('memberIdentity', () => {
  it('reads general.idNumber + contact.email/phone', () => {
    expect(memberIdentity({ general: { idNumber: 'A1' }, contact: { email: 'e', phone: 'p' } })).toEqual({ ic: 'A1', email: 'e', phone: 'p' });
  });
});

describe('buildPlan', () => {
  const index = buildRegcodeIndex([{ eventId: '8047', data: eventDoc }]);
  const projectsById = new Map([['ev1', { roadmapId: '8047' }], ['ev2', { roadmapId: '9999' }], ['ev3', {}]]);
  const membersById = new Map([
    ['m-ic', { general: { idNumber: '900101-14-5678' }, contact: { email: 'ic@x.test', phone: '0123456789' } }],
    ['m-none', { contact: { email: 'nobody@x.test' } }],
    ['m-conf', { contact: { email: 'conflict@x.test', phone: '019-999 8877' } }],
  ]);
  const registrations = [
    { id: 'ev1_m-ic', eventId: 'ev1', memberId: 'm-ic' },                                   // would write IC1234
    { id: 'ev1_m-ic2', eventId: 'ev1', memberId: 'm-ic', jciMalaysiaRegcode: 'IC1234' },     // already set
    { id: 'ev1_m-none', eventId: 'ev1', memberId: 'm-none' },                               // member not in list
    { id: 'ev1_m-conf', eventId: 'ev1', memberId: 'm-conf' },                               // conflict
    { id: 'ev2_m-ic', eventId: 'ev2', memberId: 'm-ic' },                                   // event not in snapshot
    { id: 'ev3_m-ic', eventId: 'ev3', memberId: 'm-ic' },                                   // no roadmapId
    { id: 'evX_m-ic', eventId: 'ev-missing', memberId: 'm-ic' },                            // project missing -> no roadmapId
  ];

  const plan = buildPlan({ registrations, projectsById, membersById, index });

  it('counts each outcome', () => {
    expect(plan.counts.registrations).toBe(7);
    expect(plan.counts.linkable).toBe(5);           // ev1 x4 + ev2 x1 (both have roadmapId)
    expect(plan.counts.wouldGetRegcode).toBe(2);    // m-ic twice
    expect(plan.counts.alreadySet).toBe(1);
    expect(plan.counts.toWrite).toBe(1);
    expect(plan.counts.conflicts).toBe(1);
    expect(plan.counts.memberNotInList).toBe(1);
    expect(plan.counts.eventNotInSnapshot).toBe(1);
    expect(plan.counts.noRoadmapId).toBe(2);        // ev3 (empty project) + missing project
  });
  it('writes carry only id + regcode (no PII)', () => {
    expect(plan.writes).toEqual([{ id: 'ev1_m-ic', regcode: 'IC1234' }]);
  });
});
