// @vitest-environment node
/**
 * Firestore security-rules tests for Phase 1 WP-B2: public (signed-out) guest event registration.
 *
 * EventsService.registerGuestForEvent writes two docs with deterministic ids in one batch:
 *   guestRegistrations/{eventId}_{emailKey}        — the registration
 *   guestRegistrations/{eventId}_phone_{phoneKey}  — phone index (_indexFor: 'phone')
 * Dedup = an existing id turns the set into an update, which signed-out users are denied.
 *
 * Runs ONLY against the local Firestore emulator and is skipped otherwise. Same REST harness as
 * tests/rules/externalMembers.rules.test.ts.
 *
 * Run (needs Java 11+ and the firebase CLI):
 *   firebase emulators:exec --only firestore --project demo-jcikl-rules "npx vitest run tests/rules --no-file-parallelism"
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

/** null = signed out (no Authorization header). Unsigned ID tokens are accepted by the emulator only. */
function authHeader(uid: string | 'owner' | null): Record<string, string> {
  if (uid === null) return {};
  if (uid === 'owner') return { Authorization: 'Bearer owner' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: `https://securetoken.google.com/${PROJECT}`,
    aud: PROJECT,
    auth_time: now,
    iat: now,
    exp: now + 3600,
    sub: uid,
    user_id: uid,
    email: `${uid}@example.test`,
    email_verified: true,
    firebase: { sign_in_provider: 'password', identities: {} },
  };
  return { Authorization: `Bearer ${b64({ alg: 'none', typ: 'JWT' })}.${b64(payload)}.` };
}

async function getDoc(uid: string | null, path: string): Promise<number> {
  const res = await fetch(`${BASE}/${path}`, { headers: authHeader(uid) });
  return res.status;
}

async function query(uid: string | null, collectionId: string, field: string, value: Plain): Promise<number> {
  const structuredQuery = {
    from: [{ collectionId }],
    where: { fieldFilter: { field: { fieldPath: field }, op: 'EQUAL', value: toValue(value) } },
  };
  const res = await fetch(`${BASE}:runQuery`, {
    method: 'POST',
    headers: { ...authHeader(uid), 'Content-Type': 'application/json' },
    body: JSON.stringify({ structuredQuery }),
  });
  return res.status;
}

/** Full-document writes (setDoc semantics) committed atomically — same as writeBatch.set. */
async function commit(uid: string | null, writes: Array<[path: string, data: Doc]>): Promise<number> {
  const res = await fetch(`${BASE}:commit`, {
    method: 'POST',
    headers: { ...authHeader(uid), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      writes: writes.map(([path, data]) => ({ update: { name: `${ROOT}/${path}`, fields: toFields(data) } })),
    }),
  });
  return res.status;
}

const OK = 200;
const DENIED = 403;

const KL = 'jcikl';
const EVENT = 'ev1';

const MEMBERS: Record<string, Doc> = {
  klMember: { role: 'MEMBER', loId: KL, general: { name: 'Member' } },
  klBoard: { role: 'BOARD', loId: KL, general: { name: 'Board' } },
  klAdmin: { role: 'ADMIN', loId: KL, general: { name: 'Admin' } },
};

// Same shapes and ids as EventsService.registerGuestForEvent.
const mainDoc = (email: string, phone: string, extra: Doc = {}): Doc => ({
  eventId: EVENT,
  name: 'Guest Person',
  email,
  phone,
  registeredAt: '2026-10-19T00:00:00.000Z',
  status: 'Pending',
  ...extra,
});
const indexDoc = (email: string, phone: string, extra: Doc = {}): Doc => ({
  eventId: EVENT,
  email,
  phone,
  status: 'Pending',
  _indexFor: 'phone',
  ...extra,
});
const without = (d: Doc, key: string): Doc => Object.fromEntries(Object.entries(d).filter(([k]) => k !== key));
const emailKey = (email: string) => email.toLowerCase().replace(/[^a-z0-9]/g, '_');
const phoneKey = (phone: string) => phone.replace(/[^0-9]/g, '');
const mainPath = (email: string) => `guestRegistrations/${EVENT}_${emailKey(email)}`;
const indexPath = (phone: string) => `guestRegistrations/${EVENT}_phone_${phoneKey(phone)}`;

