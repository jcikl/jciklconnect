import { describe, it, expect } from 'vitest';
import {
  MAX_PER_CALL, CHAPTER_MEMBER_CAP, isKlAdmin, isActiveChapterAdmin, emailSlotId, mmddFromDob, categoryForChapter,
  validateInvitees, resolveCreateScope, checkChapter, checkCap, buildExternalMemberDoc, cardFor,
  checkStatusTransition, statusUpdates, withStatus, canManageMember,
} from './externalAccounts.mjs';

const SG = 'jcicitysg';
const klAdmin = { role: 'ADMIN', loId: 'jcikl' };
const superAdmin = { role: 'SUPER_ADMIN' };
const chAdmin = { role: 'CHAPTER_ADMIN', loId: SG, affiliation: { status: 'active' } };
const chAdminPending = { role: 'CHAPTER_ADMIN', loId: SG, affiliation: { status: 'pending_kl' } };
const board = { role: 'BOARD', loId: 'jcikl' };
const aff = (status: string, extra: Record<string, unknown> = {}) =>
  ({ role: 'AFFILIATE', loId: SG, general: { name: 'Aff' }, affiliation: { category: 'sister', country: 'Singapore', status, ...extra } });

describe('caller classification', () => {
  it('KL admin = ADMIN / SUPER_ADMIN on a KL doc', () => {
    expect(isKlAdmin(klAdmin)).toBe(true);
    expect(isKlAdmin(superAdmin)).toBe(true);
    expect(isKlAdmin(board)).toBe(false);
    expect(isKlAdmin({ role: 'ADMIN', loId: SG })).toBe(false);
    expect(isKlAdmin(null)).toBe(false);
  });
  it('active chapter admin needs active affiliation and a non-KL loId', () => {
    expect(isActiveChapterAdmin(chAdmin)).toBe(true);
    expect(isActiveChapterAdmin(chAdminPending)).toBe(false);
    expect(isActiveChapterAdmin({ ...chAdmin, loId: 'jcikl' })).toBe(false);
    expect(isActiveChapterAdmin({ ...chAdmin, loId: undefined })).toBe(false);
  });
});

describe('small helpers', () => {
  it('emailSlotId matches membersService sanitising', () => {
    expect(emailSlotId('Tan.Wei+x@Example.com')).toBe('tan.wei_x@example.com');
  });
  it('mmddFromDob', () => {
    expect(mmddFromDob('1990-07-06')).toBe('0706');
    expect(mmddFromDob('07/06/1990')).toBeNull();
    expect(mmddFromDob(undefined)).toBeNull();
  });
  it('categoryForChapter', () => {
    expect(categoryForChapter({ type: ['sister_lo', 'apicc'] })).toBe('sister');
    expect(categoryForChapter({ type: ['apicc'] })).toBe('apicc');
    expect(categoryForChapter({ type: ['global'] })).toBe('global');
    expect(categoryForChapter({})).toBe('sister');
  });
});

describe('validateInvitees', () => {
  it('accepts 1–20 rows, lower-cases emails, keeps a valid dob', () => {
    const r = validateInvitees([{ name: ' Ann ', email: ' Ann@X.com ', dob: '1990-01-02' }, { name: 'Bo', email: 'bo@x.com' }]);
    expect(r).toEqual({ ok: true, invitees: [{ name: 'Ann', email: 'ann@x.com', dob: '1990-01-02' }, { name: 'Bo', email: 'bo@x.com' }] });
  });
  it('rejects empty, too many, bad email, bad dob, repeated email', () => {
    expect(validateInvitees([]).ok).toBe(false);
    expect(validateInvitees(undefined).ok).toBe(false);
    expect(validateInvitees(Array.from({ length: MAX_PER_CALL + 1 }, (_, i) => ({ name: 'n', email: `a${i}@x.com` }))).ok).toBe(false);
    expect(validateInvitees([{ name: 'n', email: 'nope' }]).ok).toBe(false);
    expect(validateInvitees([{ name: '', email: 'a@x.com' }]).ok).toBe(false);
    expect(validateInvitees([{ name: 'n', email: 'a@x.com', dob: '2/3/1990' }]).ok).toBe(false);
    expect(validateInvitees([{ name: 'n', email: 'a@x.com' }, { name: 'm', email: 'A@x.com' }]).ok).toBe(false);
  });
});

