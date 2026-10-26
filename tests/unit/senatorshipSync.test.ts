import { describe, it, expect } from 'vitest';
import {
  buildSenatorshipIndex, resolveSenatorship, buildSenatorshipPlan,
} from '../../netlify/lib/senatorshipSync.mjs';

// Source person records shaped like event_participants persons.
const person = (over: Record<string, unknown> = {}) => ({
  'full name': 'X', senatorship: '', email: '', phone: '', 'NRIC/Passport': '', ...over,
});
// Two source docs (events) with persons carrying senatorship values.
const sourceDocs = [
  { eventId: '1', data: { approved: [
    person({ 'NRIC/Passport': '900101-14-5678', email: 'ic@x.test', phone: '0123456789', senatorship: 'S-12345' }),
    person({ email: 'noval@x.test', phone: '0111111111', senatorship: '' }),       // matched person, blank senatorship
    person({ email: 'confemail@x.test', senatorship: 'S-AAA' }),
    person({ phone: '019-888 7766', senatorship: 'S-BBB' }),
  ] } },
  { eventId: '2', data: { committee: [
    person({ email: 'ic@x.test', senatorship: 'S-12345' }),                         // same person, same value in another event
  ] } },
];

const index = buildSenatorshipIndex(sourceDocs);

describe('resolveSenatorship', () => {
  it('matches by IC and returns the senatorship', () => {
    expect(resolveSenatorship(index, { ic: '900101-14-5678' })).toEqual({ status: 'matched', senatorship: 'S-12345', by: 'ic' });
  });
  it('matches by email (same value across events is not a conflict)', () => {
    expect(resolveSenatorship(index, { email: 'IC@x.test' })).toEqual({ status: 'matched', senatorship: 'S-12345', by: 'email' });
  });
  it('matched a person but blank senatorship -> no-value', () => {
    expect(resolveSenatorship(index, { email: 'noval@x.test' }).status).toBe('no-value');
  });
  it('email and phone point to different people (different numbers) -> conflict', () => {
    expect(resolveSenatorship(index, { email: 'confemail@x.test', phone: '019-888 7766' }).status).toBe('conflict');
  });
  it('no match at all -> none', () => {
    expect(resolveSenatorship(index, { email: 'nobody@x.test' }).status).toBe('none');
  });
});

describe('buildSenatorshipPlan merge rule', () => {
  const mk = (id: string, ic: string, senatorship?: Record<string, unknown>) => ({
    id, general: { idNumber: ic }, contact: { email: '', phone: '' },
    jciCareer: senatorship ? { senatorship } : {},
  });

  it('(a) overwrites when NOT board-validated', () => {
    const members = [mk('m1', '900101-14-5678', { senatorNumber: 'OLD', boardValidated: false })];
    const plan = buildSenatorshipPlan({ members, index });
    expect(plan.counts.wouldWrite).toBe(1);
    expect(plan.writes).toEqual([{ id: 'm1', senatorNumber: 'S-12345', before: 'OLD' }]);
    // preview detail for the UI: name (falls back to id) · old -> new
    expect(plan.items).toEqual([{ name: 'm1', before: 'OLD', incoming: 'S-12345', by: 'ic' }]);
  });

  it('(b) PRESERVES a board-validated number even when the incoming value differs', () => {
    const members = [mk('m1', '900101-14-5678', { senatorNumber: 'KEEP-ME', boardValidated: true })];
    const plan = buildSenatorshipPlan({ members, index });
    expect(plan.counts.wouldWrite).toBe(0);
    expect(plan.counts.skippedBoardValidated).toBe(1);
    expect(plan.writes).toEqual([]);
  });

  it('(c) no incoming value = no-op (never clears)', () => {
    const members = [{ id: 'm2', general: { idNumber: '' }, contact: { email: 'noval@x.test', phone: '' }, jciCareer: { senatorship: { senatorNumber: 'EXISTING' } } }];
    const plan = buildSenatorshipPlan({ members, index });
    expect(plan.counts.wouldWrite).toBe(0);
    expect(plan.counts.skippedNoValue).toBe(1);
    expect(plan.writes).toEqual([]);
  });

  it('(d) conflict is skipped', () => {
    const members = [{ id: 'm3', general: { idNumber: '' }, contact: { email: 'confemail@x.test', phone: '019-888 7766' }, jciCareer: {} }];
    const plan = buildSenatorshipPlan({ members, index });
    expect(plan.counts.wouldWrite).toBe(0);
    expect(plan.counts.conflicts).toBe(1);
  });

  it('writes nothing when the value already matches', () => {
    const members = [mk('m1', '900101-14-5678', { senatorNumber: 'S-12345' })];
    const plan = buildSenatorshipPlan({ members, index });
    expect(plan.counts.alreadySame).toBe(1);
    expect(plan.counts.wouldWrite).toBe(0);
  });

  it('writes a fresh number onto a member with no senatorship object at all', () => {
    const members = [{ id: 'm4', general: { idNumber: '900101-14-5678' }, contact: {}, jciCareer: {} }];
    const plan = buildSenatorshipPlan({ members, index });
    expect(plan.writes).toEqual([{ id: 'm4', senatorNumber: 'S-12345', before: null }]);
  });
});