const registration = (email: string, phone: string): Array<[string, Doc]> => [
  [mainPath(email), mainDoc(email, phone)],
  [indexPath(phone), indexDoc(email, phone)],
];

describe.skipIf(!HOST)('firestore.rules — guestRegistrations (emulator)', () => {
  beforeAll(async () => {
    await fetch(`http://${HOST}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' });
    const writes: Array<[string, Doc]> = Object.entries(MEMBERS).map(([id, d]): [string, Doc] => [`members/${id}`, d]);
    // Guest events live in `projects` (EventsService.getKlRelevantEvents / registerGuestForEvent ids).
    writes.push([`projects/${EVENT}`, { title: 'Open event', status: 'Upcoming', createdAt: '2026-10-01' }]);
    writes.push(['projects/evDraft', { title: 'Draft event', status: 'Draft', createdAt: '2026-10-01' }]);
    writes.push(['projects/evDone', { title: 'Past event', status: 'Completed', createdAt: '2026-10-01' }]);
    expect(await commit('owner', writes)).toBe(OK);
  });

  describe('L2: only for an existing, listed event', () => {
    const forEvent = (eventId: string, email: string, phone: string): Array<[string, Doc]> => [
      [`guestRegistrations/${eventId}_${emailKey(email)}`, mainDoc(email, phone, { eventId })],
      [`guestRegistrations/${eventId}_phone_${phoneKey(phone)}`, indexDoc(email, phone, { eventId })],
    ];
    it('an event that does not exist is denied', async () => {
      expect(await commit(null, forEvent('noSuchEvent', 'l2@example.test', '+60 12-700 0001'))).toBe(DENIED);
      expect(await commit(null, [forEvent('noSuchEvent', 'l2@example.test', '+60 12-700 0001')[1]])).toBe(DENIED);
    });
    it('a Draft or Completed event is denied', async () => {
      expect(await commit(null, forEvent('evDraft', 'l2@example.test', '+60 12-700 0002'))).toBe(DENIED);
      expect(await commit(null, forEvent('evDone', 'l2@example.test', '+60 12-700 0003'))).toBe(DENIED);
    });
  });

  describe('signed-out create', () => {
    it('main doc + phone index doc in one batch succeeds', async () => {
      expect(await commit(null, registration('a@example.test', '+60 12-111 1111'))).toBe(OK);
    });
    it('signed-out users cannot read registrations (why the old transaction reads failed)', async () => {
      expect(await getDoc(null, mainPath('a@example.test'))).toBe(DENIED);
      expect(await getDoc(null, indexPath('+60 12-111 1111'))).toBe(DENIED);
    });
  });

  describe('duplicates are denied', () => {
    it('same email + same phone', async () => {
      expect(await commit(null, registration('a@example.test', '+60 12-111 1111'))).toBe(DENIED);
    });
    it('same email, different phone', async () => {
      expect(await commit(null, registration('a@example.test', '+60 12-999 9999'))).toBe(DENIED);
    });
    it('different email, same phone', async () => {
      expect(await commit(null, registration('b@example.test', '+60 12-111 1111'))).toBe(DENIED);
    });
    it('nothing was written by the denied batches', async () => {
      expect(await getDoc('klAdmin', mainPath('b@example.test'))).toBe(404);
      expect(await getDoc('klAdmin', indexPath('+60 12-999 9999'))).toBe(404);
    });
  });

  describe('bad shapes are denied', () => {
    const email = 'c@example.test';
    const phone = '+60 12-333 3333';
    it('main doc: missing status, non-Pending status, extra field, or carrying _indexFor', async () => {
      expect(await commit(null, [[mainPath(email), without(mainDoc(email, phone), 'status')]])).toBe(DENIED);
      expect(await commit(null, [[mainPath(email), mainDoc(email, phone, { status: 'Confirmed' })]])).toBe(DENIED);
      expect(await commit(null, [[mainPath(email), mainDoc(email, phone, { role: 'ADMIN' })]])).toBe(DENIED);
      expect(await commit(null, [[mainPath(email), mainDoc(email, phone, { _indexFor: 'phone' })]])).toBe(DENIED);
    });
    it('main doc: missing a required field', async () => {
      expect(await commit(null, [[mainPath(email), without(mainDoc(email, phone), 'name')]])).toBe(DENIED);
    });
    it('index doc: extra field, wrong _indexFor, non-Pending status or missing field', async () => {
      expect(await commit(null, [[indexPath(phone), indexDoc(email, phone, { name: 'X' })]])).toBe(DENIED);
      expect(await commit(null, [[indexPath(phone), indexDoc(email, phone, { _indexFor: 'email' })]])).toBe(DENIED);
      expect(await commit(null, [[indexPath(phone), indexDoc(email, phone, { status: 'Cancelled' })]])).toBe(DENIED);
      expect(await commit(null, [[indexPath(phone), without(indexDoc(email, phone), 'eventId')]])).toBe(DENIED);
    });
    it('a valid pair still goes through afterwards', async () => {
      expect(await commit(null, registration(email, phone))).toBe(OK);
    });
  });

  // EventsService.cancelGuestRegistration: one batch, main doc { status: 'Cancelled', cancelledAt } and
  // phone index doc { status: 'Cancelled' } (update = full doc here, so the diff is exactly those keys).
  describe('cancel (board/admin)', () => {
    const email = 'd@example.test';
    const phone = '+60 12-444 4444';
    const cancelBatch = (mainExtra: Doc = {}, indexExtra: Doc = {}): Array<[string, Doc]> => [
      [mainPath(email), mainDoc(email, phone, { status: 'Cancelled', cancelledAt: '2026-10-20T00:00:00.000Z', ...mainExtra })],
      [indexPath(phone), indexDoc(email, phone, { status: 'Cancelled', ...indexExtra })],
    ];
    beforeAll(async () => {
      expect(await commit(null, registration(email, phone))).toBe(OK);
    });
    it('MEMBER and signed-out users cannot cancel', async () => {
      expect(await commit('klMember', cancelBatch())).toBe(DENIED);
      expect(await commit(null, cancelBatch())).toBe(DENIED);
    });
    it('other fields are denied on either doc', async () => {
      expect(await commit('klAdmin', cancelBatch({ name: 'Renamed' }))).toBe(DENIED);
      expect(await commit('klAdmin', cancelBatch({}, { email: 'x@example.test' }))).toBe(DENIED);
      expect(await commit('klAdmin', cancelBatch({}, { cancelledAt: '2026-10-20T00:00:00.000Z' }))).toBe(DENIED);
    });
    it('BOARD can cancel (main doc status + cancelledAt, index doc status)', async () => {
      expect(await commit('klBoard', cancelBatch())).toBe(OK);
    });
    it('check-in fields on the main doc still work for ADMIN', async () => {
      const r = mainDoc('a@example.test', '+60 12-111 1111', { checkedIn: true, checkedInAt: 'now', updatedAt: 'now' });
      expect(await commit('klAdmin', [[mainPath('a@example.test'), r]])).toBe(OK);
    });
  });

  describe('reads stay board/admin only', () => {
    it('ADMIN and BOARD can get and list', async () => {
      expect(await getDoc('klAdmin', mainPath('a@example.test'))).toBe(OK);
      expect(await query('klAdmin', 'guestRegistrations', 'eventId', EVENT)).toBe(OK);
      expect(await getDoc('klBoard', mainPath('a@example.test'))).toBe(OK);
      expect(await query('klBoard', 'guestRegistrations', 'eventId', EVENT)).toBe(OK);
    });
    it('MEMBER and signed-out users cannot list', async () => {
      expect(await query('klMember', 'guestRegistrations', 'eventId', EVENT)).toBe(DENIED);
      expect(await query(null, 'guestRegistrations', 'eventId', EVENT)).toBe(DENIED);
    });
  });
});