describe('resolveCreateScope', () => {
  it('createChapterAdmin: KL admin only, names a non-KL chapter', () => {
    expect(resolveCreateScope('createChapterAdmin', klAdmin, SG)).toEqual({ ok: true, loId: SG, role: 'CHAPTER_ADMIN' });
    expect(resolveCreateScope('createChapterAdmin', superAdmin, SG)).toMatchObject({ ok: true });
    expect(resolveCreateScope('createChapterAdmin', chAdmin, SG)).toMatchObject({ ok: false, status: 403 });
    expect(resolveCreateScope('createChapterAdmin', board, SG)).toMatchObject({ ok: false, status: 403 });
    expect(resolveCreateScope('createChapterAdmin', klAdmin, 'jcikl')).toMatchObject({ ok: false, status: 400 });
    expect(resolveCreateScope('createChapterAdmin', klAdmin, '')).toMatchObject({ ok: false, status: 400 });
  });
  it('inviteMember: chapter admin is forced to own chapter and AFFILIATE (body loId ignored)', () => {
    expect(resolveCreateScope('inviteMember', chAdmin, 'jcitokyo')).toEqual({ ok: true, loId: SG, role: 'AFFILIATE' });
    expect(resolveCreateScope('inviteMember', chAdminPending, SG)).toMatchObject({ ok: false, status: 403 });
    expect(resolveCreateScope('inviteMember', klAdmin, 'jcitokyo')).toEqual({ ok: true, loId: 'jcitokyo', role: 'AFFILIATE' });
    expect(resolveCreateScope('inviteMember', klAdmin, undefined)).toMatchObject({ ok: false, status: 400 });
    expect(resolveCreateScope('inviteMember', board, SG)).toMatchObject({ ok: false, status: 403 });
    expect(resolveCreateScope('inviteMember', aff('active'), SG)).toMatchObject({ ok: false, status: 403 });
  });
});

describe('chapter and cap checks', () => {
  it('chapter must exist and be active', () => {
    expect(checkChapter(null)).toMatchObject({ ok: false, status: 404 });
    expect(checkChapter({ isActive: false })).toMatchObject({ ok: false, status: 409 });
    expect(checkChapter({ isActive: true })).toEqual({ ok: true });
  });
  it('cap of 100 per chapter', () => {
    expect(checkCap(CHAPTER_MEMBER_CAP - 2, 2).ok).toBe(true);
    expect(checkCap(CHAPTER_MEMBER_CAP - 1, 2).ok).toBe(false);
  });
});

describe('buildExternalMemberDoc', () => {
  const chapter = { country: 'Singapore', type: ['sister_lo'], isActive: true };
  it('builds an active AFFILIATE doc with birthdayMMDD from dob and a card', () => {
    const d = buildExternalMemberDoc({
      role: 'AFFILIATE', loId: SG, chapter, invitee: { name: 'Ann', email: 'ann@x.com', dob: '1990-07-06' },
      callerUid: 'u1', nowIso: '2026-10-19T00:00:00.000Z', createdAt: 'TS',
    });
    expect(d).toMatchObject({
      role: 'AFFILIATE', loId: SG,
      affiliation: { category: 'sister', country: 'Singapore', status: 'active', activatedAt: '2026-10-19T00:00:00.000Z', statusUpdatedBy: 'u1' },
      general: { name: 'Ann', dob: '1990-07-06' }, contact: { email: 'ann@x.com' },
      birthdayMMDD: '0706', privacy: { shareCardInternationally: false }, createdBy: 'u1',
    });
    const card = cardFor(d, 'now');
    expect(card).toMatchObject({ displayName: 'Ann', loId: SG, international: false, country: 'Singapore' });
  });
  it('omits dob / birthdayMMDD when not given (no undefined values)', () => {
    const d = buildExternalMemberDoc({ role: 'CHAPTER_ADMIN', loId: SG, chapter, invitee: { name: 'C', email: 'c@x.com' }, callerUid: 'u', nowIso: 'n', createdAt: 'TS' });
    expect(d.general).toEqual({ name: 'C' });
    expect(d).not.toHaveProperty('birthdayMMDD');
    expect(JSON.stringify(d)).not.toContain('undefined');
  });
});

