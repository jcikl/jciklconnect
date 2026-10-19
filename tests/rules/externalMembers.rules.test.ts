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
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';

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

type Filter = [field: string, op: 'EQUAL' | 'ARRAY_CONTAINS' | 'IN', value: Plain];

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
  // aff1 has opted in (reciprocity: only opted-in members may view other cards).
  aff1: member('AFFILIATE', SG, { affiliation: affiliation('active'), privacy: { shareCardInternationally: true } }),
  aff2: member('AFFILIATE', SG, { affiliation: affiliation('active') }),
  affPending: member('AFFILIATE', SG, { affiliation: affiliation('pending_kl') }),
  affOther: member('AFFILIATE', 'jcitokyo', { affiliation: { ...affiliation('active'), country: 'Japan' } }),
  chAdmin: member('CHAPTER_ADMIN', SG, { affiliation: affiliation('active') }),
  chAdminKl: member('CHAPTER_ADMIN', KL, { affiliation: affiliation('active') }),
  // Review-fix fixtures
  affBoard: member('AFFILIATE', SG, {
    affiliation: affiliation('active'),
    isCurrentBoardMember: true,
    currentBoardPosition: 'Honorary Treasurer',
  }),
  inactiveBoard: member('INACTIVE', KL, { isCurrentBoardMember: true, currentBoardPosition: 'Secretary' }),
  affSuspended: member('AFFILIATE', SG, { affiliation: affiliation('suspended') }),
  // Reciprocity fixture: KL member who has not opted in.
  klNoOpt: member('MEMBER', KL),
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
  ['members/klLegacy', { role: 'MEMBER', general: { name: 'Legacy member without loId' } }],
  ['memberCards/klMember', card('klMember', false)],
  ['memberCards/klOptIn', card('klOptIn', true)],
  ['memberCards/klNoOpt', card('klNoOpt', false)],
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
  ['transactions/tx1', { amount: 100, type: 'Income', date: '2026-10-01', bankAccountId: 'b1', loId: KL }],
  // Events are stored in `projects` (eventRegistrationService writes doc(PROJECTS, eventId)).
  ['projects/p1', { title: 'KL event', status: 'Upcoming', attendees: 2, registeredMembers: ['klMember', 'klBoard'] }],
  // WP-5: externals only see clubs opened to them.
  ['hobbyClubs/h1', { name: 'Runners', memberIds: ['klMember'], openToExternals: true }],
  ['memberBenefits/b1', { title: 'Discount' }],
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
      const next = { ...MEMBERS.aff1, privacy: { shareCardInternationally: false } };
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
      expect(await set('aff1', 'memberCards/aff1', card('aff1', true))).toBe(OK);
      expect(await set('aff1', 'memberCards/aff1', card('aff1', false))).toBe(DENIED); // opt-in is true
      expect(await set('aff1', 'memberCards/aff1', card('aff1', true, { loId: KL }))).toBe(DENIED);
      expect(await set('aff1', 'memberCards/aff1', card('aff1', true, { email: 'leak@example.test' }))).toBe(DENIED);
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
    it('MEMBER can still read KL member docs; lists need the loId == jcikl filter', async () => {
      expect(await getDoc('klMember', 'members/klBoard')).toBe(OK);
      expect(await getDoc('klMember', 'members/klLegacy')).toBe(OK); // no loId field → treated as KL
      expect(await query('klMember', 'members', [['loId', 'EQUAL', KL]])).toBe(OK);
      expect(await query('klMember', 'members', [['loId', 'EQUAL', KL], ['role', 'EQUAL', 'MEMBER']])).toBe(OK);
      expect(await query('klMember', 'members')).toBe(DENIED);
    });
  });

  describe('KL non-admins vs external members (decision 3)', () => {
    it('MEMBER cannot get or list an affiliate doc', async () => {
      expect(await getDoc('klMember', 'members/aff1')).toBe(DENIED);
      expect(await getDoc('klMember', 'members/chAdmin')).toBe(DENIED);
      expect(await query('klMember', 'members', [['loId', 'EQUAL', SG]])).toBe(DENIED);
      expect(await query('klMember', 'members', [['role', 'EQUAL', 'AFFILIATE']])).toBe(DENIED);
    });
    it('BOARD cannot get an affiliate doc or list unfiltered', async () => {
      expect(await getDoc('klBoard', 'members/aff1')).toBe(DENIED);
      expect(await query('klBoard', 'members')).toBe(DENIED);
      expect(await query('klBoard', 'members', [['loId', 'EQUAL', KL]])).toBe(OK);
    });
    it('a CHAPTER_ADMIN-role doc inside KL is hidden from non-admin get', async () => {
      expect(await getDoc('klMember', 'members/chAdminKl')).toBe(DENIED);
    });
    it('ADMIN can read affiliate docs and list unfiltered', async () => {
      expect(await getDoc('klAdmin', 'members/aff1')).toBe(OK);
      expect(await query('klAdmin', 'members')).toBe(OK);
      expect(await query('klAdmin', 'members', [['loId', 'EQUAL', SG]])).toBe(OK);
    });
    it('opted-in MEMBER can read all member cards; other modules unchanged', async () => {
      expect(await query('klOptIn', 'memberCards')).toBe(OK);
      expect(await getDoc('klOptIn', 'memberCards/aff2')).toBe(OK);
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

  // ── Adversarial review fixes ──────────────────────────────────────────────────────────────
  describe('M1: board flags never elevate external or INACTIVE users', () => {
    it('AFFILIATE with isCurrentBoardMember + Treasurer cannot read KL members or transactions', async () => {
      expect(await getDoc('affBoard', 'members/klMember')).toBe(DENIED);
      expect(await query('affBoard', 'members', [['loId', 'EQUAL', KL]])).toBe(DENIED);
      expect(await getDoc('affBoard', 'transactions/tx1')).toBe(DENIED);
      expect(await query('affBoard', 'transactions')).toBe(DENIED);
    });
    it('AFFILIATE board flag does not grant member editing', async () => {
      expect(await set('affBoard', 'members/aff2', { ...MEMBERS.aff2, general: { name: 'Hijacked' } })).toBe(DENIED);
    });
    it('INACTIVE with a stale board flag cannot read members or transactions', async () => {
      expect(await query('inactiveBoard', 'members', [['loId', 'EQUAL', KL]])).toBe(DENIED);
      expect(await getDoc('inactiveBoard', 'transactions/tx1')).toBe(DENIED);
    });
    it('real BOARD keeps access', async () => {
      expect(await getDoc('klBoard', 'transactions/tx1')).toBe(OK);
      expect(await query('klBoard', 'members', [['loId', 'EQUAL', KL]])).toBe(OK);
    });
  });

  describe('M2: externals may only add/remove their own uid on an event', () => {
    const p1 = OTHER_DOCS.find(([path]) => path === 'projects/p1')![1];
    const regs = p1.registeredMembers as string[];
    it('cannot wipe or rewrite registeredMembers / attendees', async () => {
      expect(await set('aff1', 'projects/p1', { ...p1, registeredMembers: [], attendees: 0 })).toBe(DENIED);
      expect(await set('aff1', 'projects/p1', { ...p1, registeredMembers: [...regs, 'aff2'], attendees: 3 })).toBe(DENIED);
      expect(await set('aff1', 'projects/p1', { ...p1, registeredMembers: [...regs, 'aff1'], attendees: 4 })).toBe(DENIED);
      expect(await set('aff1', 'projects/p1', { ...p1, registeredMembers: ['aff1'], attendees: 1 })).toBe(DENIED);
    });
    it('can register (own uid, +1) and cancel (own uid, -1)', async () => {
      const registered = { ...p1, registeredMembers: [...regs, 'aff1'], attendees: 3 };
      expect(await set('aff1', 'projects/p1', registered)).toBe(OK);
      expect(await set('aff1', 'projects/p1', { ...registered, registeredMembers: regs, attendees: 3 })).toBe(DENIED);
      expect(await set('aff1', 'projects/p1', { ...registered, registeredMembers: regs, attendees: 2 })).toBe(OK);
    });
    it('the same tight check applies on /events', async () => {
      const e1 = OTHER_DOCS.find(([path]) => path === 'events/e1')![1];
      expect(await set('aff1', 'events/e1', { ...e1, registeredMembers: ['aff1'], attendees: 1 })).toBe(OK);
      expect(await set('aff1', 'events/e1', { ...e1, registeredMembers: [], attendees: 5 })).toBe(DENIED);
    });
  });

  describe('M3: non-admin BOARD cannot create or convert external members', () => {
    beforeEach(async () => {
      expect(await set('owner', 'members/klOptIn', MEMBERS.klOptIn)).toBe(OK);
    });
    it('cannot make a KL MEMBER an active AFFILIATE of SG', async () => {
      const next = { ...MEMBERS.klOptIn, role: 'AFFILIATE', loId: SG, affiliation: affiliation('active') };
      expect(await set('klBoard', 'members/klOptIn', next)).toBe(DENIED);
    });
    it('cannot create an active AFFILIATE', async () => {
      expect(await set('klBoard', 'members/boardAff', member('AFFILIATE', SG, { affiliation: affiliation('active') }))).toBe(DENIED);
    });
    it('cannot move a KL MEMBER to another chapter or add affiliation', async () => {
      expect(await set('klBoard', 'members/klOptIn', { ...MEMBERS.klOptIn, loId: SG })).toBe(DENIED);
      expect(await set('klBoard', 'members/klOptIn', { ...MEMBERS.klOptIn, affiliation: affiliation('active') })).toBe(DENIED);
    });
    it('cannot create a KL doc in another chapter', async () => {
      expect(await set('klBoard', 'members/boardSg', member('MEMBER', SG))).toBe(DENIED);
    });
    it('still edits and creates KL members normally', async () => {
      expect(await set('klBoard', 'members/klOptIn', { ...MEMBERS.klOptIn, general: { name: 'Edited' } })).toBe(OK);
      expect(await set('klBoard', 'members/boardKl', member('MEMBER', KL))).toBe(OK);
      expect(await set('owner', 'members/klOptIn', MEMBERS.klOptIn)).toBe(OK); // restore
    });
    it('ADMIN can still create an active AFFILIATE', async () => {
      expect(await set('klAdmin', 'members/adminAff', member('AFFILIATE', SG, { affiliation: affiliation('active') }))).toBe(OK);
    });
  });

  describe('R-053: non-admin BOARD cannot create ADMIN / SUPER_ADMIN member docs', () => {
    it('BOARD cannot create an ADMIN or SUPER_ADMIN', async () => {
      expect(await set('klBoard', 'members/boardMadeAdmin', member('ADMIN', KL))).toBe(DENIED);
      expect(await set('klBoard', 'members/boardMadeSuper', member('SUPER_ADMIN', KL))).toBe(DENIED);
    });
    it('BOARD still creates MEMBER and BOARD docs', async () => {
      expect(await set('klBoard', 'members/boardMadeMember', member('MEMBER', KL))).toBe(OK);
      expect(await set('klBoard', 'members/boardMadeBoard', member('BOARD', KL))).toBe(OK);
    });
    it('ADMIN can still create an ADMIN', async () => {
      expect(await set('klAdmin', 'members/adminMadeAdmin', member('ADMIN', KL))).toBe(OK);
    });
  });

  describe('L1: pending / suspended externals get only their own docs', () => {
    it('suspended affiliate cannot read events, hobby clubs, benefits or write feedback / email logs', async () => {
      expect(await getDoc('affSuspended', 'events/e1')).toBe(DENIED);
      expect(await getDoc('affSuspended', 'projects/p1')).toBe(DENIED);
      expect(await getDoc('affSuspended', 'hobbyClubs/h1')).toBe(DENIED);
      expect(await query('affSuspended', 'memberBenefits')).toBe(DENIED);
      expect(
        await set('affSuspended', 'eventFeedback/f1', { memberId: 'affSuspended', eventId: 'e1', rating: 5, submittedAt: 'x' }),
      ).toBe(DENIED);
      expect(await set('affSuspended', 'emailLogs/l1', { to: 'x@example.test' })).toBe(DENIED);
    });
    it('errorLogs stays open to any signed-in user (crash reports)', async () => {
      expect(await set('affSuspended', 'errorLogs/err1', { message: 'crash' })).toBe(OK);
    });
    it('active affiliate keeps the whitelisted reads', async () => {
      expect(await getDoc('aff1', 'hobbyClubs/h1')).toBe(OK);
      expect(await query('aff1', 'memberBenefits')).toBe(OK);
      expect(
        await set('aff1', 'eventFeedback/f2', { memberId: 'aff1', eventId: 'e1', rating: 5, submittedAt: 'x' }),
      ).toBe(OK);
    });
  });

  describe('L2: external role ⇒ loId is not KL', () => {
    it('ADMIN cannot create an external doc inside KL', async () => {
      expect(await set('klAdmin', 'members/affInKl', member('AFFILIATE', KL, { affiliation: affiliation('active') }))).toBe(DENIED);
      expect(await set('klAdmin', 'members/chInKl', member('CHAPTER_ADMIN', KL))).toBe(DENIED);
    });
    it('ADMIN cannot give a KL doc an external role while loId stays KL', async () => {
      expect(await set('klAdmin', 'members/klOptIn', { ...MEMBERS.klOptIn, role: 'AFFILIATE' })).toBe(DENIED);
    });
    it('ADMIN can convert with a non-KL chapter', async () => {
      const next = { ...MEMBERS.klOptIn, role: 'AFFILIATE', loId: SG, affiliation: affiliation('active') };
      expect(await set('klAdmin', 'members/klOptIn', next)).toBe(OK);
      expect(await set('owner', 'members/klOptIn', MEMBERS.klOptIn)).toBe(OK); // restore
    });
  });

  describe('L6: chapter-admin audit fields must name the caller', () => {
    beforeEach(async () => {
      expect(await set('owner', 'members/aff2', MEMBERS.aff2)).toBe(OK);
    });
    const withAff = (extra: Doc, top: Doc = {}) => ({
      ...MEMBERS.aff2,
      ...top,
      affiliation: { ...affiliation('suspended'), ...extra },
    });
    it('rejects forged statusUpdatedBy / chapterApprovedBy / updatedBy', async () => {
      expect(await set('chAdmin', 'members/aff2', withAff({ statusUpdatedBy: 'klAdmin' }))).toBe(DENIED);
      expect(await set('chAdmin', 'members/aff2', withAff({ chapterApprovedBy: 'klAdmin' }))).toBe(DENIED);
      expect(await set('chAdmin', 'members/aff2', withAff({}, { updatedBy: 'klAdmin' }))).toBe(DENIED);
    });
    it('accepts audit fields equal to the caller', async () => {
      const ok = withAff({ statusUpdatedBy: 'chAdmin', chapterApprovedBy: 'chAdmin', statusUpdatedAt: 'now' }, { updatedBy: 'chAdmin' });
      expect(await set('chAdmin', 'members/aff2', ok)).toBe(OK);
      expect(await set('owner', 'members/aff2', MEMBERS.aff2)).toBe(OK); // restore
    });
  });

  describe('Reciprocity: only opted-in members may view other cards (admins exempt)', () => {
    it('KL MEMBER not opted in: others denied (get, international, loId in); own card allowed', async () => {
      expect(await getDoc('klNoOpt', 'memberCards/klOptIn')).toBe(DENIED);
      expect(await query('klNoOpt', 'memberCards', [['international', 'EQUAL', true]])).toBe(DENIED);
      expect(await query('klNoOpt', 'memberCards', [['loId', 'IN', [KL, SG]]])).toBe(DENIED);
      expect(await query('klNoOpt', 'memberCards')).toBe(DENIED);
      expect(await getDoc('klNoOpt', 'memberCards/klNoOpt')).toBe(OK);
    });
    it('KL MEMBER opted in: allowed as before', async () => {
      expect(await getDoc('klOptIn', 'memberCards/klNoOpt')).toBe(OK);
      expect(await query('klOptIn', 'memberCards', [['international', 'EQUAL', true]])).toBe(OK);
      expect(await query('klOptIn', 'memberCards', [['loId', 'IN', [KL, SG]]])).toBe(OK);
    });
    it('active affiliate: denied before opting in (even own chapter), allowed after', async () => {
      expect(await set('owner', 'members/aff2', MEMBERS.aff2)).toBe(OK); // not opted in
      expect(await query('aff2', 'memberCards', [['loId', 'EQUAL', SG]])).toBe(DENIED);
      expect(await query('aff2', 'memberCards', [['international', 'EQUAL', true]])).toBe(DENIED);
      expect(await getDoc('aff2', 'memberCards/aff2')).toBe(OK); // own card
      const optedIn = { ...MEMBERS.aff2, privacy: { shareCardInternationally: true } };
      expect(await set('aff2', 'members/aff2', optedIn)).toBe(OK);
      expect(await query('aff2', 'memberCards', [['loId', 'EQUAL', SG]])).toBe(OK);
      expect(await query('aff2', 'memberCards', [['international', 'EQUAL', true]])).toBe(OK);
      expect(await set('owner', 'members/aff2', MEMBERS.aff2)).toBe(OK); // restore
    });
    it('ADMIN not opted in: allowed', async () => {
      expect(await query('klAdmin', 'memberCards')).toBe(OK);
      expect(await getDoc('klAdmin', 'memberCards/klNoOpt')).toBe(OK);
    });
    it('BOARD not opted in: denied', async () => {
      expect(await getDoc('klBoard', 'memberCards/klOptIn')).toBe(DENIED);
      expect(await query('klBoard', 'memberCards', [['international', 'EQUAL', true]])).toBe(DENIED);
    });
  });
});
