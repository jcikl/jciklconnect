// @vitest-environment node
/**
 * Firestore security-rules tests for external members (Phase 0 WP1: AFFILIATE / CHAPTER_ADMIN, memberCards).
 *
 * Runs ONLY against the local Firestore emulator (never production) and is skipped otherwise, so the
 * normal `npm test` run is unaffected. No extra dependencies: talks to the emulator REST API with fetch,
 * seeds with the emulator's `Bearer owner` admin bypass and signs in users with unsigned emulator tokens.
 *
 * Run (needs Java 11+ and the firebase CLI):
 *   firebase emulators:exec --only firestore --project demo-jcikl-rules "npx vitest run tests/rules"
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

/** Unsigned ID token — accepted by the emulator only. */
function authHeader(uid: string | 'owner'): Record<string, string> {
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

async function getDoc(uid: string, path: string): Promise<number> {
  const res = await fetch(`${BASE}/${path}`, { headers: authHeader(uid) });
  return res.status;
}

type Filter = [field: string, op: 'EQUAL' | 'ARRAY_CONTAINS', value: Plain];

async function query(uid: string, collectionId: string, filters: Filter[] = []): Promise<number> {
  const fieldFilters = filters.map(([field, op, value]) => ({
    fieldFilter: { field: { fieldPath: field }, op, value: toValue(value) },
  }));
  const structuredQuery: Record<string, unknown> = { from: [{ collectionId }] };
  if (fieldFilters.length === 1) structuredQuery.where = fieldFilters[0];
  if (fieldFilters.length > 1) structuredQuery.where = { compositeFilter: { op: 'AND', filters: fieldFilters } };
  const res = await fetch(`${BASE}:runQuery`, {
    method: 'POST',
    headers: { ...authHeader(uid), 'Content-Type': 'application/json' },
    body: JSON.stringify({ structuredQuery }),
  });
  return res.status;
}

/** Full-document writes (setDoc semantics) committed atomically. */
async function commit(uid: string, writes: Array<[path: string, data: Doc]>): Promise<number> {
  const res = await fetch(`${BASE}:commit`, {
    method: 'POST',
    headers: { ...authHeader(uid), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      writes: writes.map(([path, data]) => ({ update: { name: `${ROOT}/${path}`, fields: toFields(data) } })),
    }),
  });
  return res.status;
}

const set = (uid: string, path: string, data: Doc) => commit(uid, [[path, data]]);

const OK = 200;
const DENIED = 403;

// ── Seed data ───────────────────────────────────────────────────────────────────────────────
const KL = 'jcikl';
const SG = 'jcicitysg';

const member = (role: string, loId: string, extra: Doc = {}): Doc => ({
  role,
  loId,
  general: { name: `${role} user` },
  contact: { email: 'x@example.test', phone: '+60 12-000 0000' },
  privacy: { shareCardInternationally: false },
  ...extra,
});
const affiliation = (status: string): Doc => ({ category: 'sister', country: 'Singapore', status });

const MEMBERS: Record<string, Doc> = {
  klMember: member('MEMBER', KL),
  klOptIn: member('MEMBER', KL, { privacy: { shareCardInternationally: true } }),
  klBoard: member('BOARD', KL),
  klAdmin: member('ADMIN', KL),
  aff1: member('AFFILIATE', SG, { affiliation: affiliation('active') }),
  aff2: member('AFFILIATE', SG, { affiliation: affiliation('active') }),
  affPending: member('AFFILIATE', SG, { affiliation: affiliation('pending_kl') }),
  affOther: member('AFFILIATE', 'jcitokyo', { affiliation: { ...affiliation('active'), country: 'Japan' } }),
  chAdmin: member('CHAPTER_ADMIN', SG, { affiliation: affiliation('active') }),
  chAdminKl: member('CHAPTER_ADMIN', KL, { affiliation: affiliation('active') }),
};

const card = (memberId: string, international: boolean, extra: Doc = {}): Doc => ({
  displayName: `${memberId} card`,
  loId: MEMBERS[memberId].loId as string,
  country: 'Malaysia',
  companyName: 'Acme',
  international,
  updatedAt: '2026-10-19T00:00:00.000Z',
  ...extra,
});