describe('checkStatusTransition', () => {
  const ok = (caller: any, target: any, next: string, targetId = 't1') => checkStatusTransition(caller, 'caller', targetId, target, next).ok;

  it('chapter admin: approve, reject, suspend, reactivate (only if previously active)', () => {
    expect(ok(chAdmin, aff('pending_chapter'), 'pending_kl')).toBe(true);
    expect(ok(chAdmin, aff('pending_chapter'), 'rejected')).toBe(true);
    expect(ok(chAdmin, aff('pending_kl'), 'rejected')).toBe(true);
    expect(ok(chAdmin, aff('active'), 'suspended')).toBe(true);
    expect(ok(chAdmin, aff('suspended', { activatedAt: '2026-01-01' }), 'active')).toBe(true);
    expect(ok(chAdmin, aff('suspended'), 'active')).toBe(false);
  });
  it('chapter admin may never set pending_kl → active or touch other chapters / roles / self', () => {
    expect(ok(chAdmin, aff('pending_kl'), 'active')).toBe(false);
    expect(ok(chAdmin, aff('pending_chapter'), 'active')).toBe(false);
    expect(ok(chAdmin, { ...aff('pending_chapter'), loId: 'jcitokyo' }, 'pending_kl')).toBe(false);
    expect(ok(chAdmin, { ...aff('active'), role: 'CHAPTER_ADMIN' }, 'suspended')).toBe(false);
    expect(ok(chAdmin, aff('active'), 'suspended', 'caller')).toBe(false);
    expect(ok(chAdminPending, aff('pending_chapter'), 'pending_kl')).toBe(false);
    expect(ok(chAdmin, aff('rejected'), 'pending_kl')).toBe(false);
    expect(ok(chAdmin, aff('active'), 'expired')).toBe(false);
  });
  it('KL admin may do any transition on an external doc, including pending_kl → active', () => {
    expect(ok(klAdmin, aff('pending_kl'), 'active')).toBe(true);
    expect(ok(superAdmin, aff('rejected'), 'pending_chapter')).toBe(true);
    expect(ok(klAdmin, { ...aff('active'), role: 'CHAPTER_ADMIN' }, 'suspended')).toBe(true);
  });
  it('refuses unknown status, unchanged status, missing or KL targets, other roles', () => {
    expect(ok(klAdmin, aff('active'), 'bogus')).toBe(false);
    expect(ok(klAdmin, aff('active'), 'active')).toBe(false);
    expect(ok(klAdmin, null, 'active')).toBe(false);
    expect(ok(klAdmin, { role: 'MEMBER', loId: 'jcikl' }, 'suspended')).toBe(false);
    expect(ok(board, aff('pending_kl'), 'active')).toBe(false);
    expect(ok(aff('active'), aff('pending_chapter'), 'pending_kl')).toBe(false);
  });
});

describe('statusUpdates / withStatus / card sync', () => {
  it('approve stamps chapterApproved*, KL activation stamps klApproved* and activatedAt once', () => {
    const a = statusUpdates(chAdmin, 'c', aff('pending_chapter'), 'pending_kl', 'T');
    expect(a).toMatchObject({ 'affiliation.status': 'pending_kl', 'affiliation.chapterApprovedBy': 'c', 'affiliation.statusUpdatedBy': 'c', updatedBy: 'c' });
    const b = statusUpdates(klAdmin, 'k', aff('pending_kl'), 'active', 'T');
    expect(b).toMatchObject({ 'affiliation.klApprovedBy': 'k', 'affiliation.activatedAt': 'T' });
    const c = statusUpdates(chAdmin, 'c', aff('suspended', { activatedAt: 'OLD' }), 'active', 'T');
    expect(b).toHaveProperty(['affiliation.activatedAt']);
    expect(c).not.toHaveProperty(['affiliation.activatedAt']);
    expect(c).not.toHaveProperty(['affiliation.klApprovedBy']);
  });
  it('card exists only while active', () => {
    const active = withStatus(aff('pending_kl'), statusUpdates(klAdmin, 'k', aff('pending_kl'), 'active', 'T'));
    expect(active.affiliation.status).toBe('active');
    expect(cardFor(active, 'T')).not.toBeNull();
    const suspended = withStatus(aff('active'), statusUpdates(chAdmin, 'c', aff('active'), 'suspended', 'T'));
    expect(cardFor(suspended, 'T')).toBeNull();
  });
});

describe('canManageMember (resendInvite)', () => {
  it('KL admin: any external; chapter admin: own-chapter AFFILIATE, not self', () => {
    expect(canManageMember(klAdmin, 'k', 't', { ...aff('active'), role: 'CHAPTER_ADMIN' })).toBe(true);
    expect(canManageMember(klAdmin, 'k', 't', { role: 'MEMBER', loId: 'jcikl' })).toBe(false);
    expect(canManageMember(chAdmin, 'c', 't', aff('active'))).toBe(true);
    expect(canManageMember(chAdmin, 'c', 'c', aff('active'))).toBe(false);
    expect(canManageMember(chAdmin, 'c', 't', { ...aff('active'), loId: 'jcitokyo' })).toBe(false);
    expect(canManageMember(board, 'b', 't', aff('active'))).toBe(false);
  });
});
