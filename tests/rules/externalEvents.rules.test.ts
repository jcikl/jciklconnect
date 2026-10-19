// @vitest-environment node
/**
 * Firestore security-rules tests: external members registering for events (Phase 1 WP-6).
 * Emulator only (skipped otherwise). Same REST harness as externalMembers.rules.test.ts.
 */
import { describe, it, expect, beforeAll } from 'vitest';

const HOST = process.env.FIRESTORE_EMULATOR_HOST;
const PROJECT = process.env.GCLOUD_PROJECT || 'demo-jcikl-rules';
const ROOT = `projects/${PROJECT}/databases/(default)/documents`;
const BASE = `http://${HOST}/v1/${ROOT}`;

type Plain = null | boolean | number | string | Plain[] | { [key: string]: Plain };
type Doc = { [key: string]: Plain };
type FsValue = Record<string, unknown>;

function toValue(v: Plain): FsValue {
  if (v === null) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toValue) } };
  return { mapValue: { fields: toFields(v) } };
}
function toFields(d: Doc): Record<string, FsValue> {
  const out: Record<string, FsValue> = {};
  for (const [k, v] of Object.entries(d)) out[k] = toValue(v);
  return out;
}
const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
function authHeader(uid: string | 'owner'): Record<string, string> {
  if (uid === 'owner') return { Authorization: 'Bearer owner' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: `https://securetoken.google.com/${PROJECT}`, aud: PROJECT, auth_time: now, iat: now, exp: now + 3600,
    sub: uid, user_id: uid, email: `${uid}@example.test`, email_verified: true,
    firebase: { sign_in_provider: 'password', identities: {} },
  };
  return { Authorization: `Bearer ${b64({ alg: 'none', typ: 'JWT' })}.${b64(payload)}.` };
}
async function getDoc(uid: string, path: string): Promise<number> {
  return (await fetch(`${BASE}/${path}`, { headers: authHeader(uid) })).status;
}
async function commit(uid: string, writes: unknown[]): Promise<number> {
  const res = await fetch(`${BASE}:commit`, {
    method: 'POST', headers: { ...authHeader(uid), 'Content-Type': 'application/json' },
    body: JSON.stringify({ writes }),
  });
  return res.status;
}
const setW = (path: string, data: Doc, exists?: boolean) => ({
  update: { name: `${ROOT}/${path}`, fields: toFields(data) },
  ...(exists === undefined ? {} : { currentDocument: { exists } }),
});
const patchW = (path: string, data: Doc) => ({
  update: { name: `${ROOT}/${path}`, fields: toFields(data) },
  updateMask: { fieldPaths: Object.keys(data) },
  currentDocument: { exists: true },
});

const OK = 200;
const NOT_FOUND = 404; // rule allowed the read; the doc just does not exist
const DENIED = 403;
const KL = 'jcikl';
const SG = 'jcicitysg';
const member = (role: string, loId: string, extra: Doc = {}): Doc => ({
  role, loId, general: { name: `${role} user` }, contact: { email: 'x@example.test' }, ...extra,
});
const active: Doc = { category: 'sister', country: 'Singapore', status: 'active' };

describe.skipIf(!HOST)('firestore.rules — external event registration (emulator)', () => {
  beforeAll(async () => {
    await fetch(`http://${HOST}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' });
    expect(await commit('owner', [
      setW('members/aff1', member('AFFILIATE', SG, { affiliation: active })),
      setW('members/affPending', member('AFFILIATE', SG, { affiliation: { ...active, status: 'pending_kl' } })),
      setW('members/klMember', member('MEMBER', KL)),
      setW('projects/p1', { title: 'KL event', status: 'Upcoming', hostingLo: 'JCI Kuala Lumpur', attendees: 2, registeredMembers: ['klMember', 'x'] }),
    ])).toBe(OK);
  });

  it('active external may get a non-existent own registration doc (registerForEvent txn.get)', async () => {
    expect(await getDoc('aff1', 'eventRegistrations/p1_aff1')).toBe(NOT_FOUND);
  });

  it('active external creates registration with registrantLoId + currency and bumps the counter', async () => {
    const reg: Doc = {
      eventId: 'p1', memberId: 'aff1', status: 'registered', loId: KL,
      registrantLoId: SG, currency: 'USD', createdAt: '2026-10-19T00:00:00.000Z', updatedAt: '2026-10-19T00:00:00.000Z',
    };
    const counter = patchW('projects/p1', { attendees: 3, registeredMembers: ['klMember', 'x', 'aff1'], updatedAt: '2026-10-19T00:00:00.000Z' });
    expect(await commit('aff1', [setW('eventRegistrations/p1_aff1', reg, false), counter])).toBe(OK);
  });

  it('cannot probe another user\'s registration id (404 vs 403 would leak who registered)', async () => {
    expect(await getDoc('aff1', 'eventRegistrations/p1_klMember')).toBe(DENIED);
    expect(await getDoc('aff1', 'eventRegistrations/p1_nobody')).toBe(DENIED);
  });

  it('a uid that is only a suffix-lookalike of another id cannot probe it', async () => {
    expect(await getDoc('aff1', 'eventRegistrations/p1_xaff1')).toBe(DENIED);
  });

  it('the external can read the registration back', async () => {
    expect(await getDoc('aff1', 'eventRegistrations/p1_aff1')).toBe(OK);
  });

  it('external cannot change registrantLoId / currency afterwards', async () => {
    expect(await commit('aff1', [patchW('eventRegistrations/p1_aff1', { currency: 'MYR' })])).toBe(DENIED);
    expect(await commit('aff1', [patchW('eventRegistrations/p1_aff1', { registrantLoId: KL })])).toBe(DENIED);
  });

  it('external cannot mark own registration paid', async () => {
    expect(await commit('aff1', [patchW('eventRegistrations/p1_aff1', { status: 'paid' })])).toBe(DENIED);
  });

  it('pending external cannot register', async () => {
    const reg: Doc = { eventId: 'p1', memberId: 'affPending', status: 'registered', loId: KL, registrantLoId: SG, currency: 'USD' };
    expect(await commit('affPending', [setW('eventRegistrations/p1_affPending', reg, false)])).toBe(DENIED);
  });

  it('external cannot register someone else', async () => {
    const reg: Doc = { eventId: 'p1', memberId: 'klMember', status: 'registered', loId: KL };
    expect(await commit('aff1', [setW('eventRegistrations/p1_klMember', reg, false)])).toBe(DENIED);
  });
});