const OTHER_DOCS: Array<[string, Doc]> = [
  ['memberCards/klMember', card('klMember', false)],
  ['memberCards/klOptIn', card('klOptIn', true)],
  ['memberCards/aff2', card('aff2', false)],
  ['memberCards/affOther', card('affOther', false)],
  ['templates/t1', { name: 'Template' }],
  ['paymentRequests/p1', { applicantId: 'klMember', loId: KL, status: 'draft', referenceNumber: 'PR-1' }],
  ['zoomBookings/z1', { memberId: 'klMember' }],
  ['communication/c1', { authorId: 'klMember', content: 'hi' }],
  ['events/e1', { title: 'Event', status: 'Upcoming', attendees: 0, registeredMembers: [] }],
  ['eventRegistrations/r1', { memberId: 'aff1', eventId: 'e1', status: 'registered' }],
  ['eventRegistrations/r2', { memberId: 'klMember', eventId: 'e1', status: 'registered' }],
  ['surveys/s1', { title: 'For aff1', status: 'Active', targetAudience: 'Specific Group', specificMemberIds: ['aff1'] }],
  ['surveys/s2', { title: 'KL only', status: 'Active', targetAudience: 'All Members', specificMemberIds: [] }],
  ['sisterChapters/jcicitysg', { name: 'JCI City Singapore', country: 'Singapore', isActive: true }],
];

