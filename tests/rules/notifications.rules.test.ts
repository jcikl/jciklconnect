// @vitest-environment node
/**
 * Firestore security-rules tests: notifications list. Board / admin list any notifications; every other
 * signed-in user (KL MEMBER, GUEST, AFFILIATE, CHAPTER_ADMIN) lists only their own, and only with a query
 * that carries where('memberId','==',uid) — the shape of CommunicationService.getNotifications
 * (where memberId ==, orderBy timestamp desc, orderBy read asc).
 *
 * Runs ONLY against the local Firestore emulator (never production) and is skipped otherwise.
 *   firebase emulators:exec --only firestore --project demo-jcikl-rules "npx vitest run tests/rules --no-file-parallelism"
 */
import { describe, it, expect, beforeAll } from 'vitest';

const HOST = process.env.FIRESTORE_EMULATOR_HOST;
const PROJECT = process.env.GCLOUD_PROJECT || 'demo-jcikl-rules';
const ROOT = `projects/${PROJECT}/databases/(default)/documents`;
const BASE = `http://${HOST}/v1/${ROOT}`;

type Plain = null | boolean | number | string | Plain[] | { [key: string]: Plain };
type Doc = { [key: string]: Plain };

function toValue(v: Plain): Record<string, unknown> {
  if (v === null) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toValue) } };
  return { mapValue: { fields: toFields(v) } };
}
function toFields(d: Doc): Record<string, Record<string, unknown>> {
  const out: Record<string, Record<string, unknown>> = {};
  for (const [k, v] of Object.entries(d)) out[k] = toValue(v);
  return out;
}
const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
function authHeader(uid: string | null): Record<string, string> {
  if (uid === null) return {};
  if (uid === 'owner') return { Authorization: 'Bearer owner' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: `https://securetoken.google.com/${PROJECT}`, aud: PROJECT, auth_time: now, iat: now, exp: now + 3600,
    sub: uid, user_id: uid, email: `${uid}@example.test`, email_verified: true,
    firebase: { sign_in_provider: 'password', identities: {} },
  };
  return { Authorization: `Bearer ${b64({ alg: 'none', typ: 'JWT' })}.${b64(payload)}.` };
}
async function seed(writes: Array<[string, Doc]>): Promise<number> {
  const res = await fetch(`${BASE}:commit`, {
    method: 'POST',
    headers: { ...authHeader('owner'), 'Content-Type': 'application/json' },
    body: JSON.stringify({ writes: writes.map(([path, data]) => ({ update: { name: `${ROOT}/${path}`, fields: toFields(data) } })) }),
  });
  return res.status;
}
/** Lists notifications as `uid`; memberId === undefined → unfiltered query. */
async function list(uid: string | null, memberId?: string): Promise<number> {
  const structuredQuery: Record<string, unknown> = {
    from: [{ collectionId: 'notifications' }],
    orderBy: [
      { field: { fieldPath: 'timestamp' }, direction: 'DESCENDING' },
      { field: { fieldPath: 'read' }, direction: 'ASCENDING' },
    ],
  };
  if (memberId !== undefined) {
    structuredQuery.where = { fieldFilter: { field: { fieldPath: 'memberId' }, op: 'EQUAL', value: { stringValue: memberId } } };
  }
  const res = await fetch(`${BASE}:runQuery`, {
    method: 'POST',
    headers: { ...authHeader(uid), 'Content-Type': 'application/json' },
    body: JSON.stringify({ structuredQuery }),
  });
  return res.status;
}

const OK = 200;
const DENIED = 403;
const SG = 'jcicitysg';
const ext = (role: string): Doc => ({
  role, loId: SG, general: { name: role }, contact: { email: `${role}@example.test` },
  affiliation: { category: 'sister', country: 'Singapore', status: 'active' },
});
const kl = (role: string, extra: Doc = {}): Doc => ({ role, loId: 'jcikl', general: { name: role }, contact: { email: `${role}@example.test` }, ...extra });
const notif = (memberId: string, i: number): Doc => ({ memberId, title: `t${i}`, message: 'm', type: 'info', read: false, timestamp: `2026-10-0${i}T00:00:00Z` });

describe.skipIf(!HOST)('firestore.rules — notifications list (emulator)', () => {
  beforeAll(async () => {
    await fetch(`http://${HOST}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' });
    expect(await seed([
      ['members/klMember', kl('MEMBER')],
      ['members/klGuest', kl('GUEST')],
      ['members/klBoardFlag', kl('MEMBER', { jciCareer: { isCurrentBoardMember: true } })],
      ['members/klBoard', kl('BOARD')],
      ['members/klAdmin', kl('ADMIN')],
      ['members/aff', ext('AFFILIATE')],
      ['members/chAdmin', ext('CHAPTER_ADMIN')],
      ['notifications/n1', notif('klMember', 1)],
      ['notifications/n2', notif('aff', 2)],
      ['notifications/n3', notif('chAdmin', 3)],
      ['notifications/n4', notif('klBoard', 4)],
    ])).toBe(OK);
  });

  describe('own notifications (query filtered by own memberId)', () => {
    it.each(['klMember', 'klGuest', 'aff', 'chAdmin'])('%s may list their own', async uid => {
      expect(await list(uid, uid)).toBe(OK);
    });
  });

  describe('denied', () => {
    it.each(['klMember', 'klGuest', 'aff', 'chAdmin'])('%s may not list another member’s notifications', async uid => {
      expect(await list(uid, 'klBoard')).toBe(DENIED);
    });
    it.each(['klMember', 'klGuest', 'aff', 'chAdmin'])('%s may not run an unfiltered list', async uid => {
      expect(await list(uid)).toBe(DENIED);
    });
    it('signed-out users may not list, even filtered', async () => {
      expect(await list(null, 'klMember')).toBe(DENIED);
      expect(await list(null)).toBe(DENIED);
    });
  });

  describe('board / admin unchanged', () => {
    it.each(['klBoard', 'klAdmin', 'klBoardFlag'])('%s may list unfiltered and any member’s', async uid => {
      expect(await list(uid)).toBe(OK);
      expect(await list(uid, 'klMember')).toBe(OK);
      expect(await list(uid, 'aff')).toBe(OK);
    });
  });
});