describe.skipIf(!HOST)('firestore.rules — external members (emulator)', () => {
  beforeAll(async () => {
    await fetch(`http://${HOST}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' });
    const writes: Array<[string, Doc]> = [
      ...Object.entries(MEMBERS).map(([id, d]): [string, Doc] => [`members/${id}`, d]),
      ...OTHER_DOCS,
    ];
    expect(await commit('owner', writes)).toBe(OK);
  });

  describe('AFFILIATE: member docs (PII)', () => {
    it('can get own member doc', async () => {
      expect(await getDoc('aff1', 'members/aff1')).toBe(OK);
    });
    it('cannot get a KL member doc', async () => {
      expect(await getDoc('aff1', 'members/klMember')).toBe(DENIED);
    });
    it('cannot get a same-chapter affiliate doc (only chapter admins can)', async () => {
      expect(await getDoc('aff1', 'members/aff2')).toBe(DENIED);
    });
    it('cannot list members (any filter)', async () => {
      expect(await query('aff1', 'members')).toBe(DENIED);
      expect(await query('aff1', 'members', [['loId', 'EQUAL', KL]])).toBe(DENIED);
      expect(await query('aff1', 'members', [['loId', 'EQUAL', SG]])).toBe(DENIED);
    });
    it('cannot self-activate or change affiliation', async () => {
      const next = { ...MEMBERS.affPending, affiliation: affiliation('active') };
      expect(await set('affPending', 'members/affPending', next)).toBe(DENIED);
    });
    it('cannot change own role or loId', async () => {
      expect(await set('aff1', 'members/aff1', { ...MEMBERS.aff1, role: 'MEMBER' })).toBe(DENIED);
      expect(await set('aff1', 'members/aff1', { ...MEMBERS.aff1, loId: KL })).toBe(DENIED);
    });
    it('can update own privacy opt-in', async () => {
      const next = { ...MEMBERS.aff1, privacy: { shareCardInternationally: true } };
      expect(await set('aff1', 'members/aff1', next)).toBe(OK);
      expect(await set('aff1', 'members/aff1', MEMBERS.aff1)).toBe(OK); // restore
    });
  });

  describe('AFFILIATE: memberCards', () => {
    it('can list cards with international == true', async () => {
      expect(await query('aff1', 'memberCards', [['international', 'EQUAL', true]])).toBe(OK);
    });
    it('can list cards of own chapter', async () => {
      expect(await query('aff1', 'memberCards', [['loId', 'EQUAL', SG]])).toBe(OK);
    });
    it('can list international cards of KL', async () => {
      expect(await query('aff1', 'memberCards', [['international', 'EQUAL', true], ['loId', 'EQUAL', KL]])).toBe(OK);
    });
    it('cannot list cards without a matching filter', async () => {
      expect(await query('aff1', 'memberCards')).toBe(DENIED);
      expect(await query('aff1', 'memberCards', [['loId', 'EQUAL', KL]])).toBe(DENIED);
      expect(await query('aff1', 'memberCards', [['international', 'EQUAL', false]])).toBe(DENIED);
    });
    it('get: opted-in KL card and own-chapter card yes; non-opted-in KL / other chapter no', async () => {
      expect(await getDoc('aff1', 'memberCards/klOptIn')).toBe(OK);
      expect(await getDoc('aff1', 'memberCards/aff2')).toBe(OK);
      expect(await getDoc('aff1', 'memberCards/klMember')).toBe(DENIED);
      expect(await getDoc('aff1', 'memberCards/affOther')).toBe(DENIED);
    });
    it('can write own card only with the exact field set and mirrored loId / international', async () => {
      expect(await set('aff1', 'memberCards/aff1', card('aff1', false))).toBe(OK);
      expect(await set('aff1', 'memberCards/aff1', card('aff1', true))).toBe(DENIED); // opt-in is false
      expect(await set('aff1', 'memberCards/aff1', card('aff1', false, { loId: KL }))).toBe(DENIED);
      expect(await set('aff1', 'memberCards/aff1', card('aff1', false, { email: 'leak@example.test' }))).toBe(DENIED);
      expect(await set('aff1', 'memberCards/aff2', card('aff2', false))).toBe(DENIED); // not own
    });
    it('pending affiliate cannot read other cards', async () => {
      expect(await query('affPending', 'memberCards', [['international', 'EQUAL', true]])).toBe(DENIED);
      expect(await getDoc('affPending', 'members/affPending')).toBe(OK);
    });
  });

  describe('AFFILIATE: module whitelist', () => {
    it('cannot read non-whitelisted collections', async () => {
      expect(await getDoc('aff1', 'templates/t1')).toBe(DENIED);
      expect(await query('aff1', 'templates')).toBe(DENIED);
      expect(await query('aff1', 'paymentRequests', [['applicantId', 'EQUAL', 'aff1']])).toBe(DENIED);
      expect(await query('aff1', 'zoomBookings')).toBe(DENIED);
      expect(await query('aff1', 'communication')).toBe(DENIED);
    });
    it('cannot create a payment request', async () => {
      expect(
        await set('aff1', 'paymentRequests/p2', { applicantId: 'aff1', loId: SG, status: 'draft', referenceNumber: 'PR-2' }),
      ).toBe(DENIED);
    });
    it('can read events and sister chapters', async () => {
      expect(await getDoc('aff1', 'events/e1')).toBe(OK);
      expect(await getDoc('aff1', 'sisterChapters/jcicitysg')).toBe(OK);
    });
    it('event registrations: own list only; can register', async () => {
      expect(await query('aff1', 'eventRegistrations', [['memberId', 'EQUAL', 'aff1']])).toBe(OK);
      expect(await query('aff1', 'eventRegistrations')).toBe(DENIED);
      expect(await getDoc('aff1', 'eventRegistrations/r2')).toBe(DENIED);
      expect(await set('aff1', 'eventRegistrations/r3', { memberId: 'aff1', eventId: 'e1', status: 'registered' })).toBe(OK);
    });
    it('surveys: only those targeted to them', async () => {
      expect(await query('aff1', 'surveys', [['specificMemberIds', 'ARRAY_CONTAINS', 'aff1']])).toBe(OK);
      expect(await query('aff1', 'surveys')).toBe(DENIED);
      expect(await getDoc('aff1', 'surveys/s1')).toBe(OK);
      expect(await getDoc('aff1', 'surveys/s2')).toBe(DENIED);
    });
  });

  describe('CHAPTER_ADMIN', () => {
    it('can list members of own chapter only', async () => {
      expect(await query('chAdmin', 'members', [['loId', 'EQUAL', SG]])).toBe(OK);
      expect(await query('chAdmin', 'members', [['loId', 'EQUAL', KL]])).toBe(DENIED);
      expect(await query('chAdmin', 'members')).toBe(DENIED);
    });
    it('can get own-chapter docs but not KL docs', async () => {
      expect(await getDoc('chAdmin', 'members/aff1')).toBe(OK);
      expect(await getDoc('chAdmin', 'members/klMember')).toBe(DENIED);
    });
    it('a CHAPTER_ADMIN wrongly placed in KL gets no member access', async () => {
      expect(await query('chAdminKl', 'members', [['loId', 'EQUAL', KL]])).toBe(DENIED);
      expect(await getDoc('chAdminKl', 'members/klMember')).toBe(DENIED);
    });
    it('can change affiliation.status of own-chapter affiliates, never to active', async () => {
      const suspend = { ...MEMBERS.aff2, affiliation: affiliation('suspended'), updatedAt: '2026-10-19' };
      expect(await set('chAdmin', 'members/aff2', suspend)).toBe(OK);
      const reactivate = { ...suspend, affiliation: affiliation('active') };
      expect(await set('chAdmin', 'members/aff2', reactivate)).toBe(DENIED);
      expect(await set('owner', 'members/aff2', MEMBERS.aff2)).toBe(OK); // restore
      const activatePending = { ...MEMBERS.affPending, affiliation: affiliation('active') };
      expect(await set('chAdmin', 'members/affPending', activatePending)).toBe(DENIED);
    });
    it('cannot escalate role, move loId, change category or other fields', async () => {
      expect(await set('chAdmin', 'members/aff1', { ...MEMBERS.aff1, role: 'CHAPTER_ADMIN' })).toBe(DENIED);
      expect(await set('chAdmin', 'members/aff1', { ...MEMBERS.aff1, role: 'MEMBER' })).toBe(DENIED);
      expect(await set('chAdmin', 'members/aff1', { ...MEMBERS.aff1, loId: 'jcitokyo' })).toBe(DENIED);
      expect(
        await set('chAdmin', 'members/aff1', { ...MEMBERS.aff1, affiliation: { ...affiliation('active'), category: 'global' } }),
      ).toBe(DENIED);
      expect(await set('chAdmin', 'members/aff1', { ...MEMBERS.aff1, general: { name: 'Renamed' } })).toBe(DENIED);
    });
    it('cannot update KL members or other chapters', async () => {
      expect(await set('chAdmin', 'members/klMember', { ...MEMBERS.klMember, general: { name: 'X' } })).toBe(DENIED);
      expect(
        await set('chAdmin', 'members/affOther', { ...MEMBERS.affOther, affiliation: { ...affiliation('suspended'), country: 'Japan' } }),
      ).toBe(DENIED);
    });
  });

  describe('KL members: behaviour unchanged', () => {
    it('MEMBER can still read and list member docs', async () => {
      expect(await getDoc('klMember', 'members/klBoard')).toBe(OK);
      expect(await query('klMember', 'members')).toBe(OK);
    });
    it('MEMBER can read all member cards and other modules', async () => {
      expect(await query('klMember', 'memberCards')).toBe(OK);
      expect(await getDoc('klMember', 'memberCards/aff2')).toBe(OK);
      expect(await getDoc('klMember', 'templates/t1')).toBe(OK);
      expect(await query('klMember', 'communication')).toBe(OK);
    });
    it('MEMBER can write own card; opt-in + card can change in one batch', async () => {
      expect(await set('klMember', 'memberCards/klMember', card('klMember', false))).toBe(OK);
      expect(
        await commit('klMember', [
          ['members/klMember', { ...MEMBERS.klMember, privacy: { shareCardInternationally: true } }],
          ['memberCards/klMember', card('klMember', true)],
        ]),
      ).toBe(OK);
      expect(await set('klMember', 'memberCards/klOptIn', card('klOptIn', true))).toBe(DENIED); // not own
    });
    it('MEMBER still cannot change own role', async () => {
      expect(await set('klMember', 'members/klMember', { ...MEMBERS.klMember, role: 'ADMIN' })).toBe(DENIED);
    });
    it('BOARD cannot make a CHAPTER_ADMIN; ADMIN can', async () => {
      expect(await set('klBoard', 'members/klOptIn', { ...MEMBERS.klOptIn, role: 'CHAPTER_ADMIN' })).toBe(DENIED);
      expect(await set('klBoard', 'members/newChAdmin', member('CHAPTER_ADMIN', SG))).toBe(DENIED);
      expect(await set('klAdmin', 'members/newChAdmin', member('CHAPTER_ADMIN', SG))).toBe(OK);
    });
  });
});
